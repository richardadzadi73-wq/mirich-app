/* ===== Real 1:1 voice & video calls: WebRTC + Supabase Realtime signalling ===== */
const ICE=(window.MICHAT_CONFIG||{}).iceServers||[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
let C=null,inbox=null,inboxFor=null,peerCh={},ring=null;
function initCalls(){if(!me||(inbox&&inboxFor===me.id))return;inboxFor=me.id;peerCh={};inbox=supabaseClient.channel('call-in-'+me.name,PRIV).on('broadcast',{event:'sig'},({payload:p})=>onSig(p)).subscribe();}
setInterval(()=>{if(me&&(!inbox||inboxFor!==me.id))initCalls();},3000);
const _lo2=logout;logout=async function(){if(C)endCall();inbox=null;inboxFor=null;peerCh={};return _lo2.apply(this,arguments);};
function sendSig(peer,p){return new Promise(res=>{let ch=peerCh[peer];const go=c=>{c.send({type:'broadcast',event:'sig',payload:{...p,from:me.name}});res();};if(ch&&ch._ok){go(ch);return;}ch=peerCh[peer]=supabaseClient.channel('call-in-'+peer,PRIV);ch.subscribe(s=>{if(s==='SUBSCRIBED'){ch._ok=1;go(ch);}});});}
function ringStart(){try{let a=new (window.AudioContext||window.webkitAudioContext)();let t=setInterval(()=>{let o=a.createOscillator(),g=a.createGain();o.frequency.value=440;g.gain.value=.15;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.4);navigator.vibrate?.(200);},1600);ring={a,t};}catch(e){}}
function ringStop(){if(ring){clearInterval(ring.t);ring.a.close().catch(()=>{});ring=null;}}
const cs=t=>{let e=document.getElementById('callStatus');if(e)e.textContent=t;};
function callUI(name,status,o){o=o||{};let s=document.getElementById('callScreen');
 if(!document.getElementById('remoteVid'))s.insertAdjacentHTML('afterbegin','<video id="remoteVid" autoplay playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;display:none"></video><video id="localVid" autoplay playsinline muted style="position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:14px;width:96px;height:132px;object-fit:cover;border-radius:12px;display:none;transform:scaleX(-1);border:2px solid #fff4"></video>');
 if(!document.getElementById('camCallBtn'))document.getElementById('muteCallBtn').insertAdjacentHTML('afterend','<button class="callBtn" id="camCallBtn" style="background:#1e293b;font-size:24px" onclick="toggleCam()" aria-label="Toggle camera">📷</button>');
 document.getElementById('callName').textContent=name;let av=document.getElementById('callAva');av.textContent=name[0].toUpperCase();av.style.display='flex';
 cs(status);document.getElementById('callTimer').textContent='00:00';document.getElementById('acceptCallBtn').style.display=o.incoming?'flex':'none';
 document.getElementById('camCallBtn').style.display=o.video?'flex':'none';document.getElementById('muteCallBtn').style.opacity='1';
 document.getElementById('remoteVid').style.display=o.video?'block':'none';document.getElementById('localVid').style.display='none';s.classList.remove('hidden');}
function showLocal(){if(C&&C.kind==='video'&&C.stream){let v=document.getElementById('localVid');v.srcObject=C.stream;v.style.display='block';}}
function setupPc(){let pc=C.pc=new RTCPeerConnection({iceServers:ICE});
 pc.onicecandidate=e=>{if(e.candidate&&C){(C.sentIce=C.sentIce||[]).push(e.candidate);sendSig(C.peer,{type:'ice',id:C.id,cand:e.candidate});}};
 pc.ontrack=e=>{let v=document.getElementById('remoteVid');if(v.srcObject!==e.streams[0]){v.srcObject=e.streams[0];v.play&&v.play().catch(()=>{});}};
 pc.onconnectionstatechange=()=>{if(!C)return;let s=pc.connectionState;
  if(s==='connected'&&!C.connected){C.connected=true;clearTimeout(C.to);cs('Connected');if(C.kind==='video')document.getElementById('callAva').style.display='none';C.timerInt=setInterval(()=>{if(!C)return;C.secs++;document.getElementById('callTimer').textContent=fmtDur(C.secs);},1000);}
  else if(s==='disconnected')cs('Reconnecting…');
  else if(s==='failed'){toast('Connection failed — this network may need a TURN server');endCall();}};}
const fmtDur=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
async function drainIce(){if(!C||!C.pc)return;for(let c of C.ice.splice(0))C.pc.addIceCandidate(c).catch(()=>{});}
function logCall(t){if(!C)return;supabaseClient.from('messages').insert([{chat_name:C.peer,sender:me.name,sender_name:me.name,text:t+' • '+new Date().toLocaleString(),status:'sent'}]).then(()=>{},()=>{});}
async function startRealCall(n,kind){
 if(isAI(n)){toast('Mirich AI cannot be called.');return;}
 if(currentGroupId){toast('Group calls are not supported yet');return;}
 if(C){toast('You are already in a call');return;}
 if(!navigator.mediaDevices||!window.RTCPeerConnection){toast('Calls are not supported in this browser');return;}
 if(await isBlocked(me.name,n)){toast('You blocked '+n);return;}
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{facingMode:'user'}:false});}catch(e){toast('Allow microphone'+(kind==='video'?' and camera':'')+' to call');return;}
 initCalls();C={peer:n,kind,id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),stream,role:'caller',ice:[],secs:0};
 setupPc();stream.getTracks().forEach(t=>C.pc.addTrack(t,stream));callUI(n,'Calling…',{video:kind==='video'});showLocal();
 let off=await C.pc.createOffer();await C.pc.setLocalDescription(off);await sendSig(n,{type:'offer',kind,id:C.id,sdp:off});C.rs=setInterval(()=>{if(!C||C.connected||C.answered){return;}sendSig(n,{type:'offer',kind,id:C.id,sdp:off});(C.sentIce||[]).forEach(c=>sendSig(n,{type:'ice',id:C.id,cand:c}));},3000);
 supabaseClient.from('calls').insert([{caller:me.name,callee:n,kind,status:'started'}]).then(()=>loadCalls(),()=>{});
 C.to=setTimeout(()=>{if(C&&!C.connected){sendSig(C.peer,{type:'end',id:C.id,reason:'missed'});logCall('📞 Missed '+kind+' call');cleanupCall('No answer');}},45000);}
async function onSig(p){if(!me||!p||p.from===me.name)return;
 if(p.type==='offer'){if(C&&C.id===p.id)return;if(C){sendSig(p.from,{type:'busy',id:p.id});return;}if(await isBlocked(me.name,p.from))return;
  C={peer:p.from,kind:p.kind,id:p.id,role:'callee',offer:p.sdp,ice:[],secs:0};callUI(p.from,'Incoming '+(p.kind==='video'?'video':'voice')+' call',{incoming:true,video:p.kind==='video'});ringStart();
  if(document.hidden&&'Notification' in window&&Notification.permission==='granted')navigator.serviceWorker.ready.then(r=>r.showNotification('Incoming call',{body:p.from,icon:'icon-192.png',tag:'call',requireInteraction:true}));
  C.to=setTimeout(()=>{if(C&&C.role==='callee'&&!C.pc)cleanupCall('Missed call from '+p.from);},45000);return;}
 if(!C||p.id!==C.id)return;
 if(p.type==='answer'&&C.pc){C.answered=true;await C.pc.setRemoteDescription(p.sdp);await drainIce();}
 else if(p.type==='ice'){if(C.pc&&C.pc.remoteDescription)C.pc.addIceCandidate(p.cand).catch(()=>{});else C.ice.push(p.cand);}
 else if(p.type==='end'||p.type==='reject')cleanupCall(p.type==='reject'?'Call declined':(p.reason==='missed'?'Missed call':'Call ended'));
 else if(p.type==='busy')cleanupCall(p.from+' is busy');}
async function acceptCall(){if(!C||C.role!=='callee'||C.pc)return;ringStop();clearTimeout(C.to);
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:C.kind==='video'?{facingMode:'user'}:false});}catch(e){toast('Allow microphone to answer');sendSig(C.peer,{type:'reject',id:C.id});cleanupCall('');return;}
 C.stream=stream;setupPc();stream.getTracks().forEach(t=>C.pc.addTrack(t,stream));showLocal();cs('Connecting…');document.getElementById('acceptCallBtn').style.display='none';
 await C.pc.setRemoteDescription(C.offer);await drainIce();let a=await C.pc.createAnswer();await C.pc.setLocalDescription(a);await sendSig(C.peer,{type:'answer',id:C.id,sdp:a});}
function endCall(){let c=C;if(!c){document.getElementById('callScreen').classList.add('hidden');return;}
 if(c.role==='callee'&&!c.pc){sendSig(c.peer,{type:'reject',id:c.id});cleanupCall('Call declined');return;}
 sendSig(c.peer,{type:'end',id:c.id});if(c.role==='caller')logCall(c.connected?'📞 '+(c.kind==='video'?'Video':'Voice')+' call • '+fmtDur(c.secs):'📞 Missed '+c.kind+' call');cleanupCall('Call ended');}
function cleanupCall(msg){let c=C;C=null;ringStop();if(c){clearTimeout(c.to);clearInterval(c.timerInt);clearInterval(c.rs);c.stream&&c.stream.getTracks().forEach(t=>t.stop());try{c.pc&&c.pc.close();}catch(e){}}
 ['remoteVid','localVid'].forEach(i=>{let v=document.getElementById(i);if(v){v.srcObject=null;v.style.display='none';}});document.getElementById('callScreen').classList.add('hidden');if(msg)toast(msg);loadCalls();}
function toggleCallMute(){if(!C||!C.stream)return;let t=C.stream.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;document.getElementById('muteCallBtn').style.opacity=t.enabled?'1':'.5';toast(t.enabled?'Unmuted':'Muted');}
function toggleCam(){if(!C||!C.stream)return;let t=C.stream.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;document.getElementById('camCallBtn').style.opacity=t.enabled?'1':'.5';}
function makeCall(n){return startRealCall(n,'voice');}function makeVideoCall(n){return startRealCall(n,'video');}
addEventListener('beforeunload',()=>{if(C)try{sendSig(C.peer,{type:'end',id:C.id});}catch(e){}});
