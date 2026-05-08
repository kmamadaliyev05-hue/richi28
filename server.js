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
    lang: { type: String, default: 'uz' }, // Foydalanuvchi tili
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

// --- TARJIMALAR LUG'ATI ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz!",
        sub_req: "Botdan foydalanish uchun kanallarga a'zo bo'ling yoki so'rov yuboring:",
        check: "✅ Tekshirish",
        signal: "🚀 Signal olish",
        vip_signal: "⚡️ Signal olish (VIP)",
        apps: "📱 Ilovalar",
        ref: "👥 Yo'llanma silka",
        platform: "🎯 <b>Platformani tanlang:</b>",
        input_id: "🆔 ID yuboring (faqat raqam):",
        wait_admin: "⏳ Qabul qilindi, admin tasdiqlashini kuting.",
        back: "🔙 Orqaga",
        no_sub: "❌ Obuna yoki so'rov topilmadi!",
        verified: "✅ Tasdiqlandi!"
    },
    ru: {
        welcome: "Добро пожаловать в систему!",
        sub_req: "Для использования бота подпишитесь на каналы или отправьте запрос:",
        check: "✅ Проверить",
        signal: "🚀 Получить сигнал",
        vip_signal: "⚡️ Получить сигнал (VIP)",
        apps: "📱 Приложения",
        ref: "👥 Реферальная ссылка",
        platform: "🎯 <b>Выберите платформу:</b>",
        input_id: "🆔 Отправьте ID (только цифры):",
        wait_admin: "⏳ Принято, ожидайте подтверждения админа.",
        back: "🔙 Назад",
        no_sub: "❌ Подписка или запрос не найдены!",
        verified: "✅ Подтверждено!"
    },
    en: {
        welcome: "Welcome to the system!",
        sub_req: "To use the bot, subscribe to the channels or send a request:",
        check: "✅ Check",
        signal: "🚀 Get Signal",
        vip_signal: "⚡️ Get Signal (VIP)",
        apps: "📱 Apps",
        ref: "👥 Referral link",
        platform: "🎯 <b>Select platform:</b>",
        input_id: "🆔 Send your ID (numbers only):",
        wait_admin: "⏳ Received, wait for admin approval.",
        back: "🔙 Back",
        no_sub: "❌ Subscription or request not found!",
        verified: "✅ Verified!"
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

const getMainMenu = (lang, isAdmin, isVerified) => {
    const t = i18n[lang] || i18n.uz;
    let btns = [
        [isVerified ? Markup.button.webApp(t.vip_signal, `${process.env.WEB_APP_URL}?lang=${lang}`) : Markup.button.callback(t.signal, 'get_signal')],
        [Markup.button.url(t.apps, 'https://t.me/apple_ilovalar')],
        [Markup.button.callback(t.ref, 'ref_menu')]
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
    ctx.session = {}; 
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true, new: true });

    if (user.joinedAt.getTime() === user.lastActive?.getTime() && refId && refId !== id) {
        await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }

    // Har doim til tanlashni ko'rsatamiz (yoki faqat birinchi marta)
    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык / 🇬🇧 Select language:", 
        Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]
        ])
    );
});

// Tilni saqlash
bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang: lang }, { new: true });
    const t = i18n[lang];
    
    const access = await canAccess(ctx);
    if (!access) {
        return ctx.editMessageText(t.sub_req, await getJoinMenu(lang));
    }

    ctx.editMessageText(
        `<b>RICHI28 APPLE</b> ${t.welcome}\n\n👤 ${ctx.from.first_name}\n🆔 ID: <code>${ctx.from.id}</code>`, 
        { parse_mode: 'HTML', ...getMainMenu(lang, ctx.from.id === ADMIN_ID, user.isVerified) }
    );
});

bot.action('check_sub', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const access = await canAccess(ctx);
    const t = i18n[user.lang] || i18n.uz;

    if (access) {
        return ctx.editMessageText(t.verified, getMainMenu(user.lang, ctx.from.id === ADMIN_ID, user.isVerified));
    }
    await ctx.answerCbQuery(t.no_sub, { show_alert: true });
});

// 4. SIGNAL & REFERRAL
bot.action('get_signal', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang] || i18n.uz;

    if (!(await canAccess(ctx))) return ctx.editMessageText(t.sub_req, await getJoinMenu(user.lang));

    const apps = await Config.find({ key: 'app' });
    if (apps.length === 0) return ctx.answerCbQuery("...");
    
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
    ctx.editMessageText(t.verified, { parse_mode: 'HTML', ...getMainMenu(user.lang, ctx.from.id === ADMIN_ID, user.isVerified) });
});

// --- ADMIN VA BOSHQA FUNKSIYALAR OLDINGI KODINGIZDAGI KABI QOLADI ---
// (Faqat xabar yuborishda foydalanuvchi tiliga qarab yuborishni ham qo'shishingiz mumkin)

bot.on(['text', 'photo', 'video', 'animation', 'document'], async (ctx) => {
    const step = ctx.session.step;
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user?.lang || 'uz'];

    if (step === 'input_id' && ctx.message.text) {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply(user.lang === 'uz' ? "Faqat raqam!" : "Only numbers!");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.selectedApp });
        ctx.session = {};
        ctx.reply(t.wait_admin);
        
        bot.telegram.sendMessage(ADMIN_ID, `🆔 ID: <code>${ctx.message.text}</code>\n👤: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `confirm_${ctx.from.id}`), Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]]) });
        return;
    }
    // ...BC_MEDIA va boshqa admin funksiyalari...
    if (ctx.from.id === ADMIN_ID && step === 'bc_media') {
        const users = await User.find();
        for (let u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
        ctx.session = {}; ctx.reply("✅ Sent!");
    }
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

bot.launch().then(() => console.log('🚀 RICHI28 MULTI-LANG LIVE'));

const app = express();
app.get('/', (req, res) => res.send('Online'));
app.listen(process.env.PORT || 3000);
