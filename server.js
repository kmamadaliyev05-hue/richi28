const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

const app = express();
const ADMIN_ID = 6137845806; // Sizning ID raqamingiz

// 1. DATABASE MODELS
const UserSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: "uz" },
    isVerified: { type: Boolean, default: false },
    gameId: { type: String, default: "Kiritilmagan" },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    notifications: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
    key: String, // channel, app, guide
    name: String,
    url: String,
    chatId: String,
    content: String
});

const User = mongoose.model('User', UserSchema);
const Config = mongoose.model('Config', ConfigSchema);

// 2. BOT INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🛡️ RICHI28 DATABASE CONNECTED'))
    .catch(err => console.error('❌ DB Error:', err));

// 3. I18N (MULTI-LANGUAGE) - Tillar to'liq kiritildi
const strings = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli.",
        sub_req: "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:",
        verify_sub: "✅ Tasdiqlash",
        main_menu: "Asosiy menyu:",
        access_denied: "⚠️ Ruxsat yo'q! Avval ID tasdiqlang.",
        signals_title: "🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:",
        wallet_title: (bal) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\n\nKamida 50,000 UZS bo'lganda yechish mumkin.`,
        ref_title: (count, link) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta\n\n🎁 Mukofotlar:\n- 5 do'st = 5,000 UZS\n- 10 do'st = 13,000 UZS`,
        settings_title: (id, status, notify) => `🛠 <b>SOZLAMALAR</b>\n\n👤 ID: ${id}\n✅ Status: ${status ? 'Tasdiqlangan' : 'Noma\'lum'}\n🔔 Bildirishnoma: ${notify ? 'ON' : 'OFF'}`,
        guide_title: "📚 <b>FOYDALANISH QO'LLANMASI</b>",
        wins_title: "🏆 <b>SO'NGGI YUTUQLAR LOGI:</b>",
        support_msg: "👨‍💻 Muammoingizni yozib qoldiring, admin tez orada javob beradi:",
        back: "⬅️ Ortga",
        btn_console: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA"
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nДобро пожаловать в систему, Агент!",
        sub_req: "🔐 Подпишитесь на каналы для продолжения:",
        verify_sub: "✅ Проверить",
        main_menu: "Основное меню:",
        access_denied: "⚠️ Нет доступа! Сначала подтвердите ID.",
        signals_title: "🚀 Выберите платформу и отправьте ваш ID:",
        wallet_title: (bal) => `💰 <b>КОШЕЛЕК</b>\n\nОбщий баланс: ${bal.toLocaleString()} UZS`,
        ref_title: (count, link) => `👥 <b>СЕТЬ</b>\n\nВаша ссылка: <code>${link}</code>\nПриглашено: ${count}`,
        settings_title: (id, status, notify) => `🛠 <b>НАСТРОЙКИ</b>\n\n👤 ID: ${id}\n✅ Статус: ${status ? 'Подтвержден' : 'Неизвестно'}`,
        guide_title: "📚 <b>РУКОВОДСТВО</b>",
        wins_title: "🏆 <b>ЛОГ ПОСЛЕДНИХ ВЫИГРЫШЕЙ:</b>",
        support_msg: "👨‍💻 Опишите вашу проблему, админ скоро ответит:",
        back: "⬅️ Назад",
        btn_console: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ"
    },
    en: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nWelcome to the system, Agent!",
        sub_req: "🔐 Please subscribe to channels to continue:",
        verify_sub: "✅ Verify",
        main_menu: "Main Menu:",
        access_denied: "⚠️ Access denied! Verify your ID first.",
        signals_title: "🚀 Choose platform and send your ID:",
        wallet_title: (bal) => `💰 <b>WALLET</b>\n\nTotal Balance: ${bal.toLocaleString()} UZS`,
        ref_title: (count, link) => `👥 <b>NETWORK</b>\n\nYour link: <code>${link}</code>\nReferrals: ${count}`,
        settings_title: (id, status, notify) => `🛠 <b>SETTINGS</b>\n\n👤 ID: ${id}\n✅ Status: ${status ? 'Verified' : 'Unknown'}`,
        guide_title: "📚 <b>GUIDEBOOK</b>",
        wins_title: "🏆 <b>LATEST WINS LOG:</b>",
        support_msg: "👨‍💻 Describe your problem, admin will reply soon:",
        back: "⬅️ Back",
        btn_console: "💻 OPEN CONSOLE",
        btn_signals: "🚀 SIGNALS",
        btn_network: "👥 NETWORK",
        btn_wins: "🏆 WINS",
        btn_guide: "📚 GUIDE",
        btn_wallet: "💰 WALLET",
        btn_settings: "🛠 SETTINGS",
        btn_support: "👨‍💻 CONTACT ADMIN"
    }
};

// 4. KEYBOARD GENERATOR
const getMainMenu = (lang, isAdmin) => {
    const s = strings[lang] || strings.uz;
    const btns = [
        [Markup.button.callback(s.btn_console, "open_console")],
        [Markup.button.callback(s.btn_signals, "menu_signals"), Markup.button.callback(s.btn_network, "menu_network")],
        [Markup.button.callback(s.btn_wins, "menu_wins"), Markup.button.callback(s.btn_guide, "menu_guide")],
        [Markup.button.callback(s.btn_wallet, "menu_wallet"), Markup.button.callback(s.btn_settings, "menu_settings")],
        [Markup.button.callback(s.btn_support, "menu_support")]
    ];
    if (isAdmin) btns.push([Markup.button.callback("⚙️ ADMIN PANEL", "admin_panel")]);
    return Markup.inlineKeyboard(btns);
};

// 5. SUBSCRIPTION CHECKER
const checkSubscription = async (ctx) => {
    if (ctx.from.id === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    for (const chan of channels) {
        try {
            const member = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { continue; }
    }
    return true;
};

// 6. BOT FLOW
bot.start(async (ctx) => {
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOne({ userId: ctx.from.id });

    if (!user) {
        user = await User.create({ userId: ctx.from.id, firstName: ctx.from.first_name, invitedBy: refId });
        if (refId && refId !== ctx.from.id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { balance: 1000, referrals: 1 } });
        }
    }

    return ctx.reply("🌐 Select Language / Tilni tanlang / Выберите язык:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
        [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
        [Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

bot.action(/^setlang_(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    
    if (!(await checkSubscription(ctx))) {
        const chans = await Config.find({ key: 'channel' });
        const buttons = chans.map(c => [Markup.button.url(c.name, c.url)]);
        buttons.push([Markup.button.callback(strings[lang].verify_sub, "check_sub")]);
        return ctx.editMessageText(strings[lang].sub_req, Markup.inlineKeyboard(buttons));
    }
    return ctx.editMessageText(strings[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
});

bot.action("check_sub", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (await checkSubscription(ctx)) {
        return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    }
    const alertMsg = user.lang === 'uz' ? "Obuna bo'lmagansiz!" : (user.lang === 'ru' ? "Вы не подписаны!" : "Not subscribed!");
    return ctx.answerCbQuery(alertMsg, { show_alert: true });
});

bot.action("home", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

// 7. SECTIONS & BACK LOGIC

// 1. KONSOL
bot.action("open_console", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    if (!user.isVerified) return ctx.answerCbQuery(s.access_denied, { show_alert: true });
    
    return ctx.editMessageText("🟢 TERMINAL IS ACTIVE", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 OPEN TERMINAL", process.env.WEB_APP_URL || "https://google.com")],
        [Markup.button.callback(s.back, "home")]
    ]));
});

// 2. SIGNALLAR
bot.action("menu_signals", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 VERIFY ID", "verify_id_start")]);
    btns.push([Markup.button.callback(s.back, "home")]);
    return ctx.editMessageText(s.signals_title, Markup.inlineKeyboard(btns));
});

bot.action("verify_id_start", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'await_id';
    const msg = user.lang === 'uz' ? "ID kiriting:" : (user.lang === 'ru' ? "Введите ID:" : "Enter ID:");
    return ctx.reply(msg);
});

// 3. TARMOQ
bot.action("menu_network", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    return ctx.editMessageText(s.ref_title(user.referrals, link), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
    });
});

// 4. HAMYON
bot.action("menu_wallet", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    return ctx.editMessageText(s.wallet_title(user.balance), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("💸 Withdraw", "withdraw_start")],
            [Markup.button.callback(s.back, "home")]
        ])
    });
});

// 5. SOZLAMALAR
bot.action("menu_settings", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    return ctx.editMessageText(s.settings_title(user.userId, user.isVerified, user.notifications), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🔄 Language", "start_lang_change")],
            [Markup.button.callback(s.back, "home")]
        ])
    });
});

bot.action("start_lang_change", (ctx) => {
    return ctx.reply("New Language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
        [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
        [Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

// 6. QO'LLANMA
bot.action("menu_guide", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    const guide = await Config.findOne({ key: 'guide' });
    const text = guide ? guide.content : "...";
    return ctx.editMessageText(`${s.guide_title}\n\n${text}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
    });
});

// 7. YUTUQLAR
bot.action("menu_wins", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    let wins = `${s.wins_title}\n\n`;
    for(let i=0; i<10; i++) {
        const id = Math.floor(1000 + Math.random() * 8000);
        const amt = (Math.floor(Math.random() * 5000000) + 500000).toLocaleString();
        wins += `✅ ID: ${id}** | +${amt} UZS\n`;
    }
    return ctx.editMessageText(wins, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
    });
});

// 8. ADMIN BILAN ALOQA
bot.action("menu_support", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'support';
    return ctx.reply(strings[user.lang].support_msg);
});

// TEXT HANDLER
bot.on('text', async (ctx) => {
    if (!ctx.session || !ctx.session.step) return;
    const user = await User.findOne({ userId: ctx.from.id });

    if (ctx.session.step === 'await_id') {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text });
        bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>NEW ID</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\nGame ID: <code>${ctx.message.text}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback("✅ APPROVE", `approve_${ctx.from.id}`)]])
        });
        ctx.session.step = null;
        const resp = user.lang === 'uz' ? "Yuborildi!" : (user.lang === 'ru' ? "Отправлено!" : "Sent!");
        return ctx.reply(resp);
    } 
    
    if (ctx.session.step === 'support') {
        bot.telegram.sendMessage(ADMIN_ID, `📩 <b>SUPPORT</b>\n\nID: ${ctx.from.id}\nMsg: ${ctx.message.text}`);
        ctx.session.step = null;
        return ctx.reply("✅ OK.");
    }
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    const targetId = ctx.match[1];
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
    bot.telegram.sendMessage(targetId, "✅ Verified!");
    return ctx.answerCbQuery("Done!");
});

// 9. SERVER
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK'));
app.listen(PORT, '0.0.0.0', () => console.log(`Run: ${PORT}`));

bot.launch().then(() => console.log('🚀 STARTED'));
