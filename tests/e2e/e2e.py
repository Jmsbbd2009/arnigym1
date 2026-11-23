"""E2E checks for the ArniyGym news feed, unread badge, offline cache policy and install banner."""
import json, time, sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
import os
OUT = os.environ.get("E2E_SHOTS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots"))
os.makedirs(OUT, exist_ok=True)
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail and not cond else ""), flush=True)

ARGS = ["--host-resolver-rules=MAP test-project.supabase.co 127.0.0.1:8443", "--ignore-certificate-errors", "--proxy-bypass-list=*"]
MOBILE = dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, ignore_https_errors=True)
SESSION = {"access_token": "member-token", "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600,
           "refresh_token": "r", "user": {"id": "bbbbbbbb-0000-4000-8000-000000000001", "aud": "authenticated", "role": "authenticated",
           "email": "", "phone": "998900000000", "app_metadata": {}, "user_metadata": {}, "created_at": "2026-11-01T00:00:00Z"}}

def cache_urls(page):
    return page.evaluate("""async () => { const out = {}; for (const k of await caches.keys()) { if (k.startsWith('workbox-precache')) continue; const c = await caches.open(k); out[k] = (await c.keys()).map(r => r.url); } return out; }""")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None, args=ARGS)

    # ---------- Guest ----------
    ctx = browser.new_context(**MOBILE)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/", wait_until="networkidle"); page.wait_for_timeout(1500)
    check("home shows news section", page.locator("#yangiliklar").get_by_text("Yangi trenajyorlar zalda").count() > 0)
    badge = page.locator(".bottom-nav .news-badge")
    check("bottom nav unread badge = 2", badge.count() and badge.inner_text().strip() == "2", badge.inner_text() if badge.count() else "none")
    page.screenshot(path=f"{OUT}/01-home-guest.png", full_page=False)
    page.locator(".bottom-nav button", has_text="Yangiliklar").click(); page.wait_for_timeout(800)
    check("/news route", page.url.endswith("/news"), page.url)
    cards = page.locator(".nf-list .nf-card")
    check("feed shows 2 public cards", cards.count() == 2, str(cards.count()))
    check("pinned card first", "nf-pinned" in (cards.first.get_attribute("class") or ""))
    check("members-only CTA for guest", page.locator(".nf-members-cta").count() == 1)
    check("guest push button asks to sign in", page.get_by_text("Bildirishnoma uchun kiring").count() == 1)
    page.screenshot(path=f"{OUT}/02-feed-guest.png", full_page=True)
    page.locator(".nf-chip", has_text="Jadval").click(); page.wait_for_timeout(200)
    check("category filter", page.locator(".nf-list .nf-card").count() == 1)
    page.locator(".nf-chip", has_text="Barchasi").click()
    page.locator(".nf-list .nf-card").first.locator("button").click(); page.wait_for_timeout(600)
    check("detail route", "/news/aaaaaaaa-0000-4000-8000-000000000001" in page.url, page.url)
    body = page.locator(".nf-body").inner_text()
    check("body rendered as text, not HTML", "<b>HTML emas</b>" in body and page.locator(".nf-body b").count() == 0, body)
    check("image 16:9", page.evaluate("() => { const i = document.querySelector('.nf-detail-cover img'); return i && Math.abs(i.getBoundingClientRect().width / i.getBoundingClientRect().height - 16/9) < 0.02 }"))
    page.screenshot(path=f"{OUT}/03-detail.png", full_page=True)
    stored = page.evaluate("() => localStorage.getItem('arniygym-news-read:guest')")
    check("guest read state in localStorage", stored and "000000000001" in stored, str(stored))
    check("badge now 1", page.locator(".bottom-nav .news-badge").inner_text().strip() == "1")
    page.locator(".language-switch").click(); page.wait_for_timeout(400)
    check("ru title shown", page.get_by_role("heading", name="Новые тренажёры в зале").count() == 1)
    check("ru body falls back to uz", "Bugundan boshlab" in page.locator(".nf-body").inner_text())
    page.locator(".language-switch").click(); page.wait_for_timeout(200)

    # Service worker + offline
    page.goto(BASE + "/news", wait_until="networkidle")
    page.evaluate("() => navigator.serviceWorker.ready"); page.reload(wait_until="networkidle"); page.wait_for_timeout(1500)
    controlled = page.evaluate("() => Boolean(navigator.serviceWorker.controller)")
    check("service worker controls page", controlled)
    caches_guest = cache_urls(page)
    flat = [u for urls in caches_guest.values() for u in urls]
    check("public news query cached", any("is_members_only=eq.false" in u for u in flat), json.dumps(caches_guest)[:400])
    check("public news image cached", any("/object/public/news-images/" in u for u in flat))
    ctx.set_offline(True)
    page.goto(BASE + "/news", wait_until="domcontentloaded"); page.wait_for_timeout(2500)
    check("offline: cached public news visible", page.locator(".nf-list .nf-card").count() == 2, str(page.locator(".nf-list .nf-card").count()))
    check("offline banner", page.locator(".nf-offline").count() == 1)
    page.screenshot(path=f"{OUT}/04-offline.png", full_page=False)
    ctx.set_offline(False)
    check("no page errors (guest)", not errors, "; ".join(errors)[:300])
    ctx.close()

    # ---------- Signed-in member ----------
    ctx = browser.new_context(**MOBILE)
    ctx.add_init_script(f"localStorage.setItem('sb-test-project-auth-token', {json.dumps(json.dumps(SESSION))}); try{{sessionStorage.setItem('ag-splash-seen','1')}}catch(e){{}}")
    page = ctx.new_page(); errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE + "/news", wait_until="networkidle"); page.wait_for_timeout(1500)
    check("member sees 3 news incl. members-only", page.locator(".nf-list .nf-card").count() == 3, str(page.locator(".nf-list .nf-card").count()))
    check("members-only flag shown", page.locator(".nf-flag-members").count() >= 1)
    page.screenshot(path=f"{OUT}/05-feed-member.png", full_page=True)
    page.reload(wait_until="networkidle"); page.wait_for_timeout(1500)
    caches_member = cache_urls(page)
    flat = [u for urls in caches_member.values() for u in urls]
    check("members-only query never cached", not any("is_members_only=eq.true" in u for u in flat), json.dumps(caches_member)[:400])
    page.locator(".nf-list .nf-card").first.locator("button").click(); page.wait_for_timeout(800)
    log = json.loads(page.evaluate("() => fetch('https://test-project.supabase.co/__log').then(r => r.text())"))
    check("member read state saved to news_reads (Supabase)", any(e[0] == "POST" and "/rest/v1/news_reads" in e[1] and "bbbbbbbb" in e[2] for e in log))
    local_guest = page.evaluate("() => localStorage.getItem('arniygym-news-read:guest')")
    check("member read state not written to guest storage", local_guest is None, str(local_guest))
    check("no page errors (member)", not errors, "; ".join(errors)[:300])
    ctx.close()

    # ---------- iOS Safari install guidance ----------
    ios = dict(MOBILE, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
    ctx = browser.new_context(**ios)
    page = ctx.new_page()
    page.goto(BASE + "/news", wait_until="networkidle"); page.wait_for_timeout(7500)
    check("iOS install banner appears", page.locator(".pwa-install").count() == 1)
    check("iOS push hint (needs Home Screen)", page.get_by_text("bosh ekranga qo‘shing", exact=False).count() >= 1)
    page.screenshot(path=f"{OUT}/06-ios-banner.png", full_page=False)
    page.locator(".pwa-install .nf-btn").click(); page.wait_for_timeout(400)
    check("iOS steps modal (Share → Add to Home Screen)", page.locator(".pwa-steps li").count() == 3)
    page.screenshot(path=f"{OUT}/07-ios-steps.png", full_page=False)
    page.keyboard.press("Escape"); page.locator(".pwa-install-close").click()
    page.reload(wait_until="networkidle"); page.wait_for_timeout(7500)
    check("dismissed banner not shown again", page.locator(".pwa-install").count() == 0)
    ctx.close()

    # ---------- Desktop layout ----------
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, ignore_https_errors=True)
    page = ctx.new_page(); page.goto(BASE + "/news", wait_until="networkidle"); page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/08-desktop.png", full_page=False)
    ctx.close()
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
