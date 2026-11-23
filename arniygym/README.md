# ArniyGym

ArniyGym is delivered as two separate React/Vite projects with one Supabase backend:

- `outputs/arniygym` — public gym landing page and the signed-in member PWA. There is no admin URL in this app.
- `outputs/arniygym-admin` — separate admin app (published under `/admin/` on GitHub Pages), with password + Telegram 2FA login.

The landing page is public. Member access uses Telegram OTP. AI meal scanning and workout videos stay locked unless the member has an active subscription. Admins can publish gym announcements and manage categories, workouts, diets, plans, subscriptions, payments, and site text.

## Run the member app

1. Copy `.env.example` to `.env.local` and set the Supabase project URL, publishable/anon key, and Web Push public key.
2. Install packages with `npm ci`.
3. Start the app with `npm run dev` (or use `run-local.sh` / `run-local.bat`).
4. For phone installation, deploy over HTTPS. The site shows platform-specific Add to Home Screen steps when the browser cannot offer a native install prompt.

The PWA uses a standalone manifest and caches the application shell, static assets, and the latest **public** gym news (plus public news images) for offline reading. Members-only news, signed URLs, receipts, videos, login, payments and AI always require the network and are never cached.

## Run the separate admin app

Copy `arniygym-admin/.env.example` to `.env.local` and use the same Supabase URL and publishable/anon key, then `npm ci && npm run dev`. In production the GitHub Pages workflow builds it under `/<repo>/admin/`. The application requires the Supabase admin login and Telegram 2FA.

The main member site contains no `/admin` route. Keep the admin site password private and share it only with administrators.

## Supabase setup

1. For a new Supabase project, apply `supabase/schema.sql`. For an existing project managed with the Supabase CLI, use `supabase/migrations/202611230001_arniygym_security.sql` and `supabase db push`. The schema enables RLS and is safe to apply again.
2. Apply `supabase/migrations/202611230003_production_gym_payments.sql`, then `supabase/migrations/202611230004_localized_content.sql`, then `supabase/migrations/202611230005_news_pwa_push.sql` (news feed, read state, Web Push consent, news image buckets). See the root README section “Zal yangiliklari, PWA va push bildirishnomalar”. Keep the public and admin copies on the same Supabase project and migration version.
3. Add the server-only values from `supabase/.env.example` as Supabase Edge Function secrets. Never put the service role key, bot token, payment signing secret, or private VAPID key in a `VITE_` variable.
4. Deploy the functions from this directory with the Supabase CLI. The bot and each bot-facing Edge Function use separate HMAC secrets plus a signed timestamp. Use unique random values, at least 32 characters long, and set the same value only for the matching bot/function pair.
5. Set `APP_ORIGINS` to the exact comma-separated origins for the member and admin sites. Set `APP_ORIGIN` and `ADMIN_APP_ORIGIN` too if those are used by your deployment. Configure the public Turnstile site key in the member `.env.local` and the private `TURNSTILE_SECRET_KEY` as an Edge Function secret.
6. Add the first verified administrator to `admin_roles` as described in the last lines of the SQL file, and configure the matching Telegram ID in the bot settings.

The database separates workout and diet video metadata from their public catalogs. Only active subscribers and authenticated admins may query those video IDs. `create-video-ticket` checks the active device and subscription before issuing a 15-minute signed Cloudflare Stream HLS URL. Diet lesson files are uploaded from the admin panel with resumable TUS uploads.

## Gemini AI taom tahlili va dieta videolari

- Dieta sahifasida yoki shaxsiy kabinetda taom rasmini yuklang. AI ko‘ringan taomlarni ajratadi, har bir porsiya gramm miqdorini so‘raydi va aniqlashtirish kerak bo‘lsa savol beradi. Tasdiqlangach, porsiya uchun taxminiy kkal va BJU hisoblab, kunlik balansga yozadi.
- AI taom tahlili faol PRO obunada kuniga 5 martagacha ishlaydi. Supabase Dashboard → Edge Functions → Secrets bo‘limiga `GEMINI_API_KEY` va ixtiyoriy `GEMINI_MODEL` (`gemini-3.5-flash`) ni server secret sifatida kiriting; keyin `analyze-food` funksiyasini deploy qiling. Gemini kalitini frontend `.env.local` fayliga yoki `VITE_` o‘zgaruvchisiga qo‘ymang.
- Dieta sahifasida videolar alohida **Ozish** va **Massa yig‘ish** rejalari bo‘yicha chiqadi. Admin panelning **Dieta** bo‘limidan reja tanlab, video faylni Cloudflare Stream’ga yuklang, nom va tavsif kiriting, so‘ng rejani nashr qiling. Ommaviy video havolalari qabul qilinmaydi.

## Telegram bot, payments, and reminders

- Install `telegram_bot/requirements.txt`, copy `telegram_bot/.env.example` to `.env`, then fill in the bot token, bot username, Supabase Functions URL, four unique HMAC secrets, and approved admin Telegram IDs. For production, set a public HTTPS `BOT_WEBHOOK_BASE_URL` and `BOT_WEBHOOK_SECRET`; the bot listens on port 8080 at `/telegram/webhook`. Keep the mounted `data/` directory on persistent storage for short-lived OTP challenges. If the webhook URL is blank, the bot uses long polling for local development.
- Set `PAYMENT_PROVIDER=payme`, `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY`, and `APP_ORIGIN` as Supabase Edge Function secrets. Register `payme-callback` with the merchant. The app checks the actual configured UZS price and exact callback signature, amount, currency, merchant and duplicate payment ID. It cannot make a real payment before a Payme merchant account and production credentials are configured. Official references: [Payme checkout](https://docs.payme.uz/api/create-order/), [signature format](https://docs.payme.uz/api/building-signature/), [callbacks](https://docs.payme.uz/api/callbacks/).
- Lemon Squeezy remains an optional legacy adapter if you already have a store. Its official notice says it no longer accepts new sign-ups and will stop processing transactions on March 31, 2027. The checkout adapter checks variant pricing and the webhook records paid/refunded invoice amounts in the payment ledger ([migration notice](https://docs.lemonsqueezy.com/migration)).
- Configure `CF_ACCOUNT_ID`, `CF_STREAM_API_TOKEN`, and `CF_STREAM_CUSTOMER_CODE` as Supabase Edge Function secrets. Direct TUS uploads mark videos as requiring signed URLs; playback is issued as a 15-minute signed HLS token.
- Create VAPID keys, set the public key in the member app and both private VAPID keys in Supabase. Schedule `send-reminders`, `send-class-reminders` and `send-expiry-reminders` with the reminder secret. Class reminders run within two hours before a session; membership expiry reminders go to push and/or Telegram within the three-day window. Browser permission alone does not create a schedule.
- AI meal analysis uses a Gemini API key stored only as a Supabase Edge Function secret. The function enforces an active subscription and a maximum of five scans per account per day. Set `GEMINI_MODEL` to a model available to your key if the default changes.

## What still needs service credentials

The source includes the application flows, SQL, bot, and Edge Functions. A live payment, OTP, AI, push, or video transaction cannot be verified until the owner supplies and configures the corresponding Supabase, Telegram, Cloudflare, VAPID, and AI service credentials. No private credential is included in the distributable source ZIP.

## Release gates and known limits

- User registration, OTP and payment submissions remain disabled until the site operator completes the legal settings in the admin panel with verified legal identity, contact details, and lawyer-reviewed terms, privacy, refund, and renewal language. Do not mark the legal settings ready with sample text.
- The code includes Payme hosted checkout/callback and a P2P receipt review flow. A live Payme merchant account and credentials are still required. Click and Uzum adapters are not included.
- Confirm with local counsel which data residency rules apply to phone numbers and health-related records before choosing the production database region. The app stores only the data needed for its listed features; do not enable real traffic before that review.
- Cloudflare Stream signed playback and a moving account watermark can reduce casual link sharing. They cannot prevent screen capture. The UI no longer claims that keyboard shortcuts block recording.
- Offline mode caches the app shell only. Login, AI, database writes, checkout, and video playback need an internet connection.
- Push/Telegram reminders require an external scheduler plus configured secrets; the repository does not provision a production cron schedule or uptime monitoring.
- The Uzbek/Russian language switcher and dynamic landing-content fields are included. Legacy copy without a Russian entry falls back to Uzbek, so translate administrator-written content before publishing it in Russian.
- The member and admin frontends remain separate Vite projects for separate deployment origins. Their backend schema and Edge Functions are kept in sync in both project folders; deploy the same migration and function versions to the shared Supabase project.
- The project was build-checked locally. Live Supabase, Telegram, Turnstile, Gemini, Cloudflare Stream, and payment-provider transactions need the operator's credentials and deployed services before they can be verified.


## Sinov video fayli

`test-media/aerobic-exercises-test.webm` — admin panelidagi **Dieta** video yuklash jarayonini sinash uchun qisqa WebM klipi. U `public` papkasidan tashqarida turadi va avtomatik ravishda Cloudflare’ga yuklanmaydi. Manba hamda litsenziya tafsilotlari shu papkadagi `README.md` faylida.
