"""HTTPS mock of the Supabase endpoints the news feed uses (for local E2E only)."""
import json, ssl, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import os
HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "..", "..", "arniygym", "supabase", "tests", "fixtures")
WEBP = open(os.path.join(FIXTURES, "ok.webp"), "rb").read()
LOG = []
IMG = "https://test-project.supabase.co/storage/v1/object/public/news-images/news/11111111-1111-4111-8111-111111111111.webp"
PUBLIC = [
    {"id": "aaaaaaaa-0000-4000-8000-000000000001", "title": "Yangi trenajyorlar zalda", "title_ru": "Новые тренажёры в зале",
     "body": "Bugundan boshlab ikkita yangi trenajyor ishlaydi.\nIkkinchi qator: <b>HTML emas</b>", "body_ru": "",
     "category": "equipment", "cover_image_url": IMG, "image_path": "news/11111111-1111-4111-8111-111111111111.webp",
     "image_bucket": "news-images", "published": True, "is_pinned": True, "is_members_only": False,
     "publish_at": "2026-11-20T08:00:00Z", "expires_at": None, "created_at": "2026-11-20T08:00:00Z", "updated_at": "2026-11-20T08:00:00Z"},
    {"id": "aaaaaaaa-0000-4000-8000-000000000002", "title": "Bayram kunlari ish vaqti", "title_ru": "", "body": "Zal 09:00–21:00 ishlaydi.", "body_ru": "",
     "category": "schedule", "cover_image_url": None, "image_path": None, "image_bucket": None, "published": True, "is_pinned": False,
     "is_members_only": False, "publish_at": "2026-11-22T08:00:00Z", "expires_at": None, "created_at": "2026-11-22T08:00:00Z", "updated_at": "2026-11-22T08:00:00Z"},
]
MEMBERS = [
    {"id": "aaaaaaaa-0000-4000-8000-000000000003", "title": "A’zolar uchun 20% chegirma", "title_ru": "Скидка 20% для участников",
     "body": "Faqat faol a’zolar uchun maxsus taklif.", "body_ru": "Специальное предложение для активных участников.",
     "category": "promo", "cover_image_url": None, "image_path": None, "image_bucket": None, "published": True, "is_pinned": False,
     "is_members_only": True, "publish_at": "2026-11-23T08:00:00Z", "expires_at": None, "created_at": "2026-11-23T08:00:00Z", "updated_at": "2026-11-23T08:00:00Z"},
]

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "*")
    def send(self, code, body=b"", ctype="application/json"):
        self.send_response(code); self.cors(); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self.send(204)
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        auth = self.headers.get("Authorization", "")
        LOG.append(("GET", self.path, "member" if "member-token" in auth else "anon"))
        if u.path == "/rest/v1/gym_news":
            if q.get("is_members_only") == ["eq.false"]: return self.send(200, json.dumps(PUBLIC).encode())
            if q.get("is_members_only") == ["eq.true"]: return self.send(200, json.dumps(MEMBERS if "member-token" in auth else []).encode())
            return self.send(200, b"[]")
        if u.path.startswith("/storage/v1/object/public/news-images/"):
            return self.send(200, WEBP, "image/webp")
        if u.path == "/__log": return self.send(200, json.dumps(LOG).encode())
        if u.path.startswith("/rest/v1/"):
            single = "vnd.pgrst.object" in (self.headers.get("Accept") or "")
            return self.send(200 if not single else 406, b"[]" if not single else b'{"code":"PGRST116"}')
        return self.send(200, b"{}")
    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0); body = self.rfile.read(length) if length else b""
        LOG.append(("POST", self.path, body.decode(errors="ignore")[:300]))
        if self.path.startswith("/functions/v1/check-active-device"): return self.send(200, b'{"active":true}')
        return self.send(201, b"[]")
    do_PATCH = do_POST

srv = ThreadingHTTPServer(("127.0.0.1", 8443), H)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(os.path.join(HERE, "cert.pem"), os.path.join(HERE, "key.pem"))
srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
print("mock ready", flush=True)
srv.serve_forever()
