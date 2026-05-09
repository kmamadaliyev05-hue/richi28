const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE STRUKTURASI
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ RICHI28 DB CONNECTED'));

const UserSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    isVerified: { type: Boolean, default: false },
    gameId: { type: String, default: 'Kiritilmagan' },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    joinedAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
    key: String, // 'channel' yoki 'app'
    name: String,
    url: String,
    chatId: String
});

const User = mongoose.model('User', UserSchema);
const Config = mongoose.model('Config', ConfigSchema);

// 2. BOTNI SOZLASH
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });

// 3. LUG'AT (Matrix Style)
const i18n = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli yakunlandi.",
        main_menu: "💻 ASOSIY TERMINAL:",
        btn_web: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        no_access: "⚠️ ERROR: Ruxsat yo'q! Avval [SIGNALLAR] bo'limida ID tasdiqlang.",
        id_prompt: "🆔 Platformadagi ID raqamingizni yuboring:",
        wait_admin: "⏳ Ma'lumot yuborildi. Tizim tasdiqlashini kuting.",
        back: "🔙 ORQAGA",
        ref_text: (count, link) => `👥 <b>TARMOQ STATUSI</b>\n\n📊 Takliflar: ${count} ta\n🔗 Havolangiz: <code>${link}</code>\n\n🎁 Mukofot: 5 ta = 5,000 | 10 ta = 13,000 UZS`
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nДобро пожаловать, Агент! Вход выполнен.",
        main_menu: "💻 ГЛАВНЫЙ ТЕРМИНАЛ:",
        btn_web: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ",
        no_access: "⚠️ ERROR: Доступ запрещен! Сначала подтвердите ID в [СИГНАЛЫ].",
        id_prompt: "🆔 Отправьте ваш ID номер платформы:",
        wait_admin: "⏳ Данные отправлены. Ожидайте подтверждения системы.",
        back: "🔙 НАЗАД",
        ref_text: (count, link) => `👥 <b>СТАТУС СЕТИ</b>\n\n📊 Рефералы: ${count}\n🔗 Ссылка: <code>${link}</code>`
    },
    en: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nWelcome, Agent! System access granted.",
        main_menu: "💻 MAIN TERMINAL:",
        btn_web: "💻 OPEN CONSOLE",
        btn_signals: "🚀 SIGNALS",
        btn_network: "👥 NETWORK",
        btn_wins: "🏆 WINS",
        btn_guide: "📚 GUIDE",
        btn_wallet: "💰 WALLET",
        btn_settings: "🛠 SETTINGS",
        btn_support: "👨‍💻 CONTACT ADMIN",
        no_access: "⚠️ ERROR: Access denied! Confirm your ID in [SIGNALS] first.",
        id_prompt: "🆔 Send your platform ID number:",
        wait_admin: "⏳ Data sent. Wait for system approval.",
        back: "🔙 BACK",
        ref_text: (count, link) => `👥 <b>NETWORK STATUS</b>\n\n📊 Referrals: ${count}\n🔗 Link: <code>${link}</code>`
    }
};

// 4. KLAVIATURA GENERATORI
const getMenu = (u, isAdmin) => {
    const t = i18n[u.lang];
    const btns = [
        [Markup.button.callback(t.btn_web, 'open_console')],
        [Markup.button.callback(t.btn_signals, 'signals_menu'), Markup.button.callback(t.btn_network, 'network_menu')],
        [Markup.button.callback(t.btn_wins, 'wins_menu'), Markup.button.callback(t.btn_guide, 'guide_menu')],
        [Markup.button.callback(t.btn_wallet, 'wallet_menu'), Markup.button.callback(t.btn_settings, 'settings_menu')],
        [Markup.button.callback(t.btn_support, 'support_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('👑 ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// 5. ASOSIY LOGIKA
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, invitedBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referrals: 1 } });
        }
    }

    return ctx.reply("🌐 Select Language / Tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 UZ", "set_uz"), Markup.button.callback("🇷🇺 RU", "set_ru"), Markup.button.callback("🇬🇧 EN", "set_en")]
    ]));
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    ctx.editMessageText(i18n[lang].welcome, getMenu(user, ctx.from.id === ADMIN_ID));
});

// KONSOLNI OCHISH (VERIFICATION CHECK)
bot.action('open_console', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user.isVerified) {
        return ctx.answerCbQuery(i18n[user.lang].no_access, { show_alert: true });
    }
    const webAppUrl = `${process.env.WEB_APP_URL}?lang=${user.lang}&id=${user.gameId}`;
    ctx.reply("🟢 KONSOLGA KIRISH RUXSAT ETILDI:", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 TERMINALNI ISHGA TUSHIRISH", webAppUrl)]
    ]));
});

// SIGNALLAR (ILOVALAR)
bot.action('signals_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 ID TASDIQLASH", 'verify_id')]);
    btns.push([Markup.button.callback(i18n[user.lang].back, 'home')]);
    ctx.editMessageText("🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:", Markup.inlineKeyboard(btns));
});

bot.action('verify_id', (ctx) => {
    ctx.session.step = 'get_id';
    ctx.reply(i18n[ctx.session.lang || 'uz'].id_prompt);
});

// YUTUQLAR (FAKE LOG GENERATOR)
bot.action('wins_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const games = ['Apple', 'Kamikaze', 'Dragon', 'Mines', 'Crash'];
    let logs = "🏆 <b>LIVE HACK LOGS:</b>\n\n";
    for(let i=0; i<5; i++) {
        const id = Math.floor(Math.random() * 900) + 100;
        const sum = (Math.random() * 5000000 + 500000).toLocaleString();
        logs += `[✅] ID ${id}*** | 🍎 ${games[Math.floor(Math.random()*games.length)]} | +${sum} UZS\n`;
    }
    ctx.editMessageText(logs, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]]) });
});

// ADMIN PANEL
bot.action('admin_main', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("👑 <b>ADMIN CONTROL PANEL</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 Kanallar', 'adm_chan'), Markup.button.callback('📱 Ilovalar', 'adm_apps')],
            [Markup.button.callback('✅ ID Tasdiqlash', 'adm_verify'), Markup.button.callback('📊 Statistika', 'adm_stats')],
            [Markup.button.callback('✉️ Reklama', 'adm_bc')],
            [Markup.button.callback('🔙 Chiqish', 'home')]
        ])
    });
});

// TEXT HANDLER (ID YUBORISH VA SUPPORT)
bot.on('text', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (ctx.session.step === 'get_id') {
        const gameId = ctx.message.text;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId });
        ctx.reply(i18n[user.lang].wait_admin);
        bot.telegram.sendMessage(ADMIN_ID, `🆕 <b>ID TASDIQLASH:</b>\nUser: <a href="tg://user?id=${ctx.from.id}">${ctx.from.firstName}</a>\nID: <code>${gameId}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `approve_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        });
        ctx.session.step = null;
    }
});

// APPROVE LOGIC
bot.action(/^approve_(\d+)$/, async (ctx) => {
    const tid = ctx.match[1];
    await User.findOneAndUpdate({ userId: tid }, { isVerified: true });
    bot.telegram.sendMessage(tid, "✅ <b>ACCESS GRANTED!</b>\n\nSizning ID raqamingiz tasdiqlandi. Endi Konsol orqali signallarni olishingiz mumkin!", { parse_mode: 'HTML' });
    ctx.answerCbQuery("Tasdiqlandi!");
    ctx.editMessageText("✅ Foydalanuvchi tasdiqlandi.");
});

bot.action('home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].welcome, getMenu(user, ctx.from.id === ADMIN_ID));
});

// 6. SERVER & LAUNCH
const app = express();
app.get('/', (req, res) => res.send('Server Running'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 RICHI28 PORTAL LIVE'));
