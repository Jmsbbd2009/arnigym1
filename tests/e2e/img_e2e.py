import base64, json
from playwright.sync_api import sync_playwright
import os
HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, '..', '..', 'arniygym', 'supabase', 'tests', 'fixtures')
fx = lambda n: base64.b64encode(open(os.path.join(FIX, n),'rb').read()).decode()
cases = [('photo.jpg','image/jpeg','ok'),('ok.webp','image/webp','ok'),('photo.jpg','image/png','mismatch'),('ok.webp','image/gif','type')]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH') or None, args=['--proxy-bypass-list=*'])
    pg = b.new_page(); pg.goto('about:blank'); pg.add_script_tag(path=os.path.join(HERE, 'newsImage.js'))
    ok = True
    for name, mime, expect in cases:
        r = pg.evaluate("""async ([b64, mime, name]) => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const file = new File([bytes], name, { type: mime });
          try { const out = await NI.prepareNewsImage(file); const head = new Uint8Array(await out.blob.slice(0,12).arrayBuffer());
            return { ok: true, w: out.width, h: out.height, size: out.blob.size, type: out.blob.type, riff: String.fromCharCode(...head.slice(0,4)) + String.fromCharCode(...head.slice(8,12)) };
          } catch (e) { return { ok: false, error: e.message }; } }""", [fx(name), mime, name])
        passed = (r['ok'] and expect == 'ok' and r['type'] == 'image/webp' and abs(r['w']/r['h']-16/9) < 0.02 and r['size'] <= 2*1024*1024) or (not r['ok'] and expect != 'ok')
        ok &= passed
        print('PASS' if passed else 'FAIL', name, mime, json.dumps(r, ensure_ascii=False))
    b.close()
    print('ALL OK' if ok else 'SOME FAILED')
