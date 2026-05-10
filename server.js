const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

const app = express();
const ADMIN_ID = 6137845806; // O'zingizning ID raqamingiz

// ==========================================
// 1. DATABASE MODELS
// ==========================================
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

// ==========================================
// 2. BOT INITIALIZATION
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// Xotira (session) o'chib ketishidan himoya
const initSession = (ctx) => {
    if (!ctx.session) ctx.session = {};
};

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🛡️ RICHI28 DATABASE CONNECTED'))
    .catch(err => console.error('❌ DB Error:', err));

// ==========================================
// 3. I18N (MULTI-LANGUAGE STRINGS)
// ==========================================
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

// ==========================================
// 4. KEYBOARD GENERATOR
// ==========================================
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

// ==========================================
// 5. SUBSCRIPTION CHECKER
// ==========================================
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

// ==========================================
// 6. BOT FLOW & START
// ==========================================
bot.start(async (ctx) => {
    try {
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
    } catch (error) { console.error(error); }
});

bot.action(/^setlang_(.+)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
        
        if (!(await checkSubscription(ctx))) {
            const chans = await Config.find({ key: 'channel' });
            const buttons = chans.map(c => [Markup.button.url(c.name, c.url)]);
            buttons.push([Markup.button.callback(strings[lang].verify_sub, "check_sub")]);
            return ctx.editMessageText(strings[lang].sub_req, Markup.inlineKeyboard(buttons));
        }
        return ctx.editMessageText(strings[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
    } catch (error) { console.error(error); }
});

bot.action("check_sub", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (await checkSubscription(ctx)) {
            return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
        }
        const alertMsg = user.lang === 'uz' ? "Obuna bo'lmagansiz!" : (user.lang === 'ru' ? "Вы не подписаны!" : "Not subscribed!");
        return ctx.answerCbQuery(alertMsg, { show_alert: true });
    } catch (error) { console.error(error); }
});

bot.action("home", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    } catch (error) { console.error(error); }
});

// ==========================================
// 7. SECTIONS & BACK LOGIC
// ==========================================

// 1. KONSOL (WEB APP)
bot.action("open_console", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        
        if (!user.isVerified) {
            return ctx.answerCbQuery(s.access_denied, { show_alert: true });
        }
        
        return ctx.editMessageText("🟢 TERMINAL IS ACTIVE", Markup.inlineKeyboard([
            [Markup.button.webApp("🚀 KONSOLNI OCHISH", process.env.WEB_APP_URL || "https://google.com")],
            [Markup.button.callback(s.back, "home")]
        ]));
    } catch (error) { console.error(error); }
});

bot.action("menu_signals", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const apps = await Config.find({ key: 'app' });
        
        const btns = [];
        
        apps.forEach(a => {
            btns.push([Markup.button.callback(`🚀 ${a.name}`, `view_app_${a._id}`)]);
        });

        if(apps.length === 0) {
            btns.push([Markup.button.callback("🎰 1XBET", "view_app_default_1xbet")]);
            btns.push([Markup.button.callback("🟢 LINEBET", "view_app_default_linebet")]);
        }

        btns.push([Markup.button.callback(s.back, "home")]);
        
        return ctx.editMessageText(s.signals_title || "🚀 Platformani tanlang:", Markup.inlineKeyboard(btns));
    } catch (error) { console.error(error); }
});


// 2. SIGNALLAR (VERIFICATION CENTER) VA PLATFORMALAR RO'YXATI
bot.action(/^view_app_(.+)$/, async (ctx) => {
    try {
        initSession(ctx);
        const appId = ctx.match[1];
        let name = "Platforma";
        let regLink = "https://1xbet.com";
        let dlLink = "https://t.me/richi28_apk";

        if (appId === "default_1xbet") {
            name = "1XBET";
        } else if (appId === "default_linebet") {
            name = "LINEBET"; 
            regLink = "https://linebet.com";
        } else {
            const appInfo = await Config.findById(appId);
            if (appInfo) {
                name = appInfo.name;
                regLink = appInfo.url || "https://1xbet.com";
                dlLink = appInfo.content || "https://t.me/richi28_apk";
            }
        }

        // Foydalanuvchi qaysi platformada ekanini eslab qolamiz
        ctx.session.selectedApp = name;

        const text = `🎰 <b>${name}</b> platformasi\n\n👇 Maxsus ro'yxatdan o'tish linki orqali ro'yxatdan o'ting va o'z ID raqamingizni tasdiqlang!`;

        return ctx.editMessageText(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url("🔗 Ro'yxatdan o'tish", regLink)],
                [Markup.button.url("📥 Ilovani yuklash", dlLink)],
                [Markup.button.callback("🆔 ID TASDIQLASH", "verify_id_start")],
                [Markup.button.callback("⬅️ Ortga", "menu_signals")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("verify_id_start", async (ctx) => {
    initSession(ctx); 
    ctx.session.step = 'await_id';
    return ctx.reply("📝 Platformadagi ID raqamingizni kiriting:\n\n❗️ Faqat 10 ta raqamdan iborat bo'lishi shart.\n\n(Bekor qilish uchun /start)");
});

// 3. TARMOQ
bot.action("menu_network", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        return ctx.editMessageText(s.ref_title(user.referrals, link), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
        });
    } catch (error) { console.error(error); }
});

// 4. HAMYON
bot.action("menu_wallet", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        return ctx.editMessageText(s.wallet_title(user.balance), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("💸 Withdraw", "withdraw_start")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("withdraw_start", (ctx) => {
    initSession(ctx);
    ctx.session.step = 'withdraw_card';
    return ctx.reply("💳 Karta raqamingizni kiriting:");
});

// 5. SOZLAMALAR
bot.action("menu_settings", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        return ctx.editMessageText(s.settings_title(user.userId, user.isVerified, user.notifications), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("🔄 Language", "start_lang_change")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
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
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const guide = await Config.findOne({ key: 'guide' });
        const text = guide ? guide.content : "...";
        return ctx.editMessageText(`${s.guide_title}\n\n${text}`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
        });
    } catch (error) { console.error(error); }
});

// 7. YUTUQLAR
bot.action("menu_wins", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
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
    } catch (error) { console.error(error); }
});

// 8. ADMIN BILAN ALOQA (SUPPORT)
bot.action("menu_support", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        
        initSession(ctx);
        ctx.session.step = 'support';
        
        return ctx.editMessageText(s.support_msg, Markup.inlineKeyboard([
            [Markup.button.callback(s.back, "home")]
        ]));
    } catch (error) { console.error(error); }
});

// ==========================================
// 8. TEXT HANDLERS (LOGIKA)
// ==========================================
bot.on('text', async (ctx) => {
    initSession(ctx);
    if (!ctx.session.step) return;

    try {
        const user = await User.findOne({ userId: ctx.from.id });

        // A. ID TASDIQLASH VA TEKSHIRUV (10 XONALI RAQAM)
        if (ctx.session.step === 'await_id') {
            const inputId = ctx.message.text.trim();
            const idRegex = /^\d{10}$/; 

            if (!idRegex.test(inputId)) {
                return ctx.reply("❌ Xato! ID faqat 10 ta raqamdan iborat bo'lishi kerak va harf qatnashmasligi shart.\n\nNamuna: 1234567890\n\nQaytadan kiriting:");
            }

            const platform = ctx.session.selectedApp || "Noma'lum";

            await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: inputId });
            
            const adminMsg = `🆔 <b>YANGI ID SO'ROVI</b>\n\n` +
                             `👤 Foydalanuvchi: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>\n` +
                             `🔑 User ID: <code>${ctx.from.id}</code>\n` +
                             `🎮 <b>Platforma: ${platform}</b>\n` +
                             `🆔 Game ID: <code>${inputId}</code>`;

            bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✅ TASDIQLASH", `approve_${ctx.from.id}`)],
                    [Markup.button.callback("❌ RAD ETISH", `reject_${ctx.from.id}`)]
                ])
            });

            ctx.session.step = null;
            return ctx.reply(`⏳ Muvaffaqiyatli qabul qilindi!\n\nPlatforma: <b>${platform}</b>\nID: <b>${inputId}</b>\n\nAdmin tasdiqlashini kuting.`, { parse_mode: 'HTML' });
        } 
        
        // B. SUPPORT ARIZA YUBORISH
        if (ctx.session.step === 'support') {
            bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI ARIZA (SUPPORT)</b>\n\nKimdan: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\n\n📝 Xabar:\n${ctx.message.text}`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✍️ Javob yozish", `reply_to_${ctx.from.id}`)]
                ])
            });
            ctx.session.step = null;
            return ctx.reply("✅ Arizangiz admin paneliga yuborildi. Bot orqali javob olasiz.");
        }

        // C. ADMIN JAVOBINI YETKAZISH
        if (ctx.session.step.startsWith('reply_to_')) {
            const targetUserId = ctx.session.step.split('_')[2];
            
            bot.telegram.sendMessage(targetUserId, `👨‍💻 <b>ADMINDAN JAVOB KELDI:</b>\n\n${ctx.message.text}`, {
                parse_mode: 'HTML'
            });
            ctx.session.step = null;
            return ctx.reply("✅ Javobingiz foydalanuvchiga muvaffaqiyatli yetkazildi.");
        }

        // D. KARTA RAQAMI YUBORISH
        if (ctx.session.step === 'withdraw_card') {
            ctx.reply("💰 Summani kiriting:");
            ctx.session.step = 'withdraw_amount';
        }

    } catch (error) { console.error(error); }
});

// ==========================================
// ADMIN CALLBACKS
// ==========================================
bot.action(/^reply_to_(\d+)$/, (ctx) => {
    initSession(ctx);
    const targetUserId = ctx.match[1];
    ctx.session.step = `reply_to_${targetUserId}`;
    return ctx.reply(`✍️ Foydalanuvchi (ID: ${targetUserId}) uchun javobingizni yozing:`);
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    try {
        const targetId = ctx.match[1];
        await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
        bot.telegram.sendMessage(targetId, "✅ Tabriklaymiz! ID raqamingiz tasdiqlandi. KONSOL ochildi.");
        return ctx.answerCbQuery("Tasdiqlandi!");
    } catch (error) { console.error(error); }
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    try {
        const targetId = ctx.match[1];
        // Rad etilganda gameId ni yana tozalab qoyishimiz mumkin (ixtiyoriy)
        await User.findOneAndUpdate({ userId: targetId }, { gameId: "Kiritilmagan", isVerified: false });
        bot.telegram.sendMessage(targetId, "❌ Kechirasiz, siz yuborgan ID raqam admin tomonidan tasdiqlanmadi. Iltimos tekshirib qayta yuboring.");
        return ctx.answerCbQuery("Rad etildi!");
    } catch (error) { console.error(error); }
});

// ==========================================
// 9. EXPRESS SERVER (KEEP ALIVE)
// ==========================================
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK - RICHI28 BOT IS RUNNING'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port: ${PORT}`));

bot.launch().then(() => console.log('🚀 RICHI28 BOT STARTED SUCCESSFULLY'));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
