const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR BAZASI ULANISHI
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ MongoDB Connected');
    try {
        await mongoose.connection.db.collection('configs').dropIndexes();
    } catch (e) { console.log('ℹ️ Indekslar toza'); }
    seedApps(); 
});

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    status: { type: String, default: 'new' },
    isVerified: { type: Boolean, default: false },
    gameId: String,
    bookmaker: String,
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}, { autoIndex: false, validateBeforeSave: false, timestamps: true }));

// --- MULTI-LANG LUG'ATI ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz!",
        sub_req: "Botdan foydalanish uchun kanallarga a'zo bo'ling yoki so'rov yuboring:",
        check: "✅ Tekshirish",
        signal: "🚀 Signal olish",
        vip_signal: "⚡️ Signal olish (VIP)",
        apps: "📱 Ilovalar",
        ref: "👥 Yo'llanma silka",
        guide: "📖 Bot bilan tanishish",
        terms: "📜 Signal olish shartlari",
        platform: "🎯 <b>Platformani tanlang:</b>",
        input_id: "🆔 ID yuboring (faqat raqam):",
        wait_admin: "⏳ Qabul qilindi, admin tasdiqlashini kuting.",
        back: "🔙 Orqaga",
        no_sub: "❌ Obuna yoki so'rov topilmadi!",
        verified: "✅ Tasdiqlandi!",
        ref_text: (count, task, link) => `👥 <b>Referal tizimi</b>\n\n📊 Odamlar: <b>${count}</b> ta\n🎯 Vazifa: <b>${task}</b> ta\n\n🔗 Havolangiz:\n<code>${link}</code>`,
        terms_text: "<b>📜 SIGNAL OLISH SHARTLARI:</b>\n\n1. Ro'yxatdan o'tishda <b>RICHI28</b> promokodini ishlating.\n2. Balansni kamida 60,000 so'mga to'ldiring.\n3. O'yin ID raqamini botga yuboring.\n\n⚠️ Diqqat: Shartlar bajarilmasa, Hack tizimi xato ishlashi mumkin!",
        guide_text: "<b>📖 BOTDAN FOYDALANISH QO'LLANMASI:</b>\n\n1. Avval kanallarga obuna bo'ling.\n2. 'Signal olish' tugmasini bosing.\n3. O'zingiz o'ynayotgan platformani tanlang va ID yuboring.\n4. Admin tasdiqlagach, VIP tugmasi orqali Web App'ga kiring.\n5. O'yinni tanlang va 'GET SIGNAL' bosing!"
    },
    ru: {
        welcome: "Добро пожаловать в систему!",
        sub_req: "Для использования бота подпишитесь на каналы или отправьте запрос:",
        check: "✅ Проверить",
        signal: "🚀 Получить сигнал",
        vip_signal: "⚡️ Получить сигнал (VIP)",
        apps: "📱 Приложения",
        ref: "👥 Рефералка",
        guide: "📖 Инструкция",
        terms: "📜 Условия получения",
        platform: "🎯 <b>Выберите платформу:</b>",
        input_id: "🆔 Отправьте ID (только цифры):",
        wait_admin: "⏳ Принято, ожидайте подтверждения.",
        back: "🔙 Назад",
        no_sub: "❌ Подписка не найдена!",
        verified: "✅ Подтверждено!",
        ref_text: (count, task, link) => `👥 <b>Реферальная система</b>\n\n📊 Людей: <b>${count}</b>\n🎯 Задание: <b>${task}</b>\n\n🔗 Ссылка:\n<code>${link}</code>`,
        terms_text: "<b>📜 УСЛОВИЯ ПОЛУЧЕНИЯ СИГНАЛА:</b>\n\n1. Используйте промокод <b>RICHI28</b> при регистрации.\n2. Пополните баланс минимум на 500 рублей.\n3. Отправьте ваш ID боту.",
        guide_text: "<b>📖 ИНСТРУКЦИЯ:</b>\n\n1. Подпишитесь на каналы.\n2. Нажмите 'Получить сигнал'.\n3. Выберите платформу и отправьте ID.\n4. После одобрения войдите в Web App.\n5. Выберите игру и нажмите 'GET SIGNAL'!"
    },
    en: {
        welcome: "Welcome to the system!",
        sub_req: "Subscribe to the channels to use the bot:",
        check: "✅ Check",
        signal: "🚀 Get Signal",
        vip_signal: "⚡️ Get Signal (VIP)",
        apps: "📱 Apps",
        ref: "👥 Referral link",
        guide: "📖 How to use",
        terms: "📜 Terms & Conditions",
        platform: "🎯 <b>Select platform:</b>",
        input_id: "🆔 Send ID (numbers only):",
        wait_admin: "⏳ Received, wait for approval.",
        back: "🔙 Back",
        no_sub: "❌ Subscription not found!",
        verified: "✅ Verified!",
        ref_text: (count, task, link) => `👥 <b>Referral System</b>\n\n📊 People: <b>${count}</b>\n🎯 Task: <b>${task}</b>\n\n🔗 Link:\n<code>${link}</code>`,
        terms_text: "<b>📜 TERMS FOR SIGNALS:</b>\n\n1. Use promo code <b>RICHI28</b> during registration.\n2. Top up balance (min. $5).\n3. Send your ID to the bot.",
        guide_text: "<b>📖 USER GUIDE:</b>\n\n1. Subscribe to channels.\n2. Click 'Get Signal'.\n3. Choose platform and send ID.\n4. After approval, enter Web App.\n5. Select game and click 'GET SIGNAL'!"
    }
};

async function seedApps() {
    const defaultApps = ['1XBET', 'LINEBET', 'WINWIN', '888STARZ'];
    for (const appName of defaultApps) {
        const exists = await Config.findOne({ key: 'app', name: appName });
        if (!exists) await Config.create({ key: 'app', name: appName });
    }
}

// 2. BOT SOZLAMALARI
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    const user = await User.findOne({ userId: uid });
    let isSubscribed = false;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            if (['member', 'administrator', 'creator'].includes(member.status)) {
                isSubscribed = true;
                break; 
            }
        } catch (e) { continue; }
    }
    if (!isSubscribed) {
        if (user && user.status === 'requested') return true;
        if (user && user.status !== 'new') await User.findOneAndUpdate({ userId: uid }, { status: 'new' });
        return false;
    }
    return true;
}

const getMainMenu = (u, isAdmin) => {
    const t = i18n[u.lang || 'uz'];
    let btns = [
        [u.isVerified ? Markup.button.webApp(t.vip_signal, `${process.env.WEB_APP_URL}?lang=${u.lang}`) : Markup.button.callback(t.signal, 'get_signal')],
        [Markup.button.callback(t.terms, 'show_terms'), Markup.button.callback(t.guide, 'show_guide')],
        [Markup.button.url(t.apps, 'https://t.me/apple_ilovalar'), Markup.button.callback(t.ref, 'ref_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

const getJoinMenu = async (lang) => {
    const t = i18n[lang] || i18n.uz;
    const channels = await Config.find({ key: 'channel' });
    const btns = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
    btns.push([Markup.button.callback(t.check, 'check_sub')]);
    return Markup.inlineKeyboard(btns);
};

// 3. START & LANG SELECTION
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true, new: true });

    // Referal mantiqi
    if (user.joinedAt.getTime() > (Date.now() - 5000) && refId && refId !== id) {
        await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }

    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык / 🇬🇧 Select language:", 
        Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]
        ])
    );
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang: lang }, { new: true });
    const t = i18n[lang];
    
    if (!(await canAccess(ctx))) return ctx.editMessageText(t.sub_req, await getJoinMenu(lang));

    ctx.editMessageText(
        `<b>RICHI28 APPLE</b> ${t.welcome}\n\n👤 ${ctx.from.first_name}\n🆔 ID: <code>${ctx.from.id}</code>`, 
        { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) }
    );
});

bot.action('check_sub', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const access = await canAccess(ctx);
    const t = i18n[user.lang] || i18n.uz;
    if (access) return ctx.editMessageText(t.verified, getMainMenu(user, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery(t.no_sub, { show_alert: true });
});

// 4. SIGNAL, GUIDE & REFERRAL
bot.action('show_terms', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;
    ctx.editMessageText(t.terms_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t.back, 'back_home')]]) });
});

bot.action('show_guide', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;
    ctx.editMessageText(t.guide_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t.back, 'back_home')]]) });
});

bot.action('ref_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(t.ref_text(user.referralCount, user.refTask, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t.back, 'back_home')]]) });
});

bot.action('get_signal', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;
    if (!(await canAccess(ctx))) return ctx.editMessageText(t.sub_req, await getJoinMenu(user.lang));
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `select_app_${a.name}`)]);
    btns.push([Markup.button.callback(t.back, 'back_home')]);
    ctx.editMessageText(t.platform, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^select_app_(.+)$/, async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;
    ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'input_id';
    ctx.editMessageText(`🎯 PLATFORM: ${ctx.session.selectedApp}\n\n${t.input_id}`, Markup.inlineKeyboard([[Markup.button.callback(t.back, 'get_signal')]]));
});

bot.action('back_home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;
    ctx.editMessageText(`<b>RICHI28 APPLE</b>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

// 5. ADMIN PANEL & HANDLERS
bot.on(['text', 'photo', 'video', 'animation', 'document'], async (ctx) => {
    const step = ctx.session.step;
    const user = await User.findOne({ userId: ctx.from.id });
    if (step === 'input_id' && ctx.message.text) {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply(user.lang === 'uz' ? "Faqat raqam!" : "Numbers only!");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.selectedApp });
        ctx.session = {};
        ctx.reply(i18n[user.lang].wait_admin);
        bot.telegram.sendMessage(ADMIN_ID, `🆔 ID: <code>${ctx.message.text}</code>\n👤: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `confirm_${ctx.from.id}`), Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]]) });
        return;
    }
    if (ctx.from.id === ADMIN_ID && step === 'bc_media') {
        const users = await User.find();
        for (let u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
        ctx.session = {}; ctx.reply("✅ Sent!");
    }
});

// Confirm/Reject Logic
bot.action(/^confirm_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "✅ VIP UNLOCKED!");
    ctx.editMessageText("✅ Confirmed!");
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

bot.launch().then(() => console.log('🚀 RICHI28 SYSTEM LIVE'));

const app = express();
app.get('/', (req, res) => res.send('Online'));
app.listen(process.env.PORT || 3000);
