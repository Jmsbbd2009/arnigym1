import asyncio
import hashlib
import hmac
import json
import logging
import os
import secrets
import sqlite3
import time
from pathlib import Path
from pathlib import PurePosixPath

import httpx
from aiohttp import web
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, Message, ReplyKeyboardMarkup, ReplyKeyboardRemove
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("arniygym-bot")
TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
FUNCTIONS = os.environ["SUPABASE_FUNCTIONS_URL"].rstrip("/")
BOT_SECRETS = {
    "telegram-contact": os.environ["BOT_OTP_SECRET"],
    "bot-pending-admins": os.environ["BOT_ADMIN_SECRET"],
    "bot-pending-payments": os.environ["BOT_QUEUE_SECRET"],
    "p2p-review": os.environ["BOT_P2P_SECRET"],
}
ADMIN_IDS = {int(value.strip()) for value in os.getenv("ADMIN_TELEGRAM_IDS", "").split(",") if value.strip().isdigit()}
POLL_SECONDS = int(os.getenv("P2P_POLL_SECONDS", "25"))
STATE_DB = Path(os.getenv("BOT_STATE_DB", "data/bot_state.sqlite"))
STATE_DB.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(STATE_DB) as connection:
    connection.execute("CREATE TABLE IF NOT EXISTS pending_challenges (telegram_user_id INTEGER PRIMARY KEY, token TEXT NOT NULL, expires_at INTEGER NOT NULL)")
router = Router()

def signed_headers(endpoint: str, body: bytes):
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(32)
    digest = hashlib.sha256(body).hexdigest()
    message = f"{timestamp}.{endpoint}.{digest}.{nonce}".encode()
    signature = hmac.new(BOT_SECRETS[endpoint].encode(), message, hashlib.sha256).hexdigest()
    return {"x-bot-timestamp": timestamp, "x-bot-nonce": nonce, "x-bot-signature": signature, "content-type": "application/json"}

async def call_function(name: str, payload: dict | None = None):
    body = json.dumps(payload or {}, ensure_ascii=False, separators=(",", ":")).encode()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(f"{FUNCTIONS}/{name}", headers=signed_headers(name, body), content=body)
        response.raise_for_status()
        return response.json()

@router.message(CommandStart())
async def start(message: Message):
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await message.answer("ArniyGym’ga xush kelibsiz. Kirishni saytdagi tugma orqali boshlang.")
        return
    with sqlite3.connect(STATE_DB) as connection:
        connection.execute("INSERT INTO pending_challenges(telegram_user_id,token,expires_at) VALUES(?,?,?) ON CONFLICT(telegram_user_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at", (message.from_user.id, args[1], int(time.time()) + 180))
    keyboard = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text="📱 Raqamni yuborish", request_contact=True)]], resize_keyboard=True, one_time_keyboard=True)
    await message.answer("Kirishni tasdiqlash uchun ArniyGym’da kiritgan telefon raqamingizni o‘zingizning Telegram kontaktingiz sifatida yuboring.", reply_markup=keyboard)

@router.message(F.contact)
async def contact(message: Message):
    with sqlite3.connect(STATE_DB) as connection:
        row = connection.execute("SELECT token,expires_at FROM pending_challenges WHERE telegram_user_id=?", (message.from_user.id,)).fetchone()
        challenge = row[0] if row and row[1] >= int(time.time()) else None
    contact_obj = message.contact
    if not challenge:
        await message.answer("Avval saytdan kirish so‘rovini boshlang.", reply_markup=ReplyKeyboardRemove())
        return
    if contact_obj.user_id != message.from_user.id:
        await message.answer("Faqat o‘zingizning Telegram kontaktingizni yuboring.")
        return
    phone = contact_obj.phone_number.strip()
    if not phone.startswith("+"):
        phone = "+" + phone
    try:
        result = await call_function("telegram-contact", {"challengeToken": challenge, "phone": phone, "telegramUserId": message.from_user.id, "contactUserId": contact_obj.user_id, "displayName": message.from_user.full_name})
        with sqlite3.connect(STATE_DB) as connection:
            connection.execute("DELETE FROM pending_challenges WHERE telegram_user_id=?", (message.from_user.id,))
        await message.answer(f"ArniyGym kirish kodingiz: <code>{result['code']}</code>\nKod 3 daqiqa amal qiladi. Uni faqat ArniyGym sahifasiga kiriting.", parse_mode="HTML", reply_markup=ReplyKeyboardRemove())
    except httpx.HTTPStatusError as exc:
        log.warning("OTP request rejected: %s", exc.response.text[:200])
        await message.answer("Raqam mos kelmadi yoki kirish so‘rovi eskirdi. Saytga qaytib, yangi urinish boshlang.", reply_markup=ReplyKeyboardRemove())
    except Exception:
        log.exception("OTP issue failed")
        await message.answer("Kodni yuborib bo‘lmadi. Birozdan keyin qaytadan urinib ko‘ring.", reply_markup=ReplyKeyboardRemove())

@router.callback_query(F.data.startswith("p2p:"))
async def review_payment(query: CallbackQuery, bot: Bot):
    if query.from_user.id not in ADMIN_IDS:
        await query.answer("Bu amal faqat tasdiqlangan admin uchun.", show_alert=True)
        return
    _, action, payment_id = query.data.split(":", 2)
    state = "approved" if action == "yes" else "rejected"
    try:
        result = await call_function("p2p-review", {"paymentId": payment_id, "status": state, "note": "Telegram orqali ko‘rib chiqildi", "reviewerTelegramId": str(query.from_user.id)})
        await query.message.edit_reply_markup(reply_markup=None)
        await query.message.answer(f"✅ Chek #{payment_id[:8]} {('tasdiqlandi' if state == 'approved' else 'rad etildi')}.")
        telegram_id = result.get("telegramUserId")
        if telegram_id:
            await bot.send_message(telegram_id, "To‘lovingiz tasdiqlandi. Obunangiz faollashtirildi." if state == "approved" else "Chekingiz rad etildi. Tafsilot uchun qo‘llab-quvvatlashga yozing.")
        await query.answer(result.get("message", "Saqlandi"))
    except Exception:
        log.exception("P2P review failed")
        await query.answer("Chekni yangilab bo‘lmadi.", show_alert=True)

async def poll_receipts(bot: Bot):
    await asyncio.sleep(4)
    while True:
        try:
            if ADMIN_IDS:
                result = await call_function("bot-pending-payments")
                for payment in result.get("payments", []):
                    tg_id = payment.get("telegramUserId")
                    keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✅ Tasdiqlash", callback_data=f"p2p:yes:{payment['id']}"), InlineKeyboardButton(text="❌ Rad etish", callback_data=f"p2p:no:{payment['id']}")]])
                    caption = f"ArniyGym P2P chek\n#{payment['id'][:8]} · {int(payment['amount_uzs']):,} UZS\nTarif: {payment['plan_key']}\nTelegram ID: {tg_id or 'noma’lum'}"
                    url = payment.get("receiptUrl")
                    for chat_id in ADMIN_IDS:
                        if url and PurePosixPath(payment.get("receipt_path", "")).suffix.lower() == ".pdf":
                            await bot.send_document(chat_id, url, caption=caption, reply_markup=keyboard)
                        elif url:
                            await bot.send_photo(chat_id, url, caption=caption, reply_markup=keyboard)
                        else:
                            await bot.send_message(chat_id, caption + "\nChek fayli topilmadi.", reply_markup=keyboard)
            admin_result = await call_function("bot-pending-admins")
            for challenge in admin_result.get("challenges", []):
                try:
                    await bot.send_message(int(challenge["telegramUserId"]), f"ArniyGym admin kirish kodi: <code>{challenge['code']}</code>\nKod 3 daqiqa amal qiladi.", parse_mode="HTML")
                except Exception:
                    log.exception("Could not deliver admin OTP")
        except Exception:
            log.exception("P2P poll failed")
        await asyncio.sleep(POLL_SECONDS)

async def main():
    bot = Bot(TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    poll_task = asyncio.create_task(poll_receipts(bot))
    webhook_base = os.getenv("BOT_WEBHOOK_BASE_URL", "").strip().rstrip("/")
    try:
        if webhook_base:
            webhook_secret = os.getenv("BOT_WEBHOOK_SECRET", "")
            if not webhook_base.startswith("https://"):
                raise ValueError("BOT_WEBHOOK_BASE_URL must use HTTPS")
            if not (32 <= len(webhook_secret) <= 256) or not all(char.isalnum() or char in "_-" for char in webhook_secret):
                raise ValueError("BOT_WEBHOOK_SECRET must be 32-256 letters, digits, '_' or '-'")
            path = "/telegram/webhook"
            app = web.Application(client_max_size=1024 * 1024)
            SimpleRequestHandler(dispatcher=dp, bot=bot, secret_token=webhook_secret).register(app, path=path)
            setup_application(app, dp, bot=bot)
            runner = web.AppRunner(app)
            await runner.setup()
            await bot.set_webhook(
                f"{webhook_base}{path}",
                secret_token=webhook_secret,
                allowed_updates=dp.resolve_used_update_types(),
                drop_pending_updates=False,
            )
            site = web.TCPSite(runner, os.getenv("BOT_WEBHOOK_HOST", "0.0.0.0"), int(os.getenv("BOT_WEBHOOK_PORT", "8080")))
            await site.start()
            log.info("Telegram webhook listening on %s", path)
            try:
                await asyncio.Event().wait()
            finally:
                await runner.cleanup()
        else:
            log.warning("BOT_WEBHOOK_BASE_URL is empty; using long polling for local development")
            await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        poll_task.cancel()
        await asyncio.gather(poll_task, return_exceptions=True)
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
