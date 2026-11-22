/* Fake Supabase client for offline UI tests / screenshots. Injected in place of the CDN bundle. */
window.supabase={createClient:()=>{
 const now=Date.now(),iso=m=>new Date(now-m*60000).toISOString();
 const me={id:'u1',name:'Amara',handle:'amara',theme:'blue',is_premium:true,last_seen:iso(0),is_online:true};
 const P=[me,{id:'u2',name:'Liam',last_seen:iso(1),is_online:true},{id:'u3',name:'Sofia',last_seen:iso(30)},{id:'u4',name:'Kenji',last_seen:iso(300)},{id:'u5',name:'Priya',last_seen:iso(2),is_online:true,is_premium:true}];
 let id=1;const M=(s,c,t,m,st='read')=>({id:id++,sender:s,sender_name:s,chat_name:c,text:t,created_at:iso(m),status:st,group_id:null});
 const msgs=[M('Liam','Amara','Hey! Are we still on for the demo tomorrow? 🙌',58),M('Amara','Liam','Yes — I just pushed the new themes. Take a look 🎨',55),M('Liam','Amara','Love the purple one. The gold looks really premium too.',52),M('Amara','Liam','Thanks! Voice and video calls work now as well 📞',49),M('Liam','Amara','Amazing. Send me the invite link @Amara',46),M('Amara','Liam','https://michat.app/join — see you at 10!',44,'delivered'),
  M('Sofia','Amara','Sent you the poster files',120),M('Priya','Amara','Can you review the translation?',12),M('Kenji','Amara','Thanks for the intro 🙏',600)];
 const DB={public_profiles:P,profiles:[me],messages:msgs,groups:[],group_members:[],posts:[],stories:[],muted_chats:[],blocks:[],cleared_chats:[],calls:[]};
 const parseOr=s=>{let g=[];(s.match(/and\([^)]*\)/g)||[]).forEach(x=>g.push([...x.matchAll(/(\w+)\.eq\.\"?([^,)\"]+)\"?/g)].map(m=>[m[1],m[2]])));if(!g.length)g=[...s.matchAll(/(\w+)\.eq\.\"?([^,)\"]+)\"?/g)].map(m=>[[m[1],m[2]]]);return g;};
 const qb=t=>{let rows=(DB[t]||[]).slice(),single=false;const b=new Proxy({},{get(_,k){
  if(k==='then')return(res,rej)=>Promise.resolve({data:single?(rows[0]||null):rows,error:null}).then(res,rej);
  if(k==='single'||k==='maybeSingle')return()=>{single=true;return b;};
  if(k==='eq')return(c,v)=>{rows=rows.filter(r=>r[c]==v);return b;};
  if(k==='or')return s=>{let g=parseOr(s);if(g.length)rows=rows.filter(r=>g.some(a=>a.every(([c,v])=>r[c]==v)));return b;};
  if(k==='limit')return n=>{rows=rows.slice(0,n);return b;};
  if(k==='order')return(c,o)=>{rows.sort((a,z)=>(a[c]>z[c]?1:-1)*((o&&o.ascending===false)?-1:1));return b;};
  return()=>b;}});return b;};
 const ch=()=>{const o=new Proxy({},{get:(_,k)=>k==='then'?undefined:()=>o});return o;};
 return{auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({}),verifyOtp:async()=>({error:null,data:{}})},
  from:qb,rpc:async n=>({data:n==='ensure_profile'?me:null,error:null}),channel:ch,removeChannel(){},removeAllChannels(){},
  functions:{invoke:async()=>({data:null,error:null})},storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:''}})})}};}};
