const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE STRUKTURASI
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ RICHI28 DB MUVAFFAQIYATLI ULANDI'));

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

// 3. LUG'AT (Matrix / Hacker Style)
const i18n = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nTizimga xush kelibsiz, Agent! Avtorizatsiya muvaffaqiyatli yakunlandi.",
        main_menu: "💻 ASOSIY TERMINAL:",
        btn_web: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        no_access: "⚠️ XATOLIK: Ruxsat yo'q! Avval [SIGNALLAR] bo'limida ID raqamingizni tasdiqlang.",
        id_prompt: "🆔 Platformadagi ID raqamingizni yuboring:",
        support_prompt: "👨‍💻 Adminga yubormoqchi bo'lgan xabaringizni yozing:",
        wait_admin: "⏳ Ma'lumot yuborildi. Tizim tasdiqlashini kuting.",
        back: "🔙 ORQAGA",
        ref_text: (count, link) => `👥 <b>TARMOQ STATUSI</b>\n\n📊 Takliflar: ${count} ta\n🔗 Havolangiz: <code>${link}</code>\n\n🎁 Mukofot: 5 ta = 5,000 | 10 ta = 13,000 UZS`
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nДобро пожаловать, Агент! Авторизация прошла успешно.",
        main_menu: "💻 ГЛАВНЫЙ ТЕРМИНАЛ:",
        btn_web: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ",
        no_access: "⚠️ ОШИБКА: Доступ запрещен! Сначала подтвердите ID в разделе [СИГНАЛЫ].",
        id_prompt: "🆔 Отправьте ваш ID номер платформы:",
        support_prompt: "👨‍💻 Напишите ваше сообщение для админа:",
        wait_admin: "⏳ Данные отправлены. Ожидайте подтверждения системы.",
        back: "🔙 НАЗАД",
        ref_text: (count, link) => `👥 <b>СТАТУС СЕТИ</b>\n\n📊 Рефералы: ${count}\n🔗 Ссылка: <code>${link}</code>`
    }
};

// 4. KLAVIATURA GENERATORI
const getMenu = (u, isAdmin) => {
    const t = i18n[u.lang] || i18n.uz;
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

// 5. ASOSIY HANDLERLAR
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

    return ctx.reply("🌐 Tilni tanlang / Выберите язык:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 UZBEK", "set_uz"), Markup.button.callback("🇷🇺 РУССКИЙ", "set_ru")]
    ]));
});

bot.action(/^set_(uz|ru)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    ctx.editMessageText(i18n[lang].welcome, getMenu(user, ctx.from.id === ADMIN_ID));
});

bot.action('home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].welcome, getMenu(user, ctx.from.id === ADMIN_ID));
});

// KONSOLNI OCHISH
bot.action('open_console', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user.isVerified) {
        return ctx.answerCbQuery(i18n[user.lang].no_access, { show_alert: true });
    }
    const webAppUrl = `${process.env.WEB_APP_URL}?lang=${user.lang}&id=${user.gameId}`;
    ctx.reply("🟢 KONSOLGA KIRISH RUXSAT ETILDI:", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 TERMINALNI ISHGA TUSHIRISH", webAppUrl)],
        [Markup.button.callback(i18n[user.lang].back, 'home')]
    ]));
});

// ADMIN BILAN ALOQA (TICKET SYSTEM)
bot.action('support_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'support_msg';
    ctx.editMessageText(i18n[user.lang].support_prompt, Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]]));
});

// SIGNALLAR MENYUSI
bot.action('signals_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 ID TASDIQLASH", 'verify_id')]);
    btns.push([Markup.button.callback(i18n[user.lang].back, 'home')]);
    ctx.editMessageText("🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:", Markup.inlineKeyboard(btns));
});

bot.action('verify_id', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'get_id';
    ctx.reply(i18n[user.lang].id_prompt);
});

// 6. TEXT HANDLER (ID, SUPPORT VA ADMIN REPLY)
bot.on('text', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    
    // ID Yuborish mantiqi
    if (ctx.session.step === 'get_id') {
        const gameId = ctx.message.text;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId });
        ctx.reply(i18n[user.lang].wait_admin);
        bot.telegram.sendMessage(ADMIN_ID, `🆕 <b>ID TASDIQLASH:</b>\n\n👤 Agent: <a href="tg://user?id=${ctx.from.id}">${ctx.from.firstName}</a>\n🆔 ID: <code>${gameId}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `approve_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        });
        ctx.session.step = null;
    } 
    // Support yuborish mantiqi
    else if (ctx.session.step === 'support_msg') {
        ctx.reply("✅ Xabaringiz yuborildi.");
        bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI ARIZA:</b>\n\n👤 Kimdan: ${ctx.from.firstName}\n🆔 ID: <code>${ctx.from.id}</code>\n💬 Xabar: <i>${ctx.message.text}</i>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✍️ JAVOB BERISH', `reply_${ctx.from.id}`)]
            ])
        });
        ctx.session.step = null;
    }
    // Admin javob berish mantiqi
    else if (ctx.session.step && ctx.session.step.startsWith('replying_to_')) {
        const targetId = ctx.session.step.split('_')[2];
        bot.telegram.sendMessage(targetId, `👨‍💻 <b>ADMIN JAVOBI:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
        ctx.reply("✅ Javob yuborildi.");
        ctx.session.step = null;
    }
});

// 7. ADMIN ACTIONS
bot.action('admin_main', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("👑 <b>ADMIN CONTROL PANEL</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ ID Tasdiqlash', 'adm_verify'), Markup.button.callback('📊 Statistika', 'adm_stats')],
            [Markup.button.callback('✉️ Reklama Yuborish', 'adm_bc')],
            [Markup.button.callback('🔙 Chiqish', 'home')]
        ])
    });
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    const tid = ctx.match[1];
    await User.findOneAndUpdate({ userId: tid }, { isVerified: true });
    bot.telegram.sendMessage(tid, "✅ <b>ACCESS GRANTED!</b>\n\nID raqamingiz tasdiqlandi. Konsol ochildi!", { parse_mode: 'HTML' });
    ctx.editMessageText("✅ Foydalanuvchi tasdiqlandi.");
});

bot.action(/^reply_(\d+)$/, (ctx) => {
    const tid = ctx.match[1];
    ctx.session.step = `replying_to_${tid}`;
    ctx.reply(`✍️ User (ID: ${tid}) uchun javobingizni yozing:`);
});

// YUTUQLAR (FAKE LOGS)
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

// TARMOQ (REFERAL)
bot.action('network_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(i18n[user.lang].ref_text(user.referrals, link), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]])
    });
});

// 8. SERVER & START
const app = express();
app.get('/', (req, res) => res.send('Richi28 Server Status: Online'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 RICHI28 PORTAL IS LIVE'));
