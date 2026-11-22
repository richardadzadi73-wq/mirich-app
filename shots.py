"""Renders the real app with a fake backend. Usage: python3 tests/ui/shots.py [outdir] [themes,comma] — needs playwright + chromium."""
import sys,os,threading,http.server,socketserver,functools
from playwright.sync_api import sync_playwright
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','..'))
out=sys.argv[1] if len(sys.argv)>1 else '/tmp/shots'; os.makedirs(out,exist_ok=True)
themes=(sys.argv[2] if len(sys.argv)>2 else 'blue,dark,light,gold,purple,green').split(',')
H=functools.partial(http.server.SimpleHTTPRequestHandler,directory=root)
class Q(H.func):
    def log_message(self,*a):pass
srv=socketserver.TCPServer(('127.0.0.1',0),functools.partial(Q,directory=root));port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
mock=open(os.path.join(root,'tests/ui/mock-supabase.js')).read()
with sync_playwright() as p:
    b=p.chromium.launch();errs=[]
    for th in themes:
        ctx=b.new_context(viewport={'width':430,'height':932} if os.environ.get('STORE') else {'width':390,'height':844},device_scale_factor=3 if os.environ.get('STORE') else 2,is_mobile=True,has_touch=True)
        pg=ctx.new_page();pg.on('pageerror',lambda e:errs.append(str(e)[:160]))
        pg.route('**/cdn.jsdelivr.net/**',lambda r:r.fulfill(body=mock if 'supabase' in r.request.url else '',content_type='application/javascript'))
        pg.route('**/api.giphy.com/**',lambda r:r.abort())
        pg.add_init_script("localStorage.setItem('michat_onb','1')");pg.goto(f'http://127.0.0.1:{port}/index.html');pg.wait_for_timeout(1200)
        pg.evaluate(f"applyTheme('{th}')");pg.wait_for_timeout(300)
        pg.screenshot(path=f'{out}/{th}-1-chats.png')
        pg.evaluate("openChat('Liam')");pg.wait_for_timeout(900);pg.screenshot(path=f'{out}/{th}-2-chat.png')
        pg.evaluate("show('chatsView')");pg.evaluate("openSettings()");pg.wait_for_timeout(500);pg.screenshot(path=f'{out}/{th}-3-settings.png')
        ctx.close()
    b.close()
print('errors:',errs[:6] or 'none');print('saved to',out)
