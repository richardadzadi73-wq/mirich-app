"""Real-browser crypto round-trips (ECDH + AES-GCM + media sealing) using the app's own functions. python3 tests/ui/e2ee-test.py"""
import os,threading,http.server,socketserver,functools,sys
from playwright.sync_api import sync_playwright
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a):pass
srv=socketserver.TCPServer(('127.0.0.1',0),functools.partial(Q,directory=root));port=srv.server_address[1];threading.Thread(target=srv.serve_forever,daemon=True).start()
mock=open(os.path.join(root,'tests/ui/mock-supabase.js')).read()
JS="""async()=>{
 const gen=async()=>{let k=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);return{priv:await crypto.subtle.exportKey('jwk',k.privateKey),pub:JSON.stringify(await crypto.subtle.exportKey('jwk',k.publicKey))}};
 const A=await gen(),B=await gen(),out={};
 await e2eLoad(A.priv);allProfiles=[{name:'Bob',public_key:B.pub}];currentGroupId=null;
 const enc=await e2eEnc('héllo wörld 🌍','Bob');out.prefixed=enc.startsWith('e2e1:');out.notPlain=!enc.includes('llo');
 const seal=await mediaSeal(new Blob([new Uint8Array([1,2,3,4,5,250])],{type:'image/jpeg'}));const env=await e2eEnc('m1|'+JSON.stringify(seal.env),'Bob');
 await e2eLoad(B.priv);allProfiles=[{name:'Alice',public_key:A.pub}];
 out.text=await e2eDec(enc,'Alice');
 const m=JSON.parse((await e2eDec(env,'Alice')).slice(3));const blob=await mediaOpen(seal.ct,m);out.media=[...new Uint8Array(await blob.arrayBuffer())].join(',')+'|'+blob.type;
 const C=await gen();await e2eLoad(C.priv);allProfiles=[{name:'Alice',public_key:A.pub}];out.wrongKey=await e2eDec(enc,'Alice');
 out.inQuiet=(()=>{localStorage.setItem('michat_quiet','00:00-23:59');return inQuiet();})();
 return out;}"""
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:150]))
    pg.add_init_script("localStorage.setItem('michat_onb','1')")
    pg.route('**/cdn.jsdelivr.net/**',lambda r:r.fulfill(body=mock if 'supabase' in r.request.url else '',content_type='application/javascript'))
    pg.goto(f'http://127.0.0.1:{port}/index.html');pg.wait_for_timeout(1000)
    r=pg.evaluate(JS);b.close()
ok=r['prefixed'] and r['notPlain'] and r['text']=='héllo wörld 🌍' and r['media']=='1,2,3,4,5,250|image/jpeg' and r['wrongKey'] is None and r['inQuiet'] and not errs
print(r,errs or '');print('E2EE TEST','PASS' if ok else 'FAIL');sys.exit(0 if ok else 1)
