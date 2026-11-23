# ArniyGym — xavfsizlik qoidalari

Bu hujjat loyihadagi himoya choralarini va ularni buzmaslik uchun qoidalarni jamlaydi. O‘zgartirish kiritishdan oldin o‘qing.

## 1. Sirlar va kalitlar

- Frontendga (`VITE_*`) faqat ommaviy qiymatlar kiradi: Supabase URL, anon/publishable kalit, VAPID **public** kalit, Turnstile site key, sayt manzili.
- `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, Payme, Telegram bot, Gemini, Cloudflare, OTP pepper va HMAC sirlari faqat **Supabase Edge Function secrets** yoki bot serveridagi `.env` da turadi.
- `.env`, `.env.local`, `node_modules`, `dist` git va ZIP’ga kirmaydi (`.gitignore`). `.env.example` fayllarida faqat placeholder bor.
- Sir sizib chiqsa: darhol kalitni almashtiring (rotate), keyin eski kalitni o‘chiring.

## 2. Ma’lumotlar bazasi (Supabase RLS)

- Barcha jadvallarda RLS yoqilgan. Frontend tekshiruvi RLS o‘rnini bosmaydi.
- Admin huquqi `is_arniy_admin()` orqali: `admin_roles` dagi rol **va** joriy sessiya faol qurilma bo‘lishi shart.
- A’zolik `has_active_subscription()` orqali serverda tekshiriladi (holat, muddat, muzlatish, faol qurilma). Klient yuborgan `is_premium` kabi qiymatlarga ishonilmaydi.
- `gym_news`: mehmon va foydalanuvchi faqat nashr qilingan, muddati kelgan va tugamagan yangiliklarni ko‘radi; `is_members_only` yangiliklar faqat amaldagi obunachiga. INSERT/UPDATE/DELETE faqat admin. Mehmonlarga `created_by` ustuni berilmaydi. `created_by`, `created_at`, `updated_at` trigger orqali serverda qo‘yiladi.
- `news_reads`, `push_subscriptions`: har kim faqat o‘z yozuvlarini ko‘radi/o‘zgartiradi; push yozuvi `consented_at` bo‘lmasa saqlanmaydi.
- `news_push_targets()` faqat `service_role` uchun; `news_push_log` ni faqat admin o‘qiydi.
- Admin o‘zgarishlari `audit_admin_mutation` trigger’i va Edge Function’lardagi `auditAdmin()` orqali `admin_audit_log` ga yoziladi (yangilik, rasm yuklash/o‘chirish/ko‘chirish, push).

## 3. Fayllar (Storage)

- `news-images` — faqat ommaviy yangilik rasmlari (public bucket, ro‘yxatini olish yopiq).
- `news-images-members` — a’zolar yangiligi rasmlari (yopiq bucket, imzolangan havola 1 soat).
- Bazadagi CHECK cheklovi a’zolar yangiligi rasmini ommaviy bucket’da saqlashga yo‘l qo‘ymaydi.
- Yuklash: brauzerda MIME + fayl imzosi + 2 MB → 16:9 WebP; `news-image` Edge Function admin rolini, MIME, imzo, hajm va WebP o‘lchamini qayta tekshiradi; bucket o‘zi ham faqat JPEG/PNG/WebP va 2 MB qabul qiladi. Fayl nomi server tomonida tasodifiy UUID bilan beriladi.
- Almashtirilgan/o‘chirilgan rasm hech bir yangilikka bog‘lanmagan bo‘lsagina o‘chiriladi; 24 soatdan eski yetim fayllarni admin “Keraksiz rasmlarni tozalash” bilan o‘chiradi.

## 4. Edge Functions

- Har bir himoyalangan funksiya JWT’ni o‘zi tekshiradi (`requireUser` → token, sessiya ID, faol qurilma), admin funksiyalari qo‘shimcha `requireAdmin`.
- CORS faqat `APP_ORIGINS`/`APP_ORIGIN`/`ADMIN_APP_ORIGIN` dagi domenlarga ruxsat beradi.
- Rate limit: push obuna — soatiga 20, rasm amallari — soatiga 60, yangilik push — admin uchun soatiga 10; bir yangilikka qayta push faqat admin tasdig‘i bilan.
- Bot so‘rovlari HMAC imzo, vaqt belgisi va bir martalik nonce bilan tekshiriladi.

## 5. Frontend

- Yangilik matni React matn tugunlari orqali chiqadi (`white-space: pre-line`), HTML sifatida talqin qilinmaydi; `dangerouslySetInnerHTML` faqat `<` belgisi escape qilingan JSON-LD uchun ishlatiladi. Kelajakda rich text kerak bo‘lsa, DOMPurify bilan ruxsat etilgan teglar ro‘yxati orqali tozalang.
- Rasm havolalari faqat HTTPS va faqat sozlangan Supabase domenidan qabul qilinadi.
- GitHub Pages HTTP sarlavha o‘rnatishga ruxsat bermaydi, shuning uchun CSP (`default-src 'self'`, `worker-src`/`manifest-src 'self'`, `object-src 'none'`) va `Referrer-Policy` `<meta>` teglari orqali beriladi; `frame-ancestors`/`X-Frame-Options` o‘rniga ikkala ilova iframe ichida ishga tushishdan bosh tortadi (clickjacking himoyasi). HTTPS va HSTS GitHub Pages tomonidan ta’minlanadi. Admin sayt `noindex`; himoya — Supabase parol + Telegram 2FA + `admin_roles` + RLS (frontendda maxfiy narsa yo‘q).
- Bitta akkauntdan boshqasiga o‘tilganda brauzerdagi push obunasi bekor qilinadi, shunda umumiy qurilma oldingi foydalanuvchining xabarlarini olmaydi.

## 6. Offline kesh siyosati

Service worker faqat quyidagilarni saqlaydi: ilova qobig‘i (build fayllari), `is_members_only=eq.false` filtrli ommaviy yangiliklar so‘rovi (7 kun, 8 ta yozuv) va `news-images` ommaviy rasmlari (30 kun, 60 ta). A’zolar yangiliklari, imzolangan havolalar, cheklar, himoyalangan videolar, auth va Edge Function javoblari keshga yozilmaydi. Yangi kesh qoidasi qo‘shilganda shu ro‘yxatni yangilang va `tests/e2e/e2e.py` dagi “never cached” tekshiruvini kengaytiring.

## 7. Zaiflik haqida xabar berish

Xavfsizlik muammosini topsangiz, uni ommaviy issue sifatida emas, loyiha egasiga shaxsiy xabar orqali yuboring.
