const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('✅ RICHI28 HACK PORTAL Database Connected');
}).catch(err => console.log('❌ DB Error:', err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    isVerified: { type: Boolean, default: false },
    gameId: String,
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    status: { type: String, default: 'active' }, 
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, // channel, app
    name: String,
    url: String,
    chatId: String
}));

// 2. BOT INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());

// --- MULTI-LANG LUG'ATI ---
const i18n = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nTizimga xush kelibsiz, Agent!",
        main_menu: "Asosiy boshqaruv konsoli:",
        btn_web: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        no_access: "⚠️ Ruxsat yo'q! Avval ID tasdiqlang.",
        id_prompt: "🆔 Platformadagi ID raqamingizni yuboring (Faqat raqam):",
        wait_admin: "⏳ Ma'lumotlar qabul qilindi. Admin tasdiqlashini kuting.",
        ref_text: (count, link) => `👥 <b>TARMOQ (REFERAL)</b>\n\n📊 Taklif qilinganlar: <b>${count}</b> ta\n\n🎁 Vazifa: 5 ta odam = 5,000 UZS\n\n🔗 Havolangiz:\n<code>${link}</code>`,
        wallet_text: (bal) => `💰 <b>HAMYON</b>\n\nHisobingiz: <b>${bal.toLocaleString()} UZS</b>\n\nMinimal yechish: 50,000 UZS`,
        guide_text: "📖 <b>FOYDALANISH QO'LLANMASI</b>\n\n1. Signallar bo'limidan platforma tanlang.\n2. Ro'yxatdan o'tib ID yuboring.\n3. Tasdiqlangandan so'ng Konsolni oching!",
        back: "🔙 ORQAGA"
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nДобро пожаловать в систему, Агент!",
        main_menu: "Главная консоль управления:",
        btn_web: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ",
        id_prompt: "🆔 Отправьте ваш ID номер (только цифры):",
        wait_admin: "⏳ Данные приняты. Ожидайте подтверждения админом.",
        ref_text: (count, link) => `👥 <b>СЕТЬ (РЕФЕРАЛ)</b>\n\n📊 Приглашено: <b>${count}</b>\n\n🔗 Ваша ссылка:\n<code>${link}</code>`,
        back: "🔙 НАЗАД"
    },
    en: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nWelcome to the system, Agent!",
        main_menu: "Main control console:",
        btn_web: "💻 OPEN CONSOLE",
        btn_signals: "🚀 SIGNALS",
        btn_network: "👥 NETWORK",
        btn_wins: "🏆 WINS",
        btn_guide: "📚 GUIDE",
        btn_wallet: "💰 WALLET",
        btn_settings: "🛠 SETTINGS",
        btn_support: "👨‍💻 SUPPORT",
        id_prompt: "🆔 Send your ID number (digits only):",
        wait_admin: "⏳ Data received. Wait for admin approval.",
        ref_text: (count, link) => `👥 <b>NETWORK (REFERRAL)</b>\n\n📊 Invited: <b>${count}</b>\n\n🔗 Your link:\n<code>${link}</code>`,
        back: "🔙 BACK"
    }
};

// 3. KEYBOARDS
const getMainMenu = (lang, isAdmin, isVerified) => {
    const t = i18n[lang] || i18n.uz;
    let buttons = [
        [Markup.button.webApp(t.btn_web, `${process.env.WEB_APP_URL}?user=${isVerified}&lang=${lang}`)],
        [Markup.button.callback(t.btn_signals, 'signals'), Markup.button.callback(t.btn_network, 'network')],
        [Markup.button.callback(t.btn_wins, 'wins'), Markup.button.callback(t.btn_guide, 'guide')],
        [Markup.button.callback(t.btn_wallet, 'wallet'), Markup.button.callback(t.btn_settings, 'settings')],
        [Markup.button.url(t.btn_support, 'https://t.me/richi28_admin')]
    ];
    if (isAdmin) buttons.push([Markup.button.callback('👑 ADMIN PANEL', 'admin_panel')]);
    return Markup.inlineKeyboard(buttons);
};

// 4. HANDLERS
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload;
    
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name });
        if (refId && refId !== id.toString()) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referrals: 1 } });
        }
    }

    return ctx.reply("🌐 Select Language / Tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz"), Markup.button.callback("🇷🇺 Русский", "setlang_ru"), Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

bot.action(/^setlang_(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    ctx.editMessageText(i18n[lang].welcome, {
        parse_mode: 'HTML',
        ...getMainMenu(lang, ctx.from.id === ADMIN_ID, user.isVerified)
    });
});

// SIGNALLAR (PLATFORMALAR)
bot.action('signals', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const t = i18n[user.lang];
    const apps = await Config.find({ key: 'app' });
    
    const buttons = apps.map(app => [Markup.button.url(`📥 ${app.name} (Kanal)`, app.url)]);
    buttons.push([Markup.button.callback('🆔 ID TASDIQLASH', 'verify_id')]);
    buttons.push([Markup.button.callback(t.back, 'back_home')]);
    
    ctx.editMessageText("🚀 Kerakli platformani tanlang va ID raqamingizni tasdiqlang:", Markup.inlineKeyboard(buttons));
});

bot.action('verify_id', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'awaiting_id';
    ctx.reply(i18n[user.lang].id_prompt);
});

// TEXT HANDLER
bot.on('text', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (ctx.session.step === 'awaiting_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("❌ Faqat raqam yuboring!");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, status: 'requested' });
        ctx.reply(i18n[user.lang].wait_admin);
        
        bot.telegram.sendMessage(ADMIN_ID, `🆕 <b>ID TASDIQLASH:</b>\n\n👤 Agent: ${ctx.from.first_name}\n🆔 ID: <code>${ctx.message.text}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `approve_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        });
        ctx.session.step = null;
    }
});

// TARMOQ (REFERAL)
bot.action('network', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(i18n[user.lang].ref_text(user.referrals, link), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'back_home')]])
    });
});

// YUTUQLAR (FAKE LOGS)
const generateFakeLogs = () => {
    const games = ['Apple', 'Kamikaze', 'Dragon', 'Mines', 'Crash'];
    const amount = (Math.floor(Math.random() * 4000000) + 500000).toLocaleString();
    const id = Math.floor(100000 + Math.random() * 900000);
    return `[✅] ID ${id}*** | ⚡️ ${games[Math.floor(Math.random()*games.length)]} | +${amount} UZS`;
};

bot.action('wins', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    let logs = "🏆 <b>OXIRGI YUTUQLAR (LIVE):</b>\n\n";
    for(let i=0; i<6; i++) { logs += `<code>${generateFakeLogs()}</code>\n`; }
    ctx.editMessageText(logs, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'back_home')]])
    });
});

// HAMYON
bot.action('wallet', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].wallet_text(user.balance), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'back_home')]])
    });
});

// ADMIN LOGIC
bot.action(/^approve_(\d+)$/, async (ctx) => {
    const targetId = ctx.match[1];
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
    bot.telegram.sendMessage(targetId, "✅ <b>TABRIKLAYMIZ!</b>\n\nID raqamingiz tasdiqlandi. Endi KONSOL orqali VIP signallar olishingiz mumkin!", { parse_mode: 'HTML' });
    ctx.editMessageText("✅ Agent tasdiqlandi.");
});

bot.action('back_home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].welcome, {
        parse_mode: 'HTML',
        ...getMainMenu(user.lang, ctx.from.id === ADMIN_ID, user.isVerified)
    });
});

// 5. SERVER
const app = express();
app.get('/', (req, res) => res.send('Richi28 Hack Portal is Running...'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('⚡️ RICHI28 HACK PORTAL LIVE'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
