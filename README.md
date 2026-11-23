# ArniyGym — yagona ishga tushiriladigan to‘plam

Arxivda foydalanuvchilar uchun PWA va alohida admin panel bitta loyiha sifatida jamlangan.

## Ishga tushirish

1. ZIP arxivini oching.
2. Kompyuterda Node.js 18 yoki yangiroq versiyasi o‘rnatilgan bo‘lsin.
3. Terminalni ochib, ochilgan `ArniyGym-Complete` papkasiga kiring.
4. Birinchi marta Linux/macOS’da `chmod +x start.sh` buyrug‘ini bering. Windows’da Git Bash yoki WSL’dan foydalaning.
5. `./start.sh` buyrug‘ini ishga tushiring.

Skript kerakli npm kutubxonalarini birinchi ishga tushirishda o‘zi o‘rnatadi, keyin ikkala ilovani ham boshlaydi:

- Asosiy sayt: <http://localhost:5173>
- Admin panel: <http://localhost:5174>

Agar ushbu portlar band bo‘lsa, skript keyingi bo‘sh localhost portlarini tanlaydi va terminalda haqiqiy manzillarni ko‘rsatadi. Kerak bo‘lsa `ARNIYGYM_PORT` va `ARNIYGYM_ADMIN_PORT` muhit o‘zgaruvchilari bilan portlarni oldindan berish mumkin.

Ikkala ilovani to‘xtatish uchun terminalda `Ctrl+C` bosing.

## Xizmatlarni ulash

Asosiy sayt va admin papkalaridagi `.env.example` fayllarini `.env.local` nomi bilan nusxalab, Supabase URL va ommaviy kalitini kiriting. Gemini AI kalitini va Cloudflare Stream sozlamalarini Supabase Edge Function Secrets bo‘limiga kiriting; Telegram OTP, push xabarnoma va to‘lov sozlamalari ham har bir ilovaning README faylida berilgan. Xususiy kalitlarni manba kodiga yoki ZIP arxiviga qo‘shmang.

Production sozlamalari, Supabase migration’lari, Telegram webhook boti va deploy haqida ma’lumot quyidagi qo‘llanmalarda berilgan.

## Muhim ishga tushirish shartlari

- Lokal ko‘rish uchun Supabase `.env.local` bo‘lmasa, sahifalar ochiladi, ammo login, saqlash, AI, video va to‘lovlar ishlamaydi. `.env.example` fayllari maxfiy kalitlarni o‘z ichiga olmaydi.
- Ommaviy telefon orqali ro‘yxatdan o‘tish va to‘lovni qabul qilish admin panelida operatorning haqiqiy yuridik rekvizitlari, aloqa ma’lumotlari va ko‘rib chiqilgan shartlar kiritilmaguncha ataylab yopiq turadi.
- Mahalliy Payme hosted checkout va callback kodi mavjud. `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY` va `PAYMENT_PROVIDER=payme` Edge Function secrets’da bo‘lmasa, checkout aniq sozlama xatosi bilan yopiladi. P2P cheklar admin sahifasida ham, botda ham ko‘rib chiqiladi.
- Lemon Squeezy yangi ro‘yxatdan o‘tishni to‘xtatganini va 2027-yil 31-martda xizmatni yopishini e’lon qilgan. Mavjud do‘kon uchun eski adapter qoldi; yangi ishga tushirishda Payme yoki boshqa amaldagi provayderdan foydalaning ([rasmiy migratsiya xabari](https://docs.lemonsqueezy.com/migration)).
- Cloudflare imzolangan video oqimi va ko‘chib yuradigan watermark nusxalashni kamaytiradi, lekin ekran yozuvini to‘liq to‘xtatmaydi.
- Telefon va sog‘liq ma’lumotlari saqlanadigan production bazasi hududini tanlashdan oldin mahalliy yurist bilan ma’lumotlarni saqlash talablarini tekshiring.
- To‘lov, SMS/Telegram kirish va ro‘yxatdan o‘tish yurist ko‘rib chiqqan oferta, qaytarish sharti, maxfiylik, saqlash maqsadi va muddati admin sozlamalarida to‘liq kiritilmaguncha ochilmaydi.

## Production deploy

1. Yangi Supabase loyihasida `arniygym/supabase/schema.sql` ni qo‘llang. Mavjud loyihada `202611230003_production_gym_payments.sql`, `202611230004_localized_content.sql`, keyin `202611230005_news_pwa_push.sql` migration’larini tartib bilan qo‘llang. Ular to‘lov ledger’i, Payme callbacks, zal jadvali, QR check-in, muzlatish, eslatmalar hamda tarif va yangiliklar uchun ruscha maydonlarni qo‘shadi. Admin nusxasida aynan shu migration’lar bor.
2. Supabase Edge Functions secrets’ga `PAYMENT_PROVIDER=payme`, `PAYME_MERCHANT_ID`, `PAYME_SECRET_KEY`, `GYM_QR_SIGNING_SECRET` (kamida 32 belgi), `APP_ORIGIN`, `GYM_LEADS_CHAT_ID`, `PUSH_REMINDER_SECRET`, `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` hamda mavjud OTP/Gemini/Cloudflare sirlarini kiriting. Xususiy qiymatlarni `.env.local` yoki `VITE_` o‘zgaruvchisiga yozmang.
3. `news-image`, `news-push`, `push-subscribe`, `payment-checkout`, `payme-callback`, `p2p-submit`, `membership-ticket`, `membership-checkin`, `freeze-review`, `gym-booking`, `gym-intro-request`, `export-user-data`, `send-class-reminders` va `send-expiry-reminders` Edge Functions’ni deploy qiling.
4. Payme merchant kabinetida callback URL’ni `https://<SUPABASE_PROJECT>.supabase.co/functions/v1/payme-callback` qilib ro‘yxatdan o‘tkazing. Payme checkout va callback imzosi, summa (tiyin), merchant ID va takroriy hodisalar serverda tekshiriladi. Haqiqiy merchant kalitisiz karta orqali jonli tranzaksiya sinab bo‘lmaydi ([checkout API](https://docs.payme.uz/api/create-order/), [imzo qoidasi](https://docs.payme.uz/api/building-signature/), [callback talablari](https://docs.payme.uz/api/callbacks/)).
5. `scripts/sync-admin-shared.sh` umumiy komponent, schema, migration va Edge Function nusxalarini admin papkasiga ko‘chiradi; u eski migration’ni bosib yozmaydi. Uni umumiy kod o‘zgarganidan keyin ishga tushiring.
6. Telegram bot uchun `arniygym/telegram_bot/.env.example` nusxasini `.env` qilib, webhook deploy’da `BOT_WEBHOOK_BASE_URL` (HTTPS) va alohida 32+ belgili `BOT_WEBHOOK_SECRET` kiriting. Reverse proxy `/telegram/webhook` yo‘lini 8080 portga yo‘naltirsin. URL bo‘sh bo‘lsa polling faqat lokal ishlab chiqish uchun ishlaydi.
7. Scheduler’dan `send-class-reminders` ni har 15 daqiqada, `send-expiry-reminders` ni kuniga bir marta `x-reminder-secret: PUSH_REMINDER_SECRET` sarlavhasi bilan chaqiring. Scheduler, merchant credentials va production domeni bu ZIP’da oldindan ulangan emas.
8. Deploydan oldin admin panelida operator rekvizitlari, maxfiylik va saqlash muddatlari, oferta/qaytarish shartlari hamda galereya/ish vaqti/manzil kabi haqiqiy ma’lumotlarni kiriting. Database hududini mahalliy yurist xulosasidan keyin tanlang.


## Sinov videosi

Sinab ko‘rish uchun qisqa klip `arniygym/test-media/aerobic-exercises-test.webm` ichida. Admin panelidagi **Dieta** video yuklash oynasidan uni tanlang. Klip test uchun; Cloudflare Stream’ga avtomatik yuklanmaydi. Manba va litsenziya ma’lumoti video yonidagi `README.md` faylida.

## Dizayn va ikonlar

Interfeys qora-grafit fon, ArniyGym qizil aksenti, murabbiy portretlari va telefon ekraniga mos navigatsiya bilan yangilandi. Ikonlar Bootstrap Icons’dan olinadi va npm paketi orqali ilova ichida saqlanadi; alohida CDN ulanishi talab qilinmaydi.

## Zal yangiliklari, PWA va push bildirishnomalar

### Nima qo‘shildi

- **Yangiliklar tasmasi** (`/news`, `/news/<id>`): bosh sahifada so‘nggi 3 ta yangilik, pastki navigatsiyada “Yangiliklar” bo‘limi va o‘qilmaganlar soni (badge). Kategoriyalar: umumiy, jadval, aksiya, jihozlar. Qadalgan yangiliklar yuqorida, keyin e’lon sanasi bo‘yicha tartiblanadi. Rasm 16:9 WebP ko‘rinishida chiqadi. Yuklanish, bo‘sh holat, xato va “Qayta urinish” holatlari bor.
- **O‘zbekcha / ruscha**: har yangilikda alohida ruscha sarlavha va matn. Tarjima bo‘lmasa o‘zbekcha matn ko‘rsatiladi. `lang` va `hreflang` mavjud til tizimi orqali yangilanadi.
- **A’zolar uchun yangiliklar** faqat serverda tekshirilgan amaldagi obunaga ko‘rinadi (`has_active_subscription()` RLS funksiyasi, muzlatilgan a’zolik hisobga olinadi). Frontenddagi `is_premium` kabi qiymatlarga ishonilmaydi. Bunday yangiliklar rasmi yopiq `news-images-members` bucket’ida turadi va 1 soatlik imzolangan havola bilan ochiladi.
- **O‘qilgan holat**: kirgan foydalanuvchida `news_reads` jadvalida (faqat o‘z yozuvlari, RLS), mehmonda brauzerning `localStorage`’ida. Foydalanuvchilar holati aralashmaydi.
- **PWA**: manifest nomi `ArniyGym`, `standalone`, `#09090B` rang, 192/512 va alohida maskable ikonlar, “Yangiliklar” yorlig‘i. Service worker ilova qobig‘ini va **faqat ommaviy** yangiliklar so‘rovini (`is_members_only=eq.false`) hamda ommaviy rasmlarni keshlaydi. A’zolar yangiliklari, imzolangan havolalar, cheklar, video va Edge Function javoblari hech qachon keshga yozilmaydi.
- **O‘rnatish taklifi** (`InstallPWA.tsx`): Android/Chrome’da `beforeinstallprompt` saqlanadi va o‘zimizning banner chiqadi; iOS Safari’da Ulashish → “Bosh ekranga” yo‘riqnomasi; Telegram/Instagram ichki brauzerida “brauzerda oching” ko‘rsatmasi. Ilova o‘rnatilgan (standalone) bo‘lsa yoki foydalanuvchi rad etsa ko‘rsatilmaydi (14 kun kutadi, 2 marta rad etilsa butunlay to‘xtaydi).
- **Admin panel → Yangiliklar** (`AdminNewsManager.tsx`): yaratish, tahrirlash, nashr qilish, qoralamaga qaytarish, o‘chirish; o‘zbekcha/ruscha maydonlar, belgilar hisoblagichi va cheklovlar; kategoriya, qadash, faqat a’zolar uchun; rasm tanlash, oldindan ko‘rish, almashtirish, olib tashlash; “Saqlangach push yuborish”; keraksiz rasmlarni tozalash; har bir yangilik uchun oxirgi push natijasi.
- **Rasm yuklash**: brauzerda haqiqiy MIME va fayl imzosi (JPEG/PNG/WebP) tekshiriladi, 2 MB chegarasi, markazdan 16:9 qirqiladi, 1280×720 gacha WebP’ga siqiladi va yakuniy hajm qayta tekshiriladi. `news-image` Edge Function admin huquqini, MIME, imzo, hajm va 16:9 o‘lchamni yana tekshiradi; bucket ham faqat JPEG/PNG/WebP va 2 MB ni qabul qiladi.
- **Push**: faqat foydalanuvchi tugmani bosib, brauzer ruxsatini bergandan keyin obuna yaratiladi (`consent: true`). Obuna foydalanuvchi ID’siga bog‘lanadi, boshqa akkauntga o‘tilganda brauzer obunasi bekor qilinadi. `news-push` faqat admin so‘rovini qabul qiladi, faqat saqlangan va e’lon qilingan yangilik uchun yuboradi, ommaviy yangilik — barcha rozilik bergan qurilmalarga, a’zolar yangiligi — faqat amaldagi obunachilarga. 404/410 qaytgan obunalar o‘chiriladi, boshqa xatolar hisoblanadi (5 marta xato bo‘lsa chetlatiladi). Push xatosi saqlangan yangilikka ta’sir qilmaydi, natija adminga ko‘rsatiladi. Bildirishnoma bosilganda ilovada aynan o‘sha yangilik ochiladi.

### Ishga tushirish tartibi

1. **Migration**: mavjud bazada `arniygym/supabase/migrations/202611230005_news_pwa_push.sql` ni SQL Editor’da ishga tushiring (yoki `supabase db push`). U idempotent: eski `featured` ustunini `is_pinned` ga o‘tkazadi, eski kategoriyalarni (`Zal e’loni`, `Ish vaqti`, `Aksiya`, `Yangi trenajyor`) yangi kalitlarga ko‘chiradi, ikkinchi “news” jadvalini yaratmaydi. Yangi bazada `schema.sql` yetarli.
2. **VAPID kalitlari**: `npx web-push generate-vapid-keys` bilan yarating.
   - GitHub → Settings → Secrets and variables → Actions → **Variables**: `VITE_VAPID_PUBLIC_KEY=<public key>`.
   - Supabase → Edge Functions → Secrets: `VAPID_SUBJECT=mailto:siz@domen.uz`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Xususiy kalit hech qachon `VITE_` bilan boshlanmasin.
3. **Edge Functions deploy**: `supabase functions deploy news-image news-push push-subscribe` (ular `config.toml`’da `verify_jwt=false`, chunki ichida sessiya, faol qurilma va admin roli alohida tekshiriladi).
4. **GitHub Pages deploy**: `main` branchga har push’da `.github/workflows/pages.yml` ikkala ilovani yig‘ib, GitHub Pages’ga chiqaradi: sayt — `https://<owner>.github.io/<repo>/`, admin — `https://<owner>.github.io/<repo>/admin/`. Repo → Settings → Pages → Source: **GitHub Actions**. `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` workflow’da standart qiymatga ega, kerak bo‘lsa Actions Variables orqali almashtiriladi. Supabase Vault’dagi `APP_ORIGINS` sayt domenini (`https://<owner>.github.io`) o‘z ichiga olsin (CORS), `APP_ORIGIN` esa to‘liq sayt manzili (`https://<owner>.github.io/<repo>`). Boshqa domen yoki ildiz yo‘lda ishlatish uchun build’da `BASE_PATH=/` qo‘ying.
5. **Push ruxsati**: foydalanuvchi “Yangiliklar” sahifasida “Bildirishnomani yoqish” tugmasini bosadi. iPhone’da push faqat ilova bosh ekranga qo‘shilgandan keyin (iOS 16.4+) ishlaydi — sahifa buni o‘zi tushuntiradi.
6. **Lokal ishga tushirish**: `./start.sh` (asosiy sayt `http://localhost:5173`, admin `http://localhost:5174`). Service worker `npm run build && npm run preview` rejimida to‘liq ishlaydi.

### Tekshiruvlar

- `cd arniygym && npm run typecheck && npm run build`, admin uchun ham xuddi shunday.
- `cd arniygym && deno test -A supabase/tests/news_image_test.ts` — server rasm tekshiruvi.
- `psql` bilan: `supabase/tests/supabase_stub.sql` (faqat lokal test bazasi uchun!), keyin `schema.sql`, keyin `supabase/tests/news_rls_test.sql` — mehmon/faol a’zo/muddati o‘tgan a’zo/admin RLS testlari.
- `tests/e2e/run.sh` — soxta (mock) Supabase bilan brauzer testlari: tasma, badge, offline kesh siyosati, iOS o‘rnatish yo‘riqnomasi, admin WebP konveyeri.

Batafsil xavfsizlik qoidalari: [SECURITY.md](SECURITY.md).

