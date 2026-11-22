/* ===== v6: visual polish helpers — avatar tints, bubble grouping, date separators ===== */
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h;};
function tintAvatars(){document.querySelectorAll('.row .ava:not([data-t]),#roomAva:not([data-t])').forEach(a=>{if(a.querySelector('img')||a.tagName==='IMG')return;let n=a.closest('.row')?.querySelector('b')?.textContent||document.getElementById('roomName')?.textContent||a.textContent;a.dataset.t=1;if(/Mirich AI|General Chat/.test(n))return;let h=hue(n.trim());a.style.background='linear-gradient(135deg,hsl('+h+' 62% 52%),hsl('+((h+40)%360)+' 62% 38%))';a.style.color='#fff';});}
function dayLabel(d){let t=new Date(),y=new Date(Date.now()-864e5),s=x=>x.toDateString();if(s(d)===s(t))return 'Today';if(s(d)===s(y))return 'Yesterday';return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:d.getFullYear()===t.getFullYear()?undefined:'numeric'});}
function polishMsgs(){let box=document.getElementById('msgs');if(!box)return;document.body.classList.toggle('dm-room',!currentGroupId&&currentChatName!=='General');
 box.querySelectorAll('.dsep').forEach(x=>x.remove());let prev=null,prevDay='';box.querySelectorAll('.bubble[data-id]').forEach(b=>{let ts=new Date(b.dataset.ts||0),day=isNaN(ts)?'':ts.toDateString();if(day&&day!==prevDay){b.insertAdjacentHTML('beforebegin','<div class="dsep"><span>'+dayLabel(ts)+'</span></div>');prevDay=day;prev=null;}
  let side=b.classList.contains('me')?'me':'other',sender=b.querySelector('.sname')?.textContent||side;let cont=prev&&prev.side===side&&prev.sender===sender&&(ts-prev.ts)<5*60000;b.classList.toggle('cont',!!cont);prev={side,sender,ts};});}
{const _d=decorate;decorate=async function(){polishMsgs();await _d();polishMsgs();tintAvatars();};}
new MutationObserver(()=>{clearTimeout(window._ta);window._ta=setTimeout(tintAvatars,120);}).observe(document.body,{childList:true,subtree:true});
tintAvatars();
