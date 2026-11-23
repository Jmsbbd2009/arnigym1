# ArniyGym Admin

This is the separate admin web app. It shares the ArniyGym Supabase project with the public member PWA and has no public landing-page route.

## Local setup

1. Copy `.env.example` to `.env.local` and set the same Supabase project URL and publishable/anon key used by the member app.
2. Run `npm ci`, then `npm run dev`.
3. Sign in with the configured administrator email and password, then enter the one-time Telegram 2FA code.

The SQL schema, Edge Functions, and Telegram bot are maintained in the sibling `arniygym` project. After shared backend changes, run `scripts/sync-admin-shared.sh`; it copies the matching schema, migrations and functions without replacing the baseline migration. Apply `supabase/migrations/202611230003_production_gym_payments.sql` and `202611230004_localized_content.sql` in order to the shared Supabase project.

The admin site supports class scheduling, membership QR check-in, freeze approvals, first-session leads, P2P receipt review, automated payment history, and member lookup/export. The Dieta section uploads weight-loss and muscle-gain lessons to Cloudflare Stream. Configure Payme, Cloudflare Stream, Gemini, Telegram, VAPID and other server-only secrets in Supabase Edge Function secrets; never copy them into this frontend.

## Netlify

Deploy this folder as its own Netlify site (build command `npm ci && npm run build`, publish directory `dist`). Enable Netlify Site Password Protection in that site's access settings. The app then applies Supabase admin authentication and Telegram 2FA after the site password gate.

The code is prepared for a separate Netlify site; it has not been deployed because no Netlify account or site credentials were provided.

## Yangiliklar boshqaruvi

**Yangiliklar** bo‘limi (`src/components/AdminNewsManager.tsx`) o‘zbekcha/ruscha yangilik yaratish, tahrirlash, nashr qilish, qoralamaga qaytarish, o‘chirish, 16:9 WebP rasm yuklash va “Saqlangach push yuborish” imkonini beradi. Rasm `news-image`, push esa `news-push` Edge Function orqali o‘tadi; ikkalasi ham faqat admin sessiyasini qabul qiladi. Sozlash bosqichlari ildizdagi `README.md` da, xavfsizlik qoidalari `SECURITY.md` da.
