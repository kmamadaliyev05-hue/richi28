const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANIYOTGANDA XATOLIKLARNI OLDINI OLISH
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ RICHI28 SYSTEM CONNECTED'))
    .catch((err) => console.error('❌ MongoDB Error:', err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    isVerified: { type: Boolean, default: false },
    gameId: { type: String, default: 'Kiritilmagan' },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    notifications: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, // 'channel', 'app'
    name: String,
    url: String,
    chatId: String
}));

// 2. BOT SOZLAMALARI
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// 3. MULTI-LANG LUG'ATI
const i18n = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli.",
        btn_web: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        back: "⬅️ Ortga",
        sub_req: "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:",
        verify_sub: "✅ Tasdiqlash",
        no_access: "⚠️ Ruxsat yo'q! Avval ID tasdiqlang.",
        id_prompt: "🆔 Platformadagi ID raqamingizni yuboring (Faqat raqam):",
        wallet_text: (bal) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\n\nKamida 50,000 UZS bo'lganda yechish mumkin.`,
        ref_text: (count, link) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta`,
        settings_text: (id, status, notify) => `🛠 <b>SOZLAMALAR</b>\n\n👤 Profil: ${id}\n✅ Status: ${status ? 'Verified' : 'Unverified'}\n🔔 Bildirishnomalar: ${notify ? 'Yoqilgan' : 'O\'chirilgan'}`
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nДобро пожаловать, Агент! Вход выполнен.",
        btn_web: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ",
        back: "⬅️ Назад",
        sub_req: "🔐 Подпишитесь на каналы для доступа к боту:",
        verify_sub: "✅ Проверить",
        no_access: "⚠️ Нет доступа! Сначала подтвердите ID."
    },
    en: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nWelcome, Agent! Access granted.",
        btn_web: "💻 OPEN CONSOLE",
        btn_signals: "🚀 SIGNALS",
        btn_network: "👥 NETWORK",
        btn_wins: "🏆 WINS",
        btn_guide: "📚 GUIDE",
        btn_wallet: "💰 WALLET",
        btn_settings: "🛠 SETTINGS",
        btn_support: "👨‍💻 SUPPORT",
        back: "⬅️ Back",
        sub_req: "🔐 Please subscribe to the channels to access the bot:",
        verify_sub: "✅ Verify",
        no_access: "⚠️ No access! Please verify your ID first."
    }
};

// 4. KLAIATURE GENERATOR
const getMainMenu = (lang, isAdmin) => {
    const t = i18n[lang] || i18n.uz;
    let btns = [
        [Markup.button.callback(t.btn_web, 'open_web')],
        [Markup.button.callback(t.btn_signals, 'menu_signals'), Markup.button.callback(t.btn_network, 'menu_network')],
        [Markup.button.callback(t.btn_wins, 'menu_wins'), Markup.button.callback(t.btn_guide, 'menu_guide')],
        [Markup.button.callback(t.btn_wallet, 'menu_wallet'), Markup.button.callback(t.btn_settings, 'menu_settings')],
        [Markup.button.callback(t.btn_support, 'menu_support')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('⚙️ ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// 5. MAJBURIY OBUNA FILTRI
const checkSub = async (ctx) => {
    if (ctx.from.id === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    for (const chan of channels) {
        try {
            const res = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(res.status)) return false;
        } catch (e) { continue; }
    }
    return true;
};

// 6. ASOSIY HANDLERLAR
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, invitedBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referrals: 1, balance: 1000 } });
        }
    }

    return ctx.reply("🌐 Tilingizni tanlang / Choose language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru"), Markup.button.callback("🇬🇧 English", "lang_en")]
    ]));
});

bot.action(/^lang_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ userId: ctx.from.id }, { lang });
    const isSub = await checkSub(ctx);
    if (!isSub) {
        const chans = await Config.find({ key: 'channel' });
        const btns = chans.map(c => [Markup.button.url(c.name, c.url)]);
        btns.push([Markup.button.callback(i18n[lang].verify_sub, 'verify_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(i18n[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
});

bot.action('verify_sub', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (await checkSub(ctx)) {
        return ctx.editMessageText(i18n[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    }
    await ctx.answerCbQuery("❌ Hali obuna bo'lmagansiz!", { show_alert: true });
});

bot.action('home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

// WEB APP VA SIGNALLAR
bot.action('open_web', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user.isVerified) return ctx.answerCbQuery(i18n[user.lang].no_access, { show_alert: true });
    
    ctx.reply("🟢 KONSOLGA KIRISH RUXSAT ETILDI:", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 TERMINALNI ISHGA TUSHIRISH", `${process.env.WEB_APP_URL}?user=${ctx.from.id}`)],
        [Markup.button.callback(i18n[user.lang].back, 'home')]
    ]));
});

bot.action('menu_signals', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 ID TASDIQLASH", 'verify_id_start')]);
    btns.push([Markup.button.callback(i18n[user.lang].back, 'home')]);
    ctx.editMessageText("🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:", Markup.inlineKeyboard(btns));
});

// 7. ADMIN PANEL
bot.action('admin_main', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("⚙️ <b>ADMIN CONTROL PANEL</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 KANALLAR', 'adm_chans'), Markup.button.callback('📱 ILOVALAR', 'adm_apps')],
            [Markup.button.callback('📊 STATISTIKA', 'adm_stats'), Markup.button.callback('🔙 CHIQUV', 'home')]
        ])
    });
});

bot.action('adm_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    ctx.editMessageText(`📊 <b>STATISTIKA:</b>\n\nJami: ${total}\nTasdiqlangan: ${verified}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Ortga', 'admin_main')]]));
});

// 8. TEXT INPUTLAR
bot.action('verify_id_start', (ctx) => {
    ctx.session.step = 'awaiting_id';
    ctx.reply(i18n.uz.id_prompt);
});

bot.on('text', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return;

    if (ctx.session.step === 'awaiting_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("Iltimos, faqat raqamli ID yuboring!");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text });
        ctx.reply("⏳ Ma'lumot adminga yuborildi. Tasdiqlashni kuting.");
        
        bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>YANGI ID:</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${ctx.message.text}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `approve_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        });
        ctx.session.step = null;
    }
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    const targetId = ctx.match[1];
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
    bot.telegram.sendMessage(targetId, "✅ Tabriklaymiz! ID tasdiqlandi, barcha funksiyalar ochildi.");
    ctx.editMessageText("✅ Foydalanuvchi tasdiqlandi.");
});

// 9. SERVER VA START
const PORT = process.env.PORT || 3000;
express().get('/', (req, res) => res.send('Active')).listen(PORT);

bot.launch().then(() => console.log('🚀 RICHI28 PORTAL LIVE'));

// Error handling
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
