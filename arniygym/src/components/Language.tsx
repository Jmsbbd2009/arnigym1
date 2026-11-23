import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'uz' | 'ru';
type LanguageContextValue = { language: AppLanguage; setLanguage: (language: AppLanguage) => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

const translations: Array<[string, string]> = [
  ['Asosiy', 'Главная'], ['Dieta', 'Питание'], ['Mashqlar', 'Тренировки'], ['Zal', 'Зал'], ['Tariflar', 'Тарифы'], ['Biz haqimizda', 'О нас'],
  ['Kirish', 'Войти'], ['Ro‘yxatdan o‘tish', 'Регистрация'], ['Ro‘yxat', 'Регистрация'], ['Ro‘yxatdan o‘ting.', 'Зарегистрируйтесь.'], ['TELEGRAM ORQALI RO‘YXATDAN O‘TISH', 'РЕГИСТРАЦИЯ ЧЕРЕЗ TELEGRAM'], ['FAQAT A’ZOLAR UCHUN', 'ТОЛЬКО ДЛЯ УЧАСТНИКОВ'], ['Avval hisobingizga kiring.', 'Сначала войдите в аккаунт.'], ['Yangiliklar, ovqatlanish, mashqlar va zal bo‘limlari ro‘yxatdan o‘tgan a’zolarga ochiladi. Ro‘yxatdan o‘tish telefon raqam va Telegram orqali bir daqiqada bo‘ladi.', 'Новости, питание, тренировки и раздел зала доступны зарегистрированным участникам. Регистрация по номеру телефона через Telegram занимает минуту.'], ['Telefon raqamingizni kiriting. Telegram bot raqamni tasdiqlaydi va hisobingiz avtomatik ochiladi.', 'Введите номер телефона. Telegram-бот подтвердит номер, и аккаунт откроется автоматически.'], ['Mamlakatni tanlab, telefon raqamini to‘liq kiriting.', 'Выберите страну и введите номер полностью.'], ['Profil', 'Профиль'], ['Kuchli tana.', 'Сильное тело.'], ['Aniq natija.', 'Заметный результат.'],
  ['Kirish va boshlash', 'Войти и начать'], ['Zal manzili', 'Адрес зала'], ['Mashqlar', 'Упражнения'], ['Ovqatlanish', 'Питание'], ['Progress', 'Прогресс'],
  ['Mushak guruhlari bo‘yicha', 'По группам мышц'], ['Massa yoki ozish maqsadi', 'Цель: набор массы или похудение'], ['O‘zing qayd etgan natija', 'Результаты, которые вы отмечаете'],
  ['Mashg‘ulot jadvali', 'Расписание тренировок'], ['Sig‘im cheklangan. To‘lsa kutish ro‘yxati ishlaydi.', 'Количество мест ограничено. При заполнении включается лист ожидания.'],
  ['Kiraverish uchun QR', 'QR-код для входа'], ['Faol a’zolik talab qilinadi', 'Требуется активное членство'], ['A’zolik faol emas', 'Членство неактивно'], ['A’zolik faol', 'Членство активно'],
  ['A’zolikni vaqtincha muzlatish', 'Временно заморозить членство'], ['Admin tasdiqlagach, tanlangan kunlar muddatga qo‘shiladi.', 'После одобрения администратором срок членства будет продлён на выбранное число дней.'],
  ['Kunlar', 'Дни'], ['Sabab (ixtiyoriy)', 'Причина (необязательно)'], ['Muzlatish so‘rovini yuborish', 'Отправить запрос на заморозку'], ['Kirish tarixi', 'История посещений'],
  ['Zalga kirish tarixi', 'История посещений зала'], ['Oxirgi tashriflar', 'Последние посещения'], ['Hali zalga kirish qaydi yo‘q.', 'Посещений пока нет.'],
  ['Yozilish', 'Записаться'], ['Bekor', 'Отменить'], ['Kutish ro‘yxati', 'Лист ожидания'], ['YOZILGANSIZ', 'ВЫ ЗАПИСАНЫ'], ['Hozircha kelgusi mashg‘ulot jadvali e’lon qilinmagan.', 'Расписание будущих тренировок пока не опубликовано.'],
  ['Zalingdagi', 'Твой'], ['rejang.', 'план в зале.'], ['Mashg‘ulotlarga yozil, eshikda qisqa muddatli QR kodingni ko‘rsat va a’zolikni boshqar.', 'Записывайся на тренировки, показывай на входе краткосрочный QR-код и управляй членством.'],
  ['Kuchli tana va sog‘lom odatlar.', 'Сильное тело и здоровые привычки.'], ['Kuchli tana. Aniq natija.', 'Сильное тело. Заметный результат.'],
  ['ArniyGym — Kuchliroq har kun', 'ArniyGym — Сильнее каждый день'], ['ArniyGym — Fitnes platformasi', 'ArniyGym — фитнес-платформа'],
  ['Dieta va AI taom tahlili — ArniyGym', 'Питание и анализ еды с ИИ — ArniyGym'], ['Mashqlar — ArniyGym', 'Тренировки — ArniyGym'], ['Tariflar — ArniyGym', 'Тарифы — ArniyGym'],
  ['Foydalanish shartlari — ArniyGym', 'Условия использования — ArniyGym'], ['Maxfiylik — ArniyGym', 'Конфиденциальность — ArniyGym'], ['To‘lov va bekor qilish — ArniyGym', 'Оплата и отмена — ArniyGym'],
  ['ArniyGym — fitnes va mashg‘ulot platformasi', 'ArniyGym — фитнес-платформа и тренировки'], ['Mashqlar, ovqatlanish va zal yangiliklarini bir joyda kuzating.', 'Следите за тренировками, питанием и новостями зала в одном месте.'],
  ['Mushak guruhlari bo‘yicha mashqlar, videodarslar va maqsadga mos ovqatlanish vositalari. Har bir qadamda izchil yondashuv.', 'Тренировки по группам мышц, видеоуроки и питание с учётом вашей цели. Последовательный подход на каждом шаге.'],
  ['Mushak guruhini tanla, texnikani o‘rgan va to‘plar orasida dam olishni boshqar.', 'Выбери группу мышц, изучай технику и контролируй отдых между подходами.'],
  ['Harakatni', 'Начинаем'], ['boshlaymiz.', 'двигаться.'], ['Sening maqsading.', 'Твоя цель.'], ['Sening rejang.', 'Твой план.'],
  ['Mashq videolari, ovqatlanish yo‘riqnomalari va progress kuzatuviga to‘liq kirish.', 'Полный доступ к видео тренировок, рекомендациям по питанию и отслеживанию прогресса.'],
  ['To‘lovlar hozircha yopiq: sayt operatori, aloqa ma’lumotlari va yakuniy oferta/maxfiylik/qaytarish shartlari kiritilmagan.', 'Оплата пока отключена: необходимо указать оператора, контакты и окончательные условия оферты, конфиденциальности и возврата.'],
  ['Chek yuborish', 'Отправить чек'], ['Hozircha yopiq', 'Пока недоступно'], ['Uzcard yoki Humo', 'Uzcard или Humo'],
  ['Chek yuborish faqat to‘lov shartlari to‘liq e’lon qilingach yoqiladi. P2P a’zolik avtomatik uzaytirilmaydi.', 'Отправка чеков станет доступна после публикации условий оплаты. Членство P2P автоматически не продлевается.'],
  ['Barcha mashq videolari', 'Все видео тренировок'], ['Nashr qilingan dieta menyulari', 'Опубликованные планы питания'], ['AI taom tahlili (kunlik limit bilan)', 'Анализ еды с ИИ (дневной лимит)'], ['Vazn, suv va kaloriya hisoboti', 'Отслеживание веса, воды и калорий'],
  ['Tarif sozlanmagan', 'Тариф не настроен'], ['Oylik tarifni tanlash', 'Выбрать месячный тариф'], ['Yillik tarifni tanlash', 'Выбрать годовой тариф'], ['To‘lov vaqtincha yopiq', 'Оплата временно отключена'],
  ['Kuchliroq har kun', 'Сильнее каждый день'], ['Bepul boshlash', 'Начать бесплатно'], ['OMMABOP', 'ПОПУЛЯРНЫЙ'], ['Rejangga mos, ortiqcha murakkabliksiz.', 'Подходит вашему плану, без лишней сложности.'],
  ['TELEGRAM ORQALI KIRISH', 'ВХОД ЧЕРЕЗ TELEGRAM'], ['Hisobingga kir.', 'Войдите в аккаунт.'], ['Tasdiqlash kodi.', 'Код подтверждения.'],
  ['Telefon raqamingni kiriting. Bot raqamni tekshirib, bir martalik kod yuboradi.', 'Введите номер телефона. Бот проверит номер и отправит одноразовый код.'],
  ['Telegram botdagi chatdan 6 xonali kodni kiriting. Kod 3 daqiqa amal qiladi.', 'Введите 6-значный код из чата с ботом Telegram. Код действует 3 минуты.'],
  ['Telefon raqam', 'Номер телефона'], ['Telegram botni ochish', 'Открыть бота Telegram'], ['Tasdiqlash', 'Подтвердить'], ['Boshqa raqamdan kirish', 'Войти с другим номером'],
  ['Foydalanish shartlari', 'Условия использования'], ['Maxfiylik siyosati', 'Политика конфиденциальности'], ['To‘lov va bekor qilish', 'Оплата и отмена'],
  ['Obuna va to‘lovlar', 'Членство и платежи'], ['Avtomatik to‘lov tarixi', 'История автоматических платежей'], ['P2P chek tarixi', 'История чеков P2P'], ['Ma’lumotlarni eksport qilish', 'Экспортировать данные'],
  ['Birinchi mashg‘ulotga yozilish', 'Записаться на первую тренировку'], ['Ismingiz', 'Ваше имя'], ['Telefon', 'Телефон'], ['Arizani yuborish', 'Отправить заявку'],
  ['Manzil', 'Адрес'], ['Ish vaqti', 'Часы работы'], ['Rasmiy kanal', 'Официальный канал'], ['Rasmiy sahifa', 'Официальная страница'],
  ['Yangi mashg‘ulot', 'Новая тренировка'], ['Yangi zal yangiliklari', 'Новости зала'], ['Yangiliklar', 'Новости'], ['Savol-javob', 'Вопросы и ответы'],
  ['Vazn', 'Вес'], ['Bo‘y', 'Рост'], ['Yosh', 'Возраст'], ['Faollik', 'Активность'], ['Ozish', 'Похудение'], ['Massa', 'Набор массы'], ['Kaloriya va BJU hisobla.', 'Рассчитать калории и БЖУ.'],
  ['KUNLIK TAVSIYA', 'РЕКОМЕНДАЦИЯ НА ДЕНЬ'], ['OQSIL', 'БЕЛКИ'], ['YOG‘', 'ЖИРЫ'], ['UGLEVOD', 'УГЛЕВОДЫ'], ['Erkak', 'Мужчина'], ['Ayol', 'Женщина'],
  ['Bugungi qadamlar', 'Шаги за сегодня'], ['Kundalik eslatmalar', 'Ежедневные напоминания'], ['Eslatmalar uchun Telegram orqali kiring.', 'Войдите через Telegram, чтобы включить напоминания.'],
  ['Qidirish', 'Поиск'], ['Sevimlilar', 'Избранное'], ['Barcha mashqlar', 'Все тренировки'], ['Yopish', 'Закрыть'],
  ['Barcha mashqlar', 'Все упражнения'], ['Mushak guruhini tanlang', 'Выберите группу мышц'], ['Mushaklar', 'Мышцы'], ['MASHQLAR', 'ТРЕНИРОВКИ'],
  ['Ovqat rasmini tahlil qilish', 'Анализ фото еды'], ['Taom rasmini yuklang', 'Загрузите фото блюда'], ['Rasm yuklash', 'Загрузить фото'], ['AI tahlilini boshlash', 'Начать анализ ИИ'],
  ['Tahlil qilinmoqda…', 'Идёт анализ…'], ['Taom nomi', 'Название блюда'], ['Porsiya (gramm)', 'Порция (граммы)'], ['Gramm miqdorini kiriting', 'Укажите вес в граммах'],
  ['Aniqlashtiring', 'Уточните'], ['Natijani tasdiqlash', 'Подтвердить результат'], ['Kunlik kaloriya maqsadi', 'Дневная цель по калориям'], ['Bugungi ovqatlar', 'Сегодняшние блюда'],
  ['Ozish rejasi', 'План похудения'], ['Massa yig‘ish rejasi', 'План набора массы'], ['Massa yig‘ish', 'Набор массы'], ['Ozish uchun', 'Для похудения'], ['Massa uchun', 'Для набора массы'],
  ['Videoni ko‘rish', 'Смотреть видео'], ['Video hozircha mavjud emas', 'Видео пока недоступно'], ['Mavjud videolar', 'Доступные видео'], ['Darslar', 'Уроки'], ['Dieta menyusi', 'План питания'],
  ['Kunlik menyu', 'Меню на день'], ['Qanday qilish kerak?', 'Как выполнять?'], ['Ko‘rsatma', 'Инструкция'], ['Tavsiyalar', 'Рекомендации'],
  ['Dam olish taymeri', 'Таймер отдыха'], ['Dam olish', 'Отдых'], ['Keyingi set', 'Следующий подход'], ['Qayta boshlash', 'Сбросить'], ['Boshlash', 'Начать'], ['To‘xtatish', 'Остановить'],
  ['Suv nazorati', 'Контроль воды'], ['Suv qo‘shish', 'Добавить воду'], ['Vazn qaydi', 'Запись веса'], ['Vazn progressi', 'Прогресс веса'], ['Haftalik progress', 'Прогресс за неделю'],
  ['Ma’lumotlarni eksport qilish', 'Экспортировать данные'], ['Hisobni o‘chirish', 'Удалить аккаунт'], ['Obunani bekor qilish', 'Отменить подписку'],
  ['Telefon raqamim kirish uchun qayta ishlanishiga va', 'Согласен на использование моего номера для входа и'], ['foydalanish shartlariga', 'условиями использования'], ['hamda', 'и'], ['maxfiylik siyosatiga roziman.', 'политикой конфиденциальности.'],
  ['Botdagi “Raqamni yuborish” tugmasini bosing…', 'Нажмите кнопку «Отправить номер» в боте…'], ['Telegram botdagi tasdiq kodi kutilmoqda…', 'Ожидаем код подтверждения от бота Telegram…'],
  ['Hisobni o‘chirishdan oldin faol obunani bekor qiling yoki muddati tugashini kuting.', 'Перед удалением аккаунта отмените активную подписку или дождитесь окончания срока.'],
  ['Faol obuna', 'Активное членство'], ['Faol a’zolik', 'Активное членство'], ['Yillik PRO', 'PRO на год'], ['Oylik PRO', 'PRO на месяц'], ['Admin bergan', 'Назначено администратором'],
  ['Chekni yubor.', 'Отправить чек.'], ['Tarif', 'Тариф'], ['To‘lov cheki', 'Квитанция об оплате'], ['Chekni ko‘rish', 'Открыть чек'],
  ['Tasdiqlangan', 'Подтверждено'], ['Rad etilgan', 'Отклонено'], ['Kutilmoqda', 'Ожидает проверки'], ['Saqlash', 'Сохранить'], ['Saqlanmoqda…', 'Сохранение…'], ['Yuborilmoqda…', 'Отправка…'],
  ['Qayta urinib ko‘ring.', 'Попробуйте ещё раз.'], ['Ma’lumotlar yuklanmadi.', 'Не удалось загрузить данные.'], ['So‘rov muvaffaqiyatsiz.', 'Запрос не выполнен.'],
  ['Qulay vaqt yoki savol', 'Удобное время или вопрос'], ['Ism familiya', 'Имя и фамилия'], ['Ariza qabul qilindi.', 'Заявка принята.'], ['Ariza yuborildi.', 'Заявка отправлена.'], ['Arizani yopish', 'Закрыть заявку'],
  ['Siz uchun tayyorlandi', 'Подготовлено для вас'], ['Hozircha ma’lumot yo‘q', 'Пока нет данных'], ['Hozircha e’lon yo‘q', 'Пока нет объявлений'],
  ['Ommaviy oferta / foydalanish shartlari', 'Публичная оферта / условия использования'], ['Maxfiylik va aloqa ma’lumotlari yakunlanmaguncha telefon raqami olinmaydi.', 'Номер телефона не запрашивается, пока политика и контактные данные не заполнены.'],
  ['To‘lov huquqiy ma’lumotlar to‘ldirilgunga qadar yopiq.', 'Оплата отключена до заполнения юридической информации.'],
  ['Bepul tarifdan foydalanayapsiz.', 'Вы используете бесплатный тариф.'], ['Oylik tarifni tanlash', 'Выбрать месячный тариф'], ['Yillik tarifni tanlash', 'Выбрать годовой тариф'],
  ['Ushbu brauzer push bildirishnomalarini qo‘llamaydi.', 'Этот браузер не поддерживает push-уведомления.'], ['Bildirishnoma ruxsati berilmadi.', 'Разрешение на уведомления не выдано.'],
  ['Mashq', 'Тренировка'], ['Mashg‘ulot', 'Тренировка'], ['A’zo', 'Участник'], ['Ko‘rishguncha', 'До встречи'], ['zalda.', 'в зале.'],
];

const extendedTranslations: Array<[string, string]> = [
  ["CLOUDFLARE STREAM / DARS VIDEOLARI", "CLOUDFLARE STREAM / ВИДЕОУРОКИ"],
  ["uchun videolar", "видео для"], ["Video darslar a’zolar uchun.", "Видеоуроки доступны участникам."],
  ["Kirish uchun telefon raqamingizni tasdiqlang.", "Подтвердите номер телефона, чтобы войти."],
  ["Obuna tekshirilmoqda…", "Проверяем членство…"], ["Video darslarga ruxsat tekshirilmoqda.", "Проверяем доступ к видеоурокам."],
  ["Video darslar uchun faol obuna kerak.", "Для просмотра видеоуроков нужно активное членство."],
  ["Tariflarni ko‘rib, obunani faollashtiring.", "Выберите тариф и активируйте членство."],
  ["KO‘RISH", "СМОТРЕТЬ"], ["uchun videolar hozircha yuklanmagan.", "Видео для этой цели пока не загружены."],
  ["Admin paneldagi Dieta bo‘limidan Cloudflare Stream’ga video yuklang.", "Загрузите видео в Cloudflare Stream через раздел «Питание» в панели администратора."],
  ["AI OVQAT TAHLILI", "АНАЛИЗ ЕДЫ С ИИ"], ["Rasmni yukla — miqdorini aniqlaymiz.", "Загрузите фото — мы уточним количество."],
  ["AI taomni ajratadi, porsiya grammiga qarab kaloriya va BJU ni hisoblaydi.", "ИИ распознает блюдо и рассчитает калории и БЖУ по весу порции."],
  ["Bugun:", "Сегодня:"], ["AI tahlili Premium obunada ishlaydi. Avval Telegram orqali kiring.", "Анализ ИИ доступен в Premium. Сначала войдите через Telegram."],
  ["Rasm bo‘yicha kaloriya hisobi faol Premium obunachilar uchun.", "Расчет калорий по фото доступен участникам с активным Premium."],
  ["AI tahlilini yoqish uchun Supabase va Gemini server sozlamalari kerak.", "Для анализа ИИ нужно настроить Supabase и Gemini на сервере."],
  ["Obuna holati tekshirilmoqda…", "Проверяем статус членства…"],
  ["Rasmim taomni aniqlash uchun Google Gemini API’ga yuborilishiga roziman. Kaloriya va BJU qiymatlari taxminiy, tibbiy maslahat emas.", "Я согласен отправить фото в Google Gemini API для распознавания еды. Калории и БЖУ являются приблизительными и не заменяют медицинскую консультацию."],
  ["Tozalash", "Очистить"], ["AI ko‘rgan mahsulotlar", "Продукты, распознанные ИИ"],
  ["Har bir porsiyaning gramm miqdorini kiriting.", "Укажите вес каждой порции в граммах."], ["% ishonch", "% уверенности"],
  ["Kaloriyani hisoblash", "Рассчитать калории"], ["TAOM HISOBI · TAXMINIY", "РАСЧЕТ БЛЮДА · ПРИМЕРНО"],
  ["Yangi tahlil", "Новый анализ"], ["kkal", "ккал"], ["Oqsil", "Белки"], ["Yog‘", "Жиры"], ["Uglevod", "Углеводы"],
  ["Natija rasmdagi tarkib, retsept va porsiya miqdoriga asoslangan taxmin. Yog‘, sous yoki retseptdagi farqlar sabab haqiqiy kaloriya o‘zgarishi mumkin.", "Результат приблизительный и основан на составе, рецепте и размере порции на фото. Фактическая калорийность может отличаться из-за масла, соуса или рецепта."],
  ["Kunlik balansga yozildi · bugun yana", "Добавлено в дневной баланс · сегодня осталось"], ["ta tahlil", "анализов"],
  ["ARNIYGYM / ZAL", "ARNIYGYM / ЗАЛ"], ["Zal a’zoligi va mashg‘ulotlar.", "Членство в зале и тренировки."],
  ["Jadval, a’zolik QR kodi va muzlatish so‘rovlariga kirish uchun Telegram orqali hisobingizga kiring.", "Войдите через Telegram, чтобы открыть расписание, QR-код членства и запросы на заморозку."],
  ["Kirish va davom etish", "Войти и продолжить"], ["ARNIYGYM / A’ZOLIK", "ARNIYGYM / ЧЛЕНСТВО"],
  ["A’zolik faol bo‘lgach QR kod shu yerda chiqadi.", "QR-код появится здесь после активации членства."], ["daq.", "мин."], ["kun", "дней"], ["Tashrif qayd etildi", "Посещение отмечено"],
  ["SHAXSIY KABINET", "ЛИЧНЫЙ КАБИНЕТ"], ["Bugungi rejang.", "Твой план на сегодня."],
  ["Kaloriya, faollik va kunlik odatlaringni bir joyda kuzat.", "Следи за калориями, активностью и ежедневными привычками в одном месте."],
  ["BUGUNGI BALANS", "БАЛАНС НА СЕГОДНЯ"], ["Kaloriya dashboardi", "Панель калорий"], ["ASOSIY MAQSAD", "ГЛАВНАЯ ЦЕЛЬ"],
  ["OVQAT", "ПИТАНИЕ"], ["MASHQ", "ТРЕНИРОВКА"], ["Kunlik maqsad (kkal)", "Дневная цель (ккал)"], ["QADAMLAR", "ШАГИ"],
  ["Qo‘lda kiritilgan; telefon sensori bilan avtomatik sanalmaydi.", "Вводится вручную; автоматически датчиком телефона не подсчитывается."],
  ["MASHQ +", "ТРЕНИРОВКА +"], ["yoqilgan kaloriya", "сожженных калорий"], ["VAZN PROGRESSI +", "ПРОГРЕСС ВЕСА +"],
  ["Profil oynasida kuzating", "Смотрите в профиле"], ["Suv, ovqatlanish va mashq vaqtini eslatib turamiz.", "Напомним о воде, питании и времени тренировки."],
  ["ARNIYGYM / FITNES PLATFORMA", "ARNIYGYM / ФИТНЕС-ПЛАТФОРМА"], ["MUSHAK GURUHLARI BO‘YICHA", "ПО ГРУППАМ МЫШЦ"],
  ["MASSA YOKI OZISH MAQSADI", "ЦЕЛЬ: НАБОР МАССЫ ИЛИ ПОХУДЕНИЕ"], ["O‘ZING QAYD ETGAN NATIJA", "РЕЗУЛЬТАТЫ, КОТОРЫЕ ВЫ ОТМЕЧАЕТЕ"],
  ["ARNIYGYM", "ARNIYGYM"], ["MASHG‘ULOTDAN", "ПОСЛЕ ТРЕНИРОВКИ"], ["MASHG‘ULOTNI MAQSAD BILAN", "ТРЕНИРУЙСЯ С ЦЕЛЬЮ"], ["PASTGA O‘TING", "ПРОКРУТИТЕ ВНИЗ"],
  ["ZAL VA PLATFORMА", "ЗАЛ И ПЛАТФОРМА"], ["Reja bilan shug‘ullan.", "Тренируйся по плану."], ["Natijani o‘lcha.", "Отслеживай результат."],
  ["ArniyGym mashg‘ulotlarni, ovqatlanish qaydlarini va shaxsiy progressni bir joyda yuritishga yordam beradi.", "ArniyGym помогает вести тренировки, записи о питании и личный прогресс в одном месте."],
  ["6 mushak guruhi", "6 групп мышц"], ["AI taom tahlili", "Анализ еды с ИИ"], ["ARNIYGYM / PORTRET", "ARNIYGYM / ПОРТРЕТ"],
  ["Mashg‘ulotdan lavha", "Момент тренировки"], ["Platforma materiallari", "Материалы платформы"], ["O‘ZINGGA MOS TARIFNI TANLA", "ВЫБЕРИ ПОДХОДЯЩИЙ ТАРИФ"],
  ["Bugun boshlagin.", "Начни сегодня."], ["Izchil davom et.", "Продолжай регулярно."],
  ["Oylik yoki yillik a’zolik orqali platformadagi mashq va ovqatlanish materiallariga ulan.", "Оформи месячное или годовое членство и получи доступ к тренировкам и материалам о питании."],
  ["Tariflarni ko‘rish", "Посмотреть тарифы"], ["Kirish / ro‘yxatdan o‘tish", "Войти / зарегистрироваться"],
  ["ARNIYGYM / GALEREYA", "ARNIYGYM / ГАЛЕРЕЯ"], ["Zaldan lavhalar.", "Моменты из зала."], ["ARNIYGYM / JAMOA", "ARNIYGYM / КОМАНДА"],
  ["ARNIYGYM / FIKRLAR", "ARNIYGYM / ОТЗЫВЫ"], ["ARNIYGYM / SAVOL-JAVOB", "ARNIYGYM / ВОПРОСЫ И ОТВЕТЫ"], ["ARNIYGYM / NARXLAR", "ARNIYGYM / ЦЕНЫ"],
  ["Tariflar.", "Тарифы."], ["Tarifga ulanish", "Выбрать тариф"], ["ARNIYGYM / BIRINCHI MASHG‘ULOT", "ARNIYGYM / ПЕРВАЯ ТРЕНИРОВКА"],
  ["Zal bilan tanishing.", "Познакомьтесь с залом."], ["Ism va telefon raqamingizni qoldiring. Administrator siz bilan bog‘lanadi.", "Оставьте имя и номер телефона. Администратор свяжется с вами."],
  ["Izoh (ixtiyoriy)", "Комментарий (необязательно)"], ["ARNIYGYM MANZIL VA ALOQA", "ARNIYGYM / АДРЕС И КОНТАКТЫ"], ["TEL", "ТЕЛ."], ["Email", "Эл. почта"],
  ["Telegram", "Telegram"], ["Instagram", "Instagram"], ["Zal manzili, ish vaqti va aloqa ma’lumotlari admin tomonidan kiritilgach shu yerda ko‘rinadi.", "Адрес, часы работы и контакты появятся здесь после заполнения администратором."],
  ["ARNIYGYM / HUQUQIY MA’LUMOT", "ARNIYGYM / ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ"], ["Bu sahifa hozircha loyiha uchun shablon.", "Пока эта страница содержит шаблон проекта."],
  ["To‘lov yoqilishidan oldin operatorning yuridik nomi va STIRi, manzil va aloqa ma’lumotlari, qaytarish tartibi hamda yakuniy matnlar kiritilib, yurist bilan tekshirilishi kerak. Shuning uchun hozirda pullik to‘lovlar bloklangan.", "Перед включением оплаты нужно указать юридическое название оператора и ИНН, адрес, контакты, порядок возврата и окончательные тексты, а затем проверить их с юристом. До этого платные платежи отключены."],
  ["· STIR:", "· ИНН:"], ["Aloqa:", "Контакты:"], ["Ma’lumotlardan foydalanish va saqlash", "Использование и хранение данных"],
  ["Telefon:", "Телефон:"], ["Saqlash muddati:", "Срок хранения:"], ["Sog‘liq va ovqatlanish ma’lumotlari:", "Данные о здоровье и питании:"],
  ["Bu hujjat yakuniy ommaviy oferta yoki qonuniy maslahat emas. Aniqlashtirilmagan biznes va ma’lumot saqlash tafsilotlari o‘rniga soxta ma’lumot qo‘yilmadi.", "Этот документ не является окончательной публичной офертой или юридической консультацией. Неуточнённые деловые условия и сроки хранения данных не заменены вымышленными сведениями."],
  ["Hisobga kirish uchun telefon raqami Telegram orqali tekshiriladi.", "Номер телефона проверяется через Telegram для входа в аккаунт."],
  ["Profil sozlamalari yoqilganda vazn, suv, qadam va ovqat tahlili yozuvlari Supabase loyihasida saqlanadi.", "Если включено сохранение профиля, записи о весе, воде, шагах и анализе питания хранятся в проекте Supabase."],
  ["AI taom rasmini tahlil qilish faqat rozilik berilganda Google Gemini xizmatiga yuboradi.", "Фото еды отправляется в Google Gemini для анализа ИИ только с вашего согласия."],
  ["Chek yuklanganda u yopiq Supabase Storage maydonida saqlanadi; videolar Cloudflare Stream’dan uzatiladi.", "Загруженная квитанция хранится в закрытом хранилище Supabase; видео передаётся через Cloudflare Stream."],
  ["Operator ma’lumotlardan foydalanish maqsadi va saqlash muddatini belgilamaguncha pullik kirish yoqilmaydi.", "Платный доступ не включается, пока оператор не определит цели использования и сроки хранения данных."],
  ["Qaytarish, bekor qilish va P2P to‘lovini ko‘rib chiqish shartlari operator tomonidan to‘ldirilmaguncha pullik buyurtmalar qabul qilinmaydi.", "Платные заказы не принимаются, пока оператор не заполнит условия возврата, отмены и рассмотрения P2P-платежей."],
  ["ZALDAN XABARLAR", "НОВОСТИ ЗАЛА"], ["Yangiliklar.", "Новости."], ["Zal, yangi jihozlar, ish vaqti va aksiyalar bo‘yicha e’lonlar.", "Объявления о зале, новом оборудовании, часах работы и акциях."],
  ["Telegram kanal", "Канал Telegram"], ["ARNIY", "ARNIY"], ["GYM", "GYM"], ["Kanalga o‘tish", "Перейти в канал"], ["Sarlavha", "Заголовок"],
  ["Turi", "Тип"], ["E’lon matni", "Текст объявления"], ["Muqova rasmi HTTPS havolasi", "HTTPS-ссылка на обложку"], ["Nashr vaqti", "Время публикации"],
  ["Ko‘rinish tugaydi", "Публикация видна до"], ["Muhim e’lon sifatida ajratish", "Отметить как важное объявление"], ["Bekor qilish", "Отмена"], ["Tahrir", "Изменить"],
  ["UZCARD / HUMO", "UZCARD / HUMO"], ["Tarif narxini tekshirib, bank ilovasida o‘tkazmani amalga oshiring va chekni yuklang.", "Проверьте цену тарифа, выполните перевод в банковском приложении и загрузите квитанцию."],
  ["KARTA RAQAMI", "НОМЕР КАРТЫ"], ["Karta rekvizitlari admin tomonidan sozlanmagan.", "Реквизиты карты не настроены администратором."], ["PRO oylik", "PRO на месяц"], ["PRO yillik", "PRO на год"],
  ["ADMIN NARX JADVALIDAGI SUMMA", "СУММА ИЗ ТАБЛИЦЫ ЦЕН АДМИНИСТРАТОРА"], ["Tasdiqlashda summa qayta tekshiriladi.", "Сумма будет проверена повторно при подтверждении."],
  ["Hisob telefon raqami", "Номер телефона аккаунта"], ["Foydalanuvchi ID:", "ID пользователя:"], ["gacha", "до"], ["Hali obuna qaydi yo‘q.", "Записей о членстве пока нет."],
  ["Hali avtomatik to‘lov tarixi yo‘q.", "История автоматических платежей пока пуста."],
  ["P2P orqali olingan a’zolik avtomatik uzaytirilmaydi. Muddati tugaganda yangi to‘lovni o‘zingiz yuborasiz.", "Членство, оформленное через P2P, не продлевается автоматически. После окончания срока отправьте новый платёж."],
  ["so‘m", "сум"], ["Yuborilgan chek yo‘q.", "Отправленных квитанций пока нет."], ["Shaxsiy ma’lumotlaringiz nusxasi", "Копия ваших личных данных"],
  ["Profil, to‘lov, vazn, ovqatlanish va mashg‘ulot qaydlarini yuklab oling.", "Скачайте данные профиля, платежей, веса, питания и тренировок."],
  ["Profil ma’lumotlari o‘chiriladi. Faol obuna muddati tugamaguncha hisobni o‘chirib bo‘lmaydi.", "Данные профиля будут удалены. Удалить аккаунт до окончания активного членства нельзя."],
  ["Tasdiqlash uchun telefon", "Телефон для подтверждения"], ["Obuna va video ruxsati tekshirilmoqda…", "Проверяем членство и доступ к видео…"],
  ["Qisqa muddatli imzolangan oqim va hisobga bog‘langan belgi ruxsatsiz ulashishni kamaytiradi; ekran yozuvini to‘liq to‘xtatmaydi.", "Краткосрочная подписанная ссылка и водяной знак с данными аккаунта снижают риск несанкционированного распространения, но не блокируют запись экрана полностью."],
  ["ARNIYGYM / PWA", "ARNIYGYM / PWA"], ["Ilovani bosh ekranga qo‘shing.", "Добавьте приложение на главный экран."],
  ["ArniyGym’ni telefoningizdan tez ochish uchun brauzer menyusidan bosh ekranga qo‘shing.", "Добавьте ArniyGym на главный экран через меню браузера, чтобы быстро открывать его на телефоне."],
  ["Safari brauzerida sahifaning", "В Safari нажмите"], ["Ulashish", "Поделиться"], ["tugmasini bosing.", "на странице."], ["Bosh ekranga qo‘shish", "На экран «Домой»"],
  ["bandini tanlang.", "Выберите этот пункт."], ["Qo‘shish", "Добавить"], ["ni bosing.", "Нажмите."], ["Chrome brauzeridagi", "В Chrome откройте"],
  ["⋮ menyu", "меню ⋮"], ["ni oching.", "."], ["Ilovani o‘rnatish", "Установить приложение"], ["yoki", "или"], ["ni tanlang.", "выберите этот пункт."],
  ["Ochilgan oynada o‘rnatishni tasdiqlang.", "Подтвердите установку в открывшемся окне."],
  ["O‘rnatish bandi ko‘rinmasa, sahifani HTTPS manzili orqali ochib, brauzer menyusini tekshiring.", "Если пункта установки нет, откройте страницу по HTTPS и проверьте меню браузера."],
  ["SENING PROGRESSING", "ТВОЙ ПРОГРЕСС"], ["Izchillikni ko‘r.", "Следи за регулярностью."], ["Profil ma’lumotlarini saqlash uchun kirish kerak.", "Войдите, чтобы сохранять данные профиля."],
  ["VAZN QAYDLARI", "ЗАПИСИ О ВЕСЕ"], ["1-qayd", "1 запись"], ["-qayd", "-я запись"], ["ta qayd", "записей"], ["So‘nggi vazn", "Последний вес"],
  ["Hali vazn yozuvi yo‘q. Birinchi natijangni kiritsang, grafik shu yerda boshlanadi.", "Записей о весе пока нет. Добавьте первое значение, и здесь появится график."],
  ["Nuqtalar qaydlar ketma-ketligini ko‘rsatadi; ular orasidagi kunlar soni ko‘rsatilmagan.", "Точки показывают порядок записей; количество дней между ними не отображается."],
  ["Bugungi vazn (kg)", "Вес сегодня (кг)"], ["Vazn qo‘shish", "Добавить вес"], ["Kunlik maqsad: 8 stakan", "Дневная цель: 8 стаканов"], ["Hisobdan chiqish", "Выйти из аккаунта"],
  ["Set", "Подход"], ["Takror", "Повтор"], ["Og‘irlik (kg)", "Вес (кг)"], ["Oxirgi qaydlar", "Последние записи"], ["Hali mashg‘ulot qaydi yo‘q.", "Записей о тренировках пока нет."],
  ["Qaydlar faqat sizga ko‘rinadi.", "Записи видны только вам."], ["arniy", "arniy"], ["gym", "gym"], ["Shartlar", "Условия"], ["Maxfiylik", "Конфиденциальность"],
  ["To‘lov va qaytarish", "Оплата и возврат"], ["ArniyGym’ni o‘rnating", "Установите ArniyGym"], ["Telefoningizda ilova kabi foydalaning", "Используйте на телефоне как приложение"],
  ["KALORIYA / BJU HISOBLAGICHI", "КАЛЬКУЛЯТОР КАЛОРИЙ / БЖУ"], ["MIFFLIN–ST JEOR", "МИФФЛИН — СЕН-ЖЕОР"], ["Vazn (kg)", "Вес (кг)"], ["Bo‘y (cm)", "Рост (см)"],
  ["Kam harakat", "Малоактивный образ жизни"], ["Yengil faollik", "Лёгкая активность"], ["O‘rtacha faollik", "Умеренная активность"], ["Yuqori faollik", "Высокая активность"],
  ["Vazn, bo‘y, yosh, jins va maqsadni kiriting", "Укажите вес, рост, возраст, пол и цель"],
  ["Bu taxminiy hisob. Tibbiy maslahat o‘rnini bosmaydi. 18 yoshgacha, homiladorlik yoki kasallik holatlarida mutaxassisga murojaat qiling.", "Это примерный расчёт, а не медицинская рекомендация. Если вам меньше 18 лет, вы беременны или имеете заболевание, обратитесь к специалисту."],
  ["Maqsadingga mos", "Под твою цель"], ["ovqatlan.", "питайся."], ["Vazn tashlash", "Снижение веса"], ["Menyu yuklanmoqda…", "Загружаем меню…"],
  ["Bu maqsad uchun e’lon qilingan menyu hozircha yo‘q.", "Для этой цели пока нет опубликованного меню."], ["QANDAY QILISH KERAK?", "КАК ВЫПОЛНЯТЬ?"],
  ["Kaloriya — hisob-kitob uchun taxmin. Sog‘liq bilan bog‘liq qarorlar uchun mutaxassis bilan maslahatlashing.", "Калорийность рассчитана приблизительно. По вопросам здоровья проконсультируйтесь со специалистом."],
  ["Kuch — bu", "Сила — это"], ["kundalik tanlov.", "ежедневный выбор."], ["MAQSADIMIZ", "НАША ЦЕЛЬ"], ["Hamma uchun", "Для каждого"], ["aniq boshlanish.", "понятный старт."],
  ["JAMOA / YONDASHUV", "КОМАНДА / ПОДХОД"], ["Kamroq shovqin.", "Меньше шума."], ["Ko‘proq harakat.", "Больше движения."], ["HAMJAMIYATGA QO‘SHIL", "ПРИСОЕДИНЯЙСЯ К СООБЩЕСТВУ"],
  ["/ ARNIYGYM TRAINING", "/ ARNIYGYM TRAINING"], ["ANIQ TEXNIKA. KUCHLI NATIJA.", "ТОЧНАЯ ТЕХНИКА. СИЛЬНЫЙ РЕЗУЛЬТАТ."],
  ["Set oralig‘ida nazoratni yo‘qotma", "Сохраняй контроль между подходами"], ["MASHQLAR RO‘YXATI", "СПИСОК ТРЕНИРОВОК"], ["ta mashq", "упражнений"],
  ["Jurnal va sevimlilar mavjud", "Доступны журнал и избранное"], ["set ·", "подход ·"], ["takror ·", "повтор ·"], ["VIDEO KEYINROQ", "ВИДЕО ПОЗЖЕ"],
  ["Videolar qisqa muddatli ruxsatli HLS oqimi orqali beriladi.", "Видео передаётся по краткосрочной подписанной ссылке HLS."], ["MAHALLIY TO‘LOV", "МЕСТНАЯ ОПЛАТА"],
  ["maxfiylik siyosatiga", "политикой конфиденциальности"], ["roziman.", "согласен."],
  ["Kirishni yoqish uchun VITE_TURNSTILE_SITE_KEY va TURNSTILE_SECRET_KEY sozlanishi kerak.", "Чтобы включить вход, настройте VITE_TURNSTILE_SITE_KEY и TURNSTILE_SECRET_KEY."],
  ["Telegramda botni ochish", "Открыть бота в Telegram"], ["6 xonali OTP", "6-значный код"],
  ["Saytda ko‘rsatiladigan ma’lumotlarni kiriting. Aniqlanmagan manzil, vaqt yoki aloqa raqamini taxmin qilib yozmang.", "Введите данные, которые будут показаны на сайте. Не придумывайте адрес, часы работы или номер телефона, если они неизвестны."],
  ["PAYME / LEMON SQUEEZY", "PAYME / LEMON SQUEEZY"], ["Avtomatik to‘lovlar", "Автоматические платежи"], ["ta qayd ·", "записей ·"],
  ["Avtomatik to‘lov qaydlari yo‘q.", "Записей об автоматических платежах пока нет."], ["Oldingi", "Назад"], ["Keyingi", "Далее"], ["CSV eksport", "Экспорт CSV"],
  ["Kunlik kaloriya tavsiyasi", "Рекомендация калорий на день"], ["Kunlik ovqatlanish rejasi", "План питания на день"], ["Taom qo‘shish", "Добавить блюдо"],
  ["Vaqt", "Время"], ["Tarkibi / izoh", "Состав / комментарий"], ["Hozircha taomlar qo‘shilmagan.", "Блюда пока не добавлены."],
  ["“Qanday qilish kerak?” tavsiyalari", "Рекомендации «Как выполнять?»"], ["Zal galereyasi", "Галерея зала"],
  ["Rasmlar avtomatik WebP formatiga o‘tkaziladi. Faqat ruxsatingiz bor rasmlarni joylang.", "Изображения автоматически преобразуются в WebP. Загружайте только те фото, на публикацию которых у вас есть разрешение."],
  ["Rasm tavsifi", "Описание фото"], ["Murabbiylar", "Тренеры"], ["Faqat haqiqiy va rozilik bergan murabbiylarni qo‘shing.", "Добавляйте только реальных тренеров, давших согласие на публикацию."],
  ["Murabbiy qo‘shish", "Добавить тренера"], ["Ism", "Имя"], ["Lavozim (UZ)", "Должность (UZ)"], ["Должность (RU)", "Должность (RU)"],
  ["Qisqa ma’lumot (UZ)", "Краткое описание (UZ)"], ["Краткое описание (RU)", "Краткое описание (RU)"], ["Mijozlar sharhlari", "Отзывы участников"],
  ["Faqat haqiqiy va e’lon qilishga rozilik olingan fikrlarni kiriting.", "Добавляйте только реальные отзывы, на публикацию которых получено согласие."], ["Sharh qo‘shish", "Добавить отзыв"],
  ["Kontekst (ixtiyoriy)", "Контекст (необязательно)"], ["Sharh (UZ)", "Отзыв (UZ)"], ["Отзыв (RU)", "Отзыв (RU)"],
  ["Mehmonlarga kerakli aniq javoblarni qo‘shing.", "Добавляйте точные ответы на вопросы посетителей."], ["Savol qo‘shish", "Добавить вопрос"],
  ["Savol (UZ)", "Вопрос (UZ)"], ["Вопрос (RU)", "Вопрос (RU)"], ["Javob (UZ)", "Ответ (UZ)"], ["Ответ (RU)", "Ответ (RU)"],
  ["GURUH MASHG‘ULOTLARI", "ГРУППОВЫЕ ТРЕНИРОВКИ"], ["Jadval va yozilishlar", "Расписание и запись"], ["ta jadval", "занятий"], ["Nomi", "Название"],
  ["Murabbiy", "Тренер"], ["Sana va vaqt", "Дата и время"], ["Sig‘im", "Вместимость"], ["Davomiyligi (daqiqa)", "Длительность (минуты)"], ["Joy", "Место"],
  ["daq. ·", "мин. ·"], ["joy", "место"], ["Hali mashg‘ulot e’lon qilinmagan.", "Тренировки пока не опубликованы."], ["A’ZOLIK NAZORATI", "ПРОВЕРКА ЧЛЕНСТВА"],
  ["QR orqali kirishni qayd qilish", "Отметить вход по QR-коду"], ["45 soniyalik imzo", "Подписан на 45 секунд"],
  ["QR bir martalik nonce bilan imzolanadi. Muddati o‘tgan, a’zoligi faol bo‘lmagan yoki muzlatilgan kod o‘tmaydi.", "QR-код подписан одноразовым nonce. Просроченный код, а также код при неактивном или замороженном членстве не будет принят."],
  ["Kamerani yopish", "Закрыть камеру"], ["Kamerani ochish", "Открыть камеру"], ["Kirishga ruxsat berildi", "Вход разрешён"],
  ["MUZLATISH SO‘ROVLARI", "ЗАПРОСЫ НА ЗАМОРОЗКУ"], ["Ko‘rib chiqish", "Рассмотреть"], ["ta kutilmoqda", "ожидают"], ["kun ·", "дней ·"],
  ["A’zolik muzlatish so‘rovi yo‘q.", "Запросов на заморозку членства нет."], ["BIRINCHI MASHG‘ULOT", "ПЕРВАЯ ТРЕНИРОВКА"], ["Qabul arizalari", "Заявки на запись"],
  ["· Telegram", "· Telegram"], ["Yangi ariza yo‘q.", "Новых заявок нет."],
  ["To‘lov va foydalanuvchi ro‘yxatini yoqishdan oldin aniq yuridik ma’lumotlarni kiriting va hujjatlarni yurist bilan tekshiring.", "Перед включением оплаты и регистрации пользователей укажите точные юридические данные и проверьте документы с юристом."],
  ["Ma’lumotlar to‘g‘ri, hujjatlar ko‘rib chiqilgan, e’lon qilishga roziman.", "Данные верны, документы проверены, разрешаю публикацию."], ["A’ZO QIDIRISH", "ПОИСК УЧАСТНИКА"],
  ["Ism yoki telefon bo‘yicha topish", "Найти по имени или телефону"], ["Qo‘lda beriladigan tarif", "Тариф, назначаемый вручную"], ["30 kun", "30 дней"], ["365 kun", "365 дней"],
  ["Muddat qo‘shish", "Добавить срок"], ["Bu qo‘lda berilgan a’zolik; avtomatik to‘lov yoki uzaytirish qilinmaydi.", "Это членство назначено вручную; автоматическая оплата или продление не выполняется."],
  ["Faol qurilma", "Активное устройство"], ["Obunalar", "Членства"], ["Obuna tarixi yo‘q.", "Истории членства пока нет."], ["Avtomatik to‘lov tarixi yo‘q.", "История автоматических платежей пуста."],
  ["P2P to‘lovlar", "Платежи P2P"], ["so‘m ·", "сум ·"], ["To‘lov tarixi yo‘q.", "Истории платежей пока нет."], ["KUCHLIROQ HAR KUN", "СИЛЬНЕЕ КАЖДЫЙ ДЕНЬ"],
  ["O‘zingning", "Свою"], ["eng kuchli", "самую сильную"], ["versiyang.", "версию."], ["Mashq, ovqatlanish va progress — bitta aniq reja ichida.", "Тренировки, питание и прогресс — в одном понятном плане."],
  ["Mashqni boshlash", "Начать тренировку"], ["BUGUN BOSHLAN", "НАЧНИ СЕГОДНЯ"], ["ARNIYGYM / MASHG‘ULOT PLATFORMASI", "ARNIYGYM / ПЛАТФОРМА ТРЕНИРОВОК"], ["OVQATLANISH", "ПИТАНИЕ"],
  ["Maqsadingga", "К своей цели"], ["mos menyu.", "подходящее меню."], ["MASHG‘ULOT", "ТРЕНИРОВКА"], ["Har takror seni", "Каждое повторение"], ["oldinga olib boradi.", "приближает тебя к цели."],
  ["PROGRESS", "ПРОГРЕСС"], ["Natijangni", "Отслеживай"], ["kuzatib bor.", "свой результат."], ["BUGUNGI TANLOV", "ВЫБОР НА СЕГОДНЯ"], ["Mushak guruhini tanla.", "Выбери группу мышц."],
  ["Katta o‘zgarish", "Большие перемены"], ["kichik odatlardan", "начинаются с маленьких привычек"], ["boshlanadi.", "."], ["Progressni ko‘r", "Посмотреть прогресс"], ["© 2026 ARNIYGYM", "© 2026 ARNIYGYM"],
  ["MASHG‘ULOTNI MAQSAD BILAN.", "ТРЕНИРУЙСЯ С ЦЕЛЬЮ."], ["MURABBIY KIRITGAN MENYU", "МЕНЮ ОТ ТРЕНЕРА"],
  ["Kaloriya — hisob-kitob uchun taxmin. Tibbiy qarorlar uchun mutaxassisga murojaat qiling.", "Калорийность рассчитана приблизительно. Для принятия медицинских решений обратитесь к специалисту."],
  ["ADMIN / TELEGRAM 2FA", "АДМИН / TELEGRAM 2FA"], ["Parol", "Пароль"], ["Telegram kodini yuborish", "Отправить код в Telegram"], ["6 xonali tasdiqlash kodi", "6-значный код подтверждения"],
  ["ARNIYGYM / ADMIN", "ARNIYGYM / АДМИН"], ["Boshqaruv", "Управление"], ["maydoni.", "панель."], ["Admin panelga kirish uchun parol va Telegram 2FA talab qilinadi.", "Для входа в панель администратора нужны пароль и подтверждение Telegram 2FA."],
  ["Admin sifatida kirish", "Войти как администратор"], ["ADMIN / ARNIYGYM", "АДМИН / ARNIYGYM"], ["paneli.", "панель."], ["Chiqish", "Выйти"],
  ["Parol + Telegram 2FA · RLS · bitta faol qurilma sessiyasi", "Пароль + Telegram 2FA · RLS · одна активная сессия устройства"], ["DINAMIK KATEGORIYALAR", "ДИНАМИЧЕСКИЕ КАТЕГОРИИ"],
  ["Mashq bo‘limlari", "Разделы тренировок"], ["KONTENT BOSHQARUVI", "УПРАВЛЕНИЕ КОНТЕНТОМ"], ["Mashqlar kutubxonasi", "Библиотека упражнений"],
  ["OVQATLANISH REJALARI", "ПЛАНЫ ПИТАНИЯ"], ["Menyu va yo‘riqnomalar", "Меню и инструкции"], ["NARX VA BILLING", "ЦЕНЫ И ОПЛАТА"], ["Tariflar / USD · UZS", "Тарифы / USD · UZS"],
  ["Mahalliy to‘lov rekvizitlari", "Реквизиты местной оплаты"], ["Karta raqami", "Номер карты"], ["Karta egasi", "Владелец карты"], ["Yo‘riqnoma", "Инструкция"],
  ["FOYDALANUVCHI OBUNALARI", "ЧЛЕНСТВА ПОЛЬЗОВАТЕЛЕЙ"], ["Obuna statistikasi", "Статистика членств"], ["faol a’zolik /", "активных членств /"], ["FAOL A’ZOLIK", "АКТИВНОЕ ЧЛЕНСТВО"],
  ["BEKOR QILINGAN", "ОТМЕНЕНО"], ["So‘nggi 30 kunda:", "За последние 30 дней:"], ["TASDIQLANGAN P2P", "ПОДТВЕРЖДЁННЫЕ P2P"], ["UZS", "UZS"],
  ["PAYME TUSHUMLARI", "ПОСТУПЛЕНИЯ PAYME"], ["LEMON TUSHUMLARI", "ПОСТУПЛЕНИЯ LEMON"], ["USD", "USD"], ["Joriy sahifani CSV eksport qilish", "Экспортировать текущую страницу в CSV"],
  ["P2P CHEKLAR", "КВИТАНЦИИ P2P"], ["Tasdiqlash navbati", "Очередь на проверку"], ["ta jami · ushbu sahifada", "всего · на этой странице"], ["kutilmoqda", "ожидает"],
  ["Chekni ko‘rish ↗", "Открыть квитанцию ↗"], ["Chek fayli ochilmadi", "Не удалось открыть файл квитанции"], ["ZAL E’LONLARI", "ОБЪЯВЛЕНИЯ ЗАЛА"], ["Yangiliklar va aksiyalar", "Новости и акции"],
  ["SAYT VA HUQUQIY MA’LUMOTLAR", "САЙТ И ЮРИДИЧЕСКАЯ ИНФОРМАЦИЯ"], ["Matnlar va aloqa", "Тексты и контакты"], ["Sayt matnlarini saqlash", "Сохранить тексты сайта"], ["Bo‘lim qo‘shish", "Добавить раздел"],
  ["Cloudflare Stream · TUS resume · 2 GB max", "Cloudflare Stream · возобновляемая загрузка TUS · до 2 ГБ"], ["CLOUDFLARE STREAM / OZISH VA MASSA YIG‘ISH", "CLOUDFLARE STREAM / ПОХУДЕНИЕ И НАБОР МАССЫ"],
  ["Maqsad bo‘yicha video dars yuklash", "Загрузить видеоурок для выбранной цели"], ["Videolar Cloudflare Stream’ga yuboriladi va faqat faol obunachilarga imzolangan HLS oqimi orqali ko‘rsatiladi.", "Видео загружается в Cloudflare Stream и доступно только участникам с активным членством по подписанной ссылке HLS."],
  ["Dieta rejasini tanlang", "Выберите план питания"], ["MP4/MOV · 2 GB gacha · TUS davom ettiriladigan yuklash", "MP4/MOV · до 2 ГБ · возобновляемая загрузка TUS"],
  ["Avval yuqoridan", "Сначала выберите выше"], ["dietasi yarating, keyin unga video biriktiring.", "создайте план питания, затем прикрепите к нему видео."], ["Cloudflare ·", "Cloudflare ·"],
  ["Bu rejaga video dars qo‘shilmagan.", "К этому плану пока не добавлены видеоуроки."], ["Variant", "Вариант"], ["Faol", "Активен"],
  ["Lemon Squeezy’dagi variant narxi shu USD qiymatiga teng bo‘lishi kerak; mos kelmasa checkout rad etiladi. Mahalliy UZS summasi P2P uchun.", "Цена варианта в Lemon Squeezy должна совпадать с суммой в USD; при несовпадении оформление будет отклонено. Местная цена в UZS используется для P2P."],
  ["Tarif nomi (ruscha)", "Название тарифа (на русском)"], ["Javobingiz", "Ваш ответ"], ["Maqsad", "Цель"], ["Nonushta", "Завтрак"], ["Zal / xona", "Зал / помещение"], ["Takrorlar", "Повторения"],
  ["Sarlavha (ruscha)", "Заголовок (русский)"], ["E’lon matni (ruscha)", "Текст объявления (русский)"], ["Ish vaqti", "Часы работы"], ["Aksiya", "Акция"],
  ["monthly", "месячный"], ["yearly", "годовой"], ["active", "активно"], ["cancelled", "отменено"], ["expired", "истекло"], ["past_due", "просрочено"],
  ["on_trial", "пробный период"], ["paused", "приостановлено"], ["refunded", "возвращено"], ["pending", "ожидает"], ["approved", "подтверждено"], ["rejected", "отклонено"],
  ["payme", "Payme"], ["lemon_squeezy", "Lemon Squeezy"], ["p2p", "P2P"], ["manual", "вручную"], ["gain", "набор массы"], ["cut", "похудение"],
  ["shoulders", "плечи"], ["biceps", "бицепс"], ["triceps", "трицепс"], ["back", "спина"], ["chest", "грудь"], ["legs", "ноги"],
  ["So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.", "Не удалось выполнить запрос. Попробуйте ещё раз."],
  ["Massa yig‘ish uchun ovqatlanish va mashq bo‘yicha video darslar.", "Видеоуроки по питанию и тренировкам для набора массы."],
  ["Vazn tashlash uchun ovqatlanish va mashq bo‘yicha video darslar.", "Видеоуроки по питанию и тренировкам для снижения веса."],
  ["Rasmni o‘qib bo‘lmadi.", "Не удалось прочитать изображение."], ["Rasm Google Gemini API’ga yuborilishini tasdiqlang.", "Подтвердите отправку фото в Google Gemini API."],
  ["JPG, PNG yoki WebP formatida, 5 MB gacha rasm tanlang.", "Выберите изображение JPG, PNG или WebP размером до 5 МБ."],
  ["Bugungi 5 ta AI tahlil limiti tugadi.", "Дневной лимит в 5 анализов ИИ исчерпан."], ["Taom aniqlanmadi. Yorug‘roq va yaqinroq rasm yuboring.", "Блюдо не распознано. Отправьте более светлое и близкое фото."],
  ["Yuklangan taom rasmi", "Загруженное фото блюда"], ["Taom aniqlanmoqda…", "Распознаём блюдо…"], ["Boshqa rasm", "Другое фото"], ["Taom rasmini yuklash", "Загрузить фото блюда"],
  ["Masalan, 250", "Например, 250"], ["Mahsulot aniq ko‘rinmayapti. Nima ekanini yozing.", "Продукт плохо виден. Напишите, что это."],
  ["Zal ma’lumotlarini yuklab bo‘lmadi.", "Не удалось загрузить данные зала."], ["A’zolik QR kodi ochilmadi.", "Не удалось открыть QR-код членства."],
  ["Mashg‘ulotga yozildingiz.", "Вы записаны на тренировку."], ["Yozilish uchun faol a’zolik kerak.", "Для записи нужно активное членство."],
  ["Mashg‘ulot vaqti o‘tgan yoki jadval yopilgan.", "Время тренировки прошло или запись закрыта."], ["Mashg‘ulotga yozib bo‘lmadi.", "Не удалось записать вас на тренировку."],
  ["Yozilish bekor qilindi. Kutish ro‘yxatidagi navbatdagi a’zo o‘tishi mumkin.", "Запись отменена. Следующий участник из списка ожидания может занять место."],
  ["Yozilishni bekor qilib bo‘lmadi.", "Не удалось отменить запись."], ["Sizda ko‘rib chiqilayotgan muzlatish so‘rovi bor.", "У вас уже есть запрос на заморозку, ожидающий рассмотрения."],
  ["Muzlatish so‘rovini yuborib bo‘lmadi.", "Не удалось отправить запрос на заморозку."], ["Muzlatish so‘rovi admin ko‘rib chiqishiga yuborildi.", "Запрос на заморозку отправлен администратору."],
  ["A’ZOLIK FAOL", "ЧЛЕНСТВО АКТИВНО"], ["FAOL EMAS", "НЕАКТИВНО"], ["Qirq besh soniyada yangilanadigan a’zolik QR kodi", "QR-код членства обновляется каждые 45 секунд"],
  ["Xavfsiz QR tayyorlanmoqda…", "Создаём защищённый QR-код…"], ["45 soniyada o‘zgaradi", "Обновится через 45 секунд"], ["Murabbiy kiritilmagan", "Тренер не указан"],
  ["KUTISH RO‘YXATI", "СПИСОК ОЖИДАНИЯ"], ["Qisqa izoh", "Краткий комментарий"], ["So‘rov ko‘rib chiqilmoqda", "Запрос рассматривается"], ["Ko‘rib chiqilmoqda", "На рассмотрении"],
  ["Kunlik maqsadni 800–8 000 kkal oralig‘ida kiriting.", "Укажите дневную цель в диапазоне 800–8 000 ккал."], ["Kaloriya maqsadi saqlanmadi. Qayta urinib ko‘ring.", "Не удалось сохранить цель по калориям. Попробуйте ещё раз."],
  ["Kunlik kaloriya maqsadi saqlandi.", "Дневная цель по калориям сохранена."], ["Mashq kaloriyasini 1–3000 oralig‘ida kiriting.", "Укажите калории тренировки в диапазоне от 1 до 3000."],
  ["Qadam sonini 0–100 000 oralig‘ida kiriting.", "Укажите количество шагов от 0 до 100 000."], ["Qadamlar saqlanmadi. Keyinroq urinib ko‘ring.", "Не удалось сохранить шаги. Попробуйте позже."],
  ["Bugungi qadamlar saqlandi.", "Шаги за сегодня сохранены."], ["FAOL OBUNA", "АКТИВНОЕ ЧЛЕНСТВО"], ["OBUNA FAOL EMAS", "ЧЛЕНСТВО НЕАКТИВНО"], ["MAQSAD YO‘Q", "ЦЕЛЬ НЕ УКАЗАНА"],
  ["Masalan 2 000", "Например, 2 000"], ["Bu brauzer push bildirishnomalarini qo‘llamaydi.", "Этот браузер не поддерживает push-уведомления."],
  ["Web Push kaliti .env.local faylida sozlanmagan.", "Ключ Web Push не настроен в файле .env.local."], ["Suv, ovqatlanish va mashq eslatmalari yoqildi.", "Напоминания о воде, питании и тренировках включены."],
  ["Ariza qabul qilindi. Zal ma’muriyati panelida ko‘rinadi.", "Заявка принята и появится в панели администратора зала."], ["Ariza yuborildi. Tez orada siz bilan bog‘lanamiz.", "Заявка отправлена. Скоро мы с вами свяжемся."], ["Ariza yuborilmadi. Qayta urinib ko‘ring.", "Не удалось отправить заявку. Попробуйте ещё раз."],
  ["Sport mashg‘ulotidan lavha", "Момент спортивной тренировки"], ["ArniyGym uchun taqdim etilgan portret", "Портрет, предоставленный для ArniyGym"], ["ArniyGym zalidan surat", "Фото из зала ArniyGym"],
  ["Mijozlar fikri.", "Отзывы участников."], ["Ko‘p so‘raladi.", "Частые вопросы."], ["Yillik a’zolik", "Годовое членство"], ["Oylik a’zolik", "Месячное членство"], ["Manzilni xaritada ochish", "Открыть адрес на карте"],
  ["O‘zbek tiliga o‘tish", "Переключить на узбекский"], ["Zal e’loni", "Объявление зала"], ["Yangi trenajyor", "Новое оборудование"], ["Yangiliklar yuklanmoqda…", "Загружаем новости…"],
  ["Yangi e’lonlar shu yerda chiqadi.", "Новые объявления появятся здесь."], ["Biroz kuting.", "Подождите немного."], ["Tezkor xabarlar uchun Telegram kanalimizni kuzating.", "Следите за нашим каналом Telegram, чтобы получать новости."],
  ["Sarlavha va e’lon matnini kiriting.", "Введите заголовок и текст объявления."], ["Rasm havolasi HTTPS manzili bo‘lishi kerak.", "Ссылка на изображение должна использовать HTTPS."],
  ["Tugash vaqti nashr vaqtidan keyin bo‘lishi kerak.", "Время окончания должно быть позже времени публикации."], ["E’lon saqlanmadi. Qayta urinib ko‘ring.", "Не удалось сохранить объявление. Попробуйте ещё раз."],
  ["E’lon yangilandi.", "Объявление обновлено."], ["E’lon qoralama sifatida saqlandi.", "Объявление сохранено как черновик."], ["E’lon yashirildi.", "Объявление скрыто."], ["E’lon saytga chiqarildi.", "Объявление опубликовано на сайте."],
  ["Masalan: Yangi trenajyorlar zalda", "Например: в зале появилось новое оборудование"], ["Yangilik haqida aniq ma’lumot yozing…", "Укажите точную информацию о новости…"],
  ["O‘zgarishni saqlash", "Сохранить изменения"], ["Qoralama saqlash", "Сохранить черновик"], ["E’lonni o‘chirish", "Удалить объявление"], ["E’lonni o‘chirasizmi?", "Удалить объявление?"], ["E’lon o‘chirildi.", "Объявление удалено."],
  ["Chek fayli 10 MB dan oshmasin.", "Размер файла квитанции не должен превышать 10 МБ."], ["Chek yuborilmadi. Qayta urinib ko‘ring.", "Не удалось отправить квитанцию. Попробуйте ещё раз."], ["Narx sozlanmagan", "Цена не настроена"], ["Chekni yuborish", "Отправить квитанцию"],
  ["Obuna yoki to‘lovlar tarixi yuklanmadi.", "Не удалось загрузить историю членства или платежей."],
  ["Bekor qilish so‘rovi yuborildi. Joriy to‘langan muddat tugaguncha kirish saqlanadi.", "Запрос на отмену отправлен. Доступ сохранится до конца оплаченного периода."],
  ["Obunani bekor qilib bo‘lmadi. Keyinroq qayta urinib ko‘ring.", "Не удалось отменить членство. Попробуйте позже."], ["Shaxsiy ma’lumotlar eksport qilindi.", "Личные данные экспортированы."], ["Ma’lumotlar eksport qilinmadi.", "Не удалось экспортировать данные."],
  ["Tasdiqlash uchun hisobingizdagi telefon raqamini kiriting.", "Введите номер телефона, указанный в аккаунте, для подтверждения."], ["Hisob va unga bog‘langan profil ma’lumotlari o‘chirildi.", "Аккаунт и связанные с ним данные профиля удалены."], ["Lemon Squeezy", "Lemon Squeezy"], ["O‘chirilmoqda…", "Удаляем…"],
  ["Hisobni va ma’lumotlarni o‘chirish", "Удалить аккаунт и данные"], ["Video ruxsat muddati noto‘g‘ri.", "Некорректный срок доступа к видео."], ["Brauzer HLS ijrosini qo‘llamaydi.", "Браузер не поддерживает воспроизведение HLS."],
  ["Video oqimi ijro etilmadi.", "Не удалось воспроизвести видеопоток."], ["HLS pleyerini yuklab bo‘lmadi.", "Не удалось загрузить HLS-плеер."], ["ArniyGym HLS video", "Видео ArniyGym HLS"], ["Oynani yopish", "Закрыть окно"],
  ["Vaznni 20–350 kg oralig‘ida kiriting.", "Укажите вес от 20 до 350 кг."], ["Masalan, 74.0", "Например, 74,0"], ["Bir stakan kamaytirish", "Убрать один стакан"], ["Bir stakan qo‘shish", "Добавить один стакан"], ["Hisobdan chiqdingiz", "Вы вышли из аккаунта"],
  ["Mashg‘ulot jurnalini ishlatish uchun avval Telegram orqali kiring.", "Войдите через Telegram, чтобы использовать журнал тренировок."], ["Mashg‘ulot tarixi yuklanmadi.", "Не удалось загрузить историю тренировок."],
  ["Mashg‘ulotni saqlash uchun tizimga kiring.", "Войдите, чтобы сохранить тренировку."], ["Set, takror va vazn miqdorini tekshiring.", "Проверьте количество подходов, повторов и вес."],
  ["Mashg‘ulot qaydi saqlanmadi.", "Не удалось сохранить тренировку."], ["Mashg‘ulot qaydi saqlandi.", "Тренировка сохранена."], ["Jurnalni yopish", "Закрыть журнал"], ["Jurnalga qayd", "Записать в журнал"],
  ["Yelkani kuchaytir", "Укрепи плечи"], ["Barqarorlik, kuch va nazorat.", "Стабильность, сила и контроль."], ["Qo‘l oldi", "Бицепс"], ["QO‘L OLDI", "БИЦЕПС"], ["Qo‘l oldi mashqlari", "Упражнения на бицепс"], ["Nazoratli harakat, aniq natija.", "Контролируемое движение — точный результат."],
  ["Qo‘l orqa", "Трицепс"], ["QO‘L ORQA", "ТРИЦЕПС"], ["Qo‘l orqa mashqlari", "Упражнения на трицепс"], ["Kuchli itarish harakatlari.", "Сильные толчковые движения."],
  ["Keng va kuchli bel", "Широкая и сильная спина"], ["Orqa mushaklar uchun asosiy mashqlar.", "Основные упражнения для мышц спины."], ["Ko‘krak", "Грудь"], ["KO‘KRAK", "ГРУДЬ"], ["Ko‘krak mashqlari", "Упражнения на грудь"], ["Texnika birinchi o‘rinda.", "Техника прежде всего."], ["Oyoq kuni", "День ног"], ["Kuchli poydevor shu yerdan.", "Сильная основа начинается здесь."], ["Aniq texnika va izchil progress.", "Точная техника и последовательный прогресс."],
  ["Hisobingiz boshqa qurilmada ochildi. Bu qurilmadagi sessiya yakunlandi.", "В аккаунт вошли с другого устройства. Сессия на этом устройстве завершена."], ["Suv hisobi saqlanmadi. Qayta urinib ko‘ring.", "Не удалось сохранить количество воды. Попробуйте ещё раз."], ["Vazn saqlanmadi. Qayta urinib ko‘ring.", "Не удалось сохранить вес. Попробуйте ещё раз."], ["Vazn qayd etildi", "Вес записан"],
  ["Biz haqimizda — ArniyGym", "О нас — ArniyGym"], ["Massa yig‘ish, ozish, AI taom tahlili va kunlik kaloriya kalkulyatori.", "Набор массы, снижение веса, анализ еды с ИИ и дневной калькулятор калорий."],
  ["Mushak guruhlari bo‘yicha mashqlar, dam olish taymeri va shaxsiy mashg‘ulot jurnali.", "Тренировки по группам мышц, таймер отдыха и личный журнал занятий."], ["ArniyGym fitnes platformasi: mashqlar, ovqatlanish va progress kuzatuvi.", "Фитнес-платформа ArniyGym: тренировки, питание и отслеживание прогресса."],
  ["ArniyGym bosh sahifa", "Главная страница ArniyGym"], ["Menyuni yopish", "Закрыть меню"], ["Navigatsiya menyusini ochish", "Открыть меню навигации"], ["Asosiy navigatsiya", "Основная навигация"],
  ["Masalan, 75", "Например, 75"], ["Masalan, 175", "Например, 175"], ["Masalan, 25", "Например, 25"], ["Jinsiy ko‘rsatkich", "Пол"], ["Menyu yuklanmadi. Keyinroq qayta urinib ko‘ring.", "Не удалось загрузить меню. Попробуйте позже."],
  ["Aqlli kalkulyator, AI taom tahlili va maqsadingga mos menyu.", "Умный калькулятор, анализ еды с ИИ и меню под твою цель."], ["Menyu hali qo‘shilmagan", "Меню пока не добавлено"], ["Murabbiy yo‘riqnomasi", "Инструкция тренера"], ["BIZ HAQIMIZDA", "О НАС"],
  ["ArniyGym — mashg‘ulotni va sog‘lom odatlarni kundalik hayotga yaqinlashtiradigan platforma.", "ArniyGym помогает встроить тренировки и здоровые привычки в повседневную жизнь."], ["Texnikani o‘rganish, to‘g‘ri reja tuzish va izchil davom etishga yordam beramiz.", "Мы помогаем изучать технику, составлять подходящий план и регулярно ему следовать."],
  ["Premium tajriba, haqiqiy odatlar va sening ritmingga mos reja.", "Премиальный опыт, реальные привычки и план в твоём ритме."], ["Birga kuchliroq bo‘lamiz.", "Станем сильнее вместе."], ["USER ID", "ID ПОЛЬЗОВАТЕЛЯ"],
  ["Sevimlilarga saqlash uchun Telegram orqali kiring.", "Войдите через Telegram, чтобы сохранять избранное."], ["Sevimli mashq o‘zgartirilmadi.", "Не удалось изменить избранное упражнение."],
  ["Videolarni ochish uchun Telegram orqali kiring.", "Войдите через Telegram, чтобы открыть видео."], ["Mashq videolari faqat faol obuna bilan ochiladi.", "Видео тренировок доступны только при активном членстве."], ["Video hozircha mavjud emas.", "Видео пока недоступно."],
  ["Taymerni boshlash", "Запустить таймер"], ["Mashqlarni qidirish", "Поиск упражнений"], ["Mashq yoki texnika bo‘yicha qidirish", "Поиск по упражнению или технике"],
  ["Bu bo‘limda saqlangan sevimli mashq yo‘q.", "В этом разделе пока нет избранных упражнений."], ["Qidiruv bo‘yicha mashq topilmadi yoki hali e’lon qilinmagan.", "По вашему запросу упражнения не найдены или ещё не опубликованы."],
  ["Texnikani nazorat qiling.", "Следите за техникой."], ["Sevimlilardan olib tashlash", "Убрать из избранного"], ["Sevimlilarga qo‘shish", "Добавить в избранное"],
  ["Operator va qonuniy to‘lov shartlari kiritilmaguncha to‘lov yopiq.", "Оплата отключена, пока не указаны оператор и юридические условия оплаты."], ["To‘lov provayderi javobi noto‘g‘ri.", "Получен некорректный ответ платёжного провайдера."],
  ["Checkout ochilmadi. Sozlamalarni tekshirib qayta urinib ko‘ring.", "Не удалось открыть страницу оплаты. Проверьте настройки и попробуйте ещё раз."],
  ["Ochiq mashqlar ro‘yxati", "Список общедоступных упражнений"], ["Kaloriya kalkulyatori", "Калькулятор калорий"], ["Suv va progress hisoblagichi", "Учёт воды и прогресса"],
  ["Robot tekshiruvi yuklanmadi. Sahifani yangilab urinib ko‘ring.", "Не удалось загрузить проверку от ботов. Обновите страницу и попробуйте ещё раз."], ["Kod muddati tugadi. Qaytadan boshlang.", "Срок действия кода истёк. Начните заново."],
  ["Hisob ochish maxfiylik va huquqiy ma’lumotlar to‘ldirilgunga qadar yopiq.", "Регистрация закрыта, пока не заполнены сведения о конфиденциальности и юридические данные."],
  ["Foydalanish shartlari va maxfiylik siyosatiga rozilik bering.", "Примите условия использования и политику конфиденциальности."], ["Robot tekshiruvini bajaring.", "Пройдите проверку от ботов."],
  ["Kirish xizmati mavjud emas.", "Сервис входа недоступен."], ["ArniyGym’ga xush kelibsiz", "Добро пожаловать в ArniyGym"], ["Kod noto‘g‘ri yoki muddati tugagan. Qayta urinib ko‘ring.", "Код неверен или срок его действия истёк. Попробуйте ещё раз."],
  ["Sarlavha (o‘zbekcha)", "Заголовок (узбекский)"], ["Sarlavha (ruscha)", "Заголовок (русский)"], ["Qisqa ta’rif (o‘zbekcha)", "Краткое описание (узбекский)"], ["Qisqa ta’rif (ruscha)", "Краткое описание (русский)"],
  ["Maqsad sarlavhasi", "Заголовок цели"], ["Maqsad matni", "Описание цели"], ["Jamoa sarlavhasi (o‘zbekcha)", "Заголовок команды (узбекский)"], ["Jamoa sarlavhasi (ruscha)", "Заголовок команды (русский)"],
  ["Jamoa matni", "Описание команды"], ["Ijtimoiy tarmoq sarlavhasi", "Заголовок социальных сетей"], ["Aloqa telefoni", "Контактный телефон"], ["Aloqa emaili", "Контактная электронная почта"], ["Xarita havolasi", "Ссылка на карту"], ["Telegram havolasi", "Ссылка на Telegram"], ["Instagram havolasi", "Ссылка на Instagram"],
  ["Avtomatik to‘lovlar tarixini yuklab bo‘lmadi.", "Не удалось загрузить историю автоматических платежей."], ["To‘lovlar uchun a’zo nomlari yuklanmadi.", "Не удалось загрузить имена участников для платежей."], ["Masalan: 2 100–2 300", "Например: 2 100–2 300"],
  ["Taom tarkibi yoki porsiya", "Состав блюда или порция"], ["Taomni olib tashlash", "Удалить блюдо"], ["Har bir tavsiyani alohida qatorda yozing.", "Запишите каждую рекомендацию с новой строки."],
  ["Supabase sozlanmagan.", "Supabase не настроен."], ["Rasm faylini tanlang.", "Выберите файл изображения."], ["Rasm qayta ishlanmadi.", "Не удалось обработать изображение."], ["WebP formatiga o‘girib bo‘lmadi.", "Не удалось преобразовать изображение в WebP."], ["Rasm 10 MB dan katta. Kichikroq rasm tanlang.", "Изображение больше 10 МБ. Выберите файл меньшего размера."],
  ["WebP rasm yuklandi. Sayt matnlarini saqlang.", "Изображение WebP загружено. Сохраните тексты сайта."], ["Rasm yuklanmadi.", "Не удалось загрузить изображение."], ["Rasm ombordan o‘chirilmadi.", "Не удалось удалить изображение из хранилища."], ["WebP tayyorlanmoqda…", "Подготавливаем WebP…"], ["WebP galereyaga yuklash", "Загрузить WebP в галерею"], ["Galereya oldindan ko‘rinishi", "Предпросмотр галереи"], ["Galereya rasmini o‘chirish", "Удалить фото из галереи"], ["Murabbiyni olib tashlash", "Удалить тренера"], ["Sharhni olib tashlash", "Удалить отзыв"], ["Savolni olib tashlash", "Удалить вопрос"],
  ["Zal jadvali yoki so‘rovlarini yuklab bo‘lmadi.", "Не удалось загрузить расписание зала или запросы."], ["A’zo ismlari yuklanmadi.", "Не удалось загрузить имена участников."], ["QR kodini tekshirib bo‘lmadi.", "Не удалось проверить QR-код."], ["Bu brauzer QR skanerlashni qo‘llamaydi. QR kod matnini pastga qo‘lda kiriting.", "Этот браузер не поддерживает сканирование QR-кодов. Введите текст QR-кода ниже вручную."], ["Kamera ochilmadi. Brauzer ruxsatini tekshiring yoki QR matnini qo‘lda kiriting.", "Не удалось открыть камеру. Проверьте разрешение браузера или введите текст QR-кода вручную."],
  ["Kelajakdagi sana va vaqtni tanlang.", "Выберите будущую дату и время."], ["Mashg‘ulot jadvalga qo‘shilmadi. Maydonlarni tekshiring.", "Не удалось добавить тренировку в расписание. Проверьте поля."], ["Mashg‘ulot jadvalga qo‘shildi.", "Тренировка добавлена в расписание."], ["A’zolik muzlatish so‘rovi tasdiqlandi.", "Запрос на заморозку членства одобрен."], ["A’zolik muzlatish so‘rovi rad etildi.", "Запрос на заморозку членства отклонён."], ["So‘rovni yangilab bo‘lmadi.", "Не удалось обновить запрос."], ["Masalan: Kuch mashg‘uloti", "Например: силовая тренировка"], ["Ism (ixtiyoriy)", "Имя (необязательно)"], ["Jadvalga qo‘shish", "Добавить в расписание"], ["Murabbiy yo‘q", "Тренер не указан"], ["Mashg‘ulot yopilmadi.", "Не удалось закрыть тренировку."], ["Mashg‘ulot bekor qilindi.", "Тренировка отменена."], ["QR kodni skanerlang yoki matnini kiriting", "Отсканируйте QR-код или введите его текст"], ["A’zolik QR kodi", "QR-код членства"], ["Sabab ko‘rsatilmagan", "Причина не указана"], ["Muzlatishni tasdiqlash", "Подтвердить заморозку"], ["Muzlatishni rad etish", "Отклонить заморозку"],
  ["Yuridik nomi", "Юридическое наименование"], ["Yuridik manzil", "Юридический адрес"], ["Telefon ma’lumotidan foydalanish maqsadi", "Цель использования номера телефона"], ["Telefon ma’lumotini saqlash muddati va o‘chirish qoidasi", "Срок хранения номера телефона и правила удаления"], ["Sog‘liq ma’lumotini saqlash muddati va o‘chirish qoidasi", "Срок хранения данных о здоровье и правила удаления"], ["Qaytarish va bekor qilish qoidalari", "Правила возврата и отмены"], ["Avtomatik uzaytirish va to‘lov haqida ogohlantirish", "Уведомление об автопродлении и оплате"], ["Barcha huquqiy maydonlarni to‘ldirmasdan to‘lovni yoqib bo‘lmaydi.", "Нельзя включить оплату, не заполнив все юридические поля."], ["Huquqiy sozlamalar saqlandi; kirish va to‘lovlar yoqildi.", "Юридические настройки сохранены; вход и оплата включены."], ["Huquqiy matnlar saqlandi; kirish va to‘lovlar yopiq qoladi.", "Юридические тексты сохранены; вход и оплата останутся отключёнными."], ["Ma’lumotlar saqlanmadi. JSON formatini tekshiring.", "Не удалось сохранить данные. Проверьте формат JSON."], ["Huquqiy ma’lumotlarni saqlash", "Сохранить юридическую информацию"],
  ["Ism yoki telefon raqamidan kamida 2 ta belgi kiriting.", "Введите не менее двух символов имени или номера телефона."], ["Mos a’zo topilmadi.", "Подходящий участник не найден."], ["A’zolarni qidirib bo‘lmadi. Qayta urinib ko‘ring.", "Не удалось найти участников. Попробуйте ещё раз."], ["A’zo tarixi to‘liq yuklanmadi.", "История участника загружена не полностью."], ["A’zo ma’lumotlarini yuklab bo‘lmadi.", "Не удалось загрузить данные участника."], ["A’zoga qo‘lda berilgan muddat qo‘shildi.", "Участнику вручную добавлен срок членства."], ["A’zolik muddatini berib bo‘lmadi.", "Не удалось назначить срок членства."], ["Ism yoki telefon raqami", "Имя или номер телефона"], ["Ismi kiritilmagan", "Имя не указано"], ["Noma’lum qurilma", "Неизвестное устройство"], ["Faol qurilma sessiyasi topilmadi.", "Активная сессия устройства не найдена."],
  ["Suv hisobini saqlash uchun kiring.", "Войдите, чтобы сохранять количество воды."], ["Vaznni saqlash uchun kiring.", "Войдите, чтобы сохранять вес."], ["Safari’da Share → Add to Home Screen ni tanlang.", "В Safari выберите «Поделиться» → «На экран Домой»."], ["Brauzer menyusidan “Install app” yoki “Add to Home Screen” ni tanlang.", "В меню браузера выберите «Установить приложение» или «Добавить на главный экран»."],
  ["Admin kodi muddati tugadi. Qaytadan boshlang.", "Срок действия кода администратора истёк. Начните заново."], ["Kirish ma’lumotlari noto‘g‘ri yoki so‘rov bajarilmadi.", "Данные для входа неверны или запрос не выполнен."], ["Backend is not configured", "Сервер не настроен"], ["Admin sessiyasi tasdiqlandi.", "Сессия администратора подтверждена."], ["Telegram kodi noto‘g‘ri yoki muddati tugagan.", "Код Telegram неверен или срок его действия истёк."], ["Telegram kodini kiriting.", "Введите код из Telegram."], ["Admin sifatida kiring.", "Войдите как администратор."], ["Admin Telegram botiga yuborilgan 6 xonali kodni kiriting.", "Введите 6-значный код, отправленный в бот администратора Telegram."], ["Login va paroldan so‘ng tasdiqlash kodi tasdiqlangan admin Telegram akkauntiga yuboriladi.", "После ввода логина и пароля код подтверждения будет отправлен в подтверждённый аккаунт администратора Telegram."],
  ["Hisobot ma’lumotlari yuklanmadi.", "Не удалось загрузить данные отчёта."], ["Cheklar sahifasini yuklab bo‘lmadi.", "Не удалось загрузить страницу квитанций."], ["Obunalar sahifasini yuklab bo‘lmadi.", "Не удалось загрузить страницу членств."], ["To‘lov holati yangilandi.", "Статус платежа обновлён."], ["Biz haqimizda saqlandi", "Раздел «О нас» сохранён"], ["Rekvizitlar saqlanmadi. Qayta urinib ko‘ring.", "Не удалось сохранить реквизиты. Попробуйте ещё раз."], ["P2P rekvizitlari saqlandi.", "Реквизиты P2P сохранены."], ["Bo‘limlar", "Разделы"], ["To‘lovlar", "Платежи"], ["Chekni tasdiqlash", "Подтвердить квитанцию"], ["Chekni rad etish", "Отклонить квитанцию"], ["Slug 2–60 belgili lotin harf, raqam va tire bo‘lishi kerak.", "Slug должен содержать от 2 до 60 символов: латинские буквы, цифры и дефисы."], ["Yangi bo‘lim qo‘shildi", "Новый раздел добавлен"], ["Bo‘lim nomi", "Название раздела"], ["Qisqa tavsif", "Краткое описание"], ["Nashr qilingan", "Опубликовано"], ["Haqiqatan o‘chirasizmi? Bu amalni qaytarib bo‘lmaydi.", "Вы действительно хотите удалить? Это действие нельзя отменить."],
  ["Mashq yangilandi", "Упражнение обновлено"], ["Mashq saqlandi", "Упражнение сохранено"], ["Video yuklandi, mashq qoralama sifatida saqlandi", "Видео загружено, упражнение сохранено как черновик"], ["Mashq nomi", "Название упражнения"], ["Yondashuvlar soni", "Количество подходов"], ["Takrorlar soni", "Количество повторений"], ["Mashq texnikasi", "Техника упражнения"], ["Texnika bo‘yicha ko‘rsatma", "Инструкция по технике"], ["Mashqni saqlash", "Сохранить упражнение"], ["Matnli mashq", "Текстовое упражнение"], ["Video fayl tanla", "Выбрать видеофайл"], ["Videoni Stream’ga yuklash", "Загрузить видео в Stream"],
  ["Dieta yangilandi", "План питания обновлён"], ["Dieta saqlandi", "План питания сохранён"], ["Video fayl 2 GB dan katta bo‘lmasin.", "Размер видеофайла не должен превышать 2 ГБ."], ["Video Cloudflare Stream’ga yuklandi. Rejani nashr qiling.", "Видео загружено в Cloudflare Stream. Опубликуйте план."], ["Reja nomi", "Название плана"], ["Reja nomi (ruscha)", "Название плана (на русском)"], ["Menyu qo‘shish", "Добавить меню"], ["Video dars nomi", "Название видеоурока"], ["Video dars nomi (ruscha)", "Название видеоурока (на русском)"], ["Qisqa tavsif (ixtiyoriy)", "Краткое описание (необязательно)"], ["Qisqa tavsif (ruscha)", "Краткое описание (на русском)"], ["Taom nomi (ruscha)", "Название блюда (на русском)"], ["Tarkibi / izoh (ruscha)", "Состав / примечание (на русском)"], ["Cloudflare Stream’ga yuklash", "Загрузить в Cloudflare Stream"], ["massa yig‘ish", "набор массы"], ["Saytda ko‘rinadi", "Видно на сайте"], ["Saytda ko‘rinishi uchun rejani nashr qiling", "Опубликуйте план, чтобы он появился на сайте"], ["Video dars saqlandi", "Видеоурок сохранён"], ["Video dars ro‘yxatdan olindi", "Видеоурок удалён"], ["Tarif saqlanmadi. Qayta urinib ko‘ring.", "Не удалось сохранить тариф. Попробуйте ещё раз."], ["Tarif nomi", "Название тарифа"], ["Jadval sahifalari", "Страницы таблицы"],
];

const toRussian = new Map([...translations, ...extendedTranslations]);
const toUzbek = new Map([...translations, ...extendedTranslations].map(([uz, ru]) => [ru, uz]));
function preferredLanguage(): AppLanguage {
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'ru' || query === 'uz') return query;
  try { return localStorage.getItem('arniygym-language') === 'ru' ? 'ru' : 'uz'; } catch { return 'uz'; }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(preferredLanguage);
  useEffect(() => {
    const translateTree = (root: ParentNode) => {
      const map = language === 'ru' ? toRussian : toUzbek;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement;
        if (!parent || parent.closest('script,style,textarea')) continue;
        const raw = node.nodeValue || '';
        const trimmed = raw.trim();
        const translated = map.get(trimmed);
        // Skip identity pairs (e.g. 'GYM' → 'GYM'): rewriting the same text would re-trigger the
        // MutationObserver forever and freeze the page.
        if (translated && translated !== trimmed) node.nodeValue = raw.replace(trimmed, translated);
      }
      if (root instanceof HTMLElement) {
        for (const element of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
          for (const attribute of ['placeholder', 'title', 'aria-label', 'alt', 'content']) {
            const value = element.getAttribute(attribute);
            const translated = value && map.get(value.trim());
            if (translated && translated !== value) element.setAttribute(attribute, translated);
          }
        }
      }
    };
    const syncMetadata = () => {
      document.documentElement.lang = language;
      try { localStorage.setItem('arniygym-language', language); } catch { /* storage may be disabled */ }
      const current = new URL(window.location.href);
      current.searchParams.set('lang', language);
      history.replaceState(history.state, '', current.pathname + current.search + current.hash);
      for (const locale of ['uz', 'ru'] as const) {
        let link = document.head.querySelector<HTMLLinkElement>(`link[data-arniy-lang="${locale}"]`);
        if (!link) { link = document.createElement('link'); link.rel = 'alternate'; link.hreflang = locale; link.dataset.arniyLang = locale; document.head.appendChild(link); }
        const href = new URL(window.location.pathname, window.location.origin);
        href.searchParams.set('lang', locale);
        link.href = href.toString();
      }
    };
    syncMetadata();
    translateTree(document.body);
    translateTree(document.head);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData') translateTree(record.target.parentElement || document.body);
        for (const node of Array.from(record.addedNodes)) if (node instanceof HTMLElement) translateTree(node);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  const next = language === 'uz' ? 'ru' : 'uz';
  return <button type="button" className="language-switch" onClick={() => setLanguage(next)} aria-label={language === 'uz' ? 'Переключить на русский' : 'O‘zbek tiliga o‘tish'}>{language === 'uz' ? 'РУ' : 'UZ'}</button>;
}
