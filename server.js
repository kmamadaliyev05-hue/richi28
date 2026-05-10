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
    requestedChannels: { type: [String], default: [] },
    joinedAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
    key: String, // channel, app, guide, webapp_url, ref_bonus, min_withdraw, etc.
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

const initSession = (ctx) => {
    if (!ctx.session) ctx.session = {};
};

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🛡️ RICHI28 DATABASE CONNECTED'))
    .catch(err => console.error('❌ DB Error:', err));

// ==========================================
// 3. I18N (MULTI-LANGUAGE STRINGS)
// ==========================================
const strings = {
    uz: {
        lang_select: "🌐 Tilni tanlang / Выберите язык / Select language:",
        lang_changed: "✅ Til muvaffaqiyatli o'zgartirildi!",
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nTizimga xush kelibsiz, Agent!",
        sub_req: "🔐 Botdan foydalanish uchun kanallarga obuna bo'ling yoki ariza (zayafka) qoldiring:",
        verify_sub: "✅ Tasdiqlash",
        signals_title: "🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:",
        wallet_title: (bal) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\n\nKamida 50,000 UZS bo'lganda yechish mumkin.`,
        ref_title: (count, link) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta\n\n🎁 Mukofotlar:\n- 5 do'st = 5,000 UZS\n- 10 do'st = 13,000 UZS`,
        settings_menu: "⚙️ <b>SOZLAMALAR</b>\n\nKerakli bo'limni tanlang:",
        profile_title: (id, status) => `👤 <b>PROFILIM</b>\n\n🆔 ID: ${id}\n✅ Status: ${status ? 'Tasdiqlangan' : 'Ruxsat yo\'q'}`,
        guide_title: "📚 <b>FOYDALANISH QO'LLANMASI</b>",
        wins_title: "🏆 <b>SO'NGGI YUTUQLAR LOGI:</b>",
        support_msg: "👨‍💻 Muammoingizni yozib qoldiring, admin tez orada javob beradi:",
        unverified_alert: "⚠️ <b>RUXSAT ETILMAGAN!</b>\n\nWeb App (Konsol) dan foydalanish uchun quyidagilar shart:\n\n1️⃣ <b>RICHI28</b> promokodi bilan ro'yxatdan o'tish.\n2️⃣ Hisobga <b>minimal depozit</b> tushirish.\n3️⃣ ID raqamingizni bizga yuborib tasdiqlatish.\n\n👇 <b>\"🚀 SIGNALLAR\"</b> bo'limiga o'ting!",
        platform_info: (name) => `🎰 <b>${name}</b> platformasi\n\n❗️ <b>KONSOLDAN FOYDALANISH SHARTLARI:</b>\n\n1️⃣ Link orqali kiring va <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting!\n2️⃣ Minimal depozit kiriting.\n3️⃣ "🆔 ID TASDIQLASH" tugmasini bosib ID yuboring.`,
        btn_console: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        btn_change_lang: "🔄 Tilni o'zgartirish",
        btn_notif: (n) => `🔔 Bildirishnoma: ${n ? 'YONIQ' : 'O\'CHIQ'}`,
        btn_profile: "👤 Profilim",
        btn_verify_id: "🆔 ID TASDIQLASH",
        back: "⬅️ Ortga"
    },
    ru: {
        lang_select: "🌐 Tilni tanlang / Выберите язык / Select language:",
        lang_changed: "✅ Язык успешно изменен!",
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nДобро пожаловать в систему, Агент!",
        sub_req: "🔐 Для использования бота подпишитесь на каналы или оставьте заявку:",
        verify_sub: "✅ Подтвердить",
        signals_title: "🚀 Выберите платформу и отправьте ID:",
        wallet_title: (bal) => `💰 <b>КОШЕЛЕК</b>\n\nБаланс: ${bal.toLocaleString()} UZS\n\nМинимум для вывода: 50,000 UZS.`,
        ref_title: (count, link) => `👥 <b>СЕТЬ</b>\n\nВаша ссылка: <code>${link}</code>\nПриглашено: ${count}\n\n🎁 Награды:\n- 5 друзей = 5,000 UZS\n- 10 друзей = 13,000 UZS`,
        settings_menu: "⚙️ <b>НАСТРОЙКИ</b>\n\nВыберите нужный раздел:",
        profile_title: (id, status) => `👤 <b>МОЙ ПРОФИЛЬ</b>\n\n🆔 ID: ${id}\n✅ Статус: ${status ? 'Подтвержден' : 'Нет доступа'}`,
        guide_title: "📚 <b>ИНСТРУКЦИЯ</b>",
        wins_title: "🏆 <b>ПОСЛЕДНИЕ ВЫИГРЫШИ:</b>",
        support_msg: "👨‍💻 Опишите вашу проблему, админ скоро ответит:",
        unverified_alert: "⚠️ <b>ДОСТУП ЗАКРЫТ!</b>\n\nДля доступа к Web App (Консоль) необходимо:\n\n1️⃣ Зарегистрироваться с промокодом <b>RICHI28</b>.\n2️⃣ Внести <b>минимальный депозит</b>.\n3️⃣ Отправить нам свой ID для подтверждения.\n\n👇 Перейдите в раздел <b>\"🚀 СИГНАЛЫ\"</b>!",
        platform_info: (name) => `🎰 Платформа <b>${name}</b>\n\n❗️ <b>УСЛОВИЯ КОНСОЛИ:</b>\n\n1️⃣ Зарегистрируйтесь по ссылке с промокодом <b>RICHI28</b>!\n2️⃣ Внесите депозит.\n3️⃣ Нажмите "🆔 ПОДТВЕРДИТЬ ID" и отправьте ID.`,
        btn_console: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ",
        btn_change_lang: "🔄 Изменить язык",
        btn_notif: (n) => `🔔 Уведомления: ${n ? 'ВКЛ' : 'ВЫКЛ'}`,
        btn_profile: "👤 Мой профиль",
        btn_verify_id: "🆔 ПОДТВЕРДИТЬ ID",
        back: "⬅️ Назад"
    },
    en: {
        lang_select: "🌐 Tilni tanlang / Выберите язык / Select language:",
        lang_changed: "✅ Language changed successfully!",
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nWelcome to the system, Agent!",
        sub_req: "🔐 Subscribe to channels or send a join request to use the bot:",
        verify_sub: "✅ Verify",
        signals_title: "🚀 Select platform and submit ID:",
        wallet_title: (bal) => `💰 <b>WALLET</b>\n\nBalance: ${bal.toLocaleString()} UZS\n\nMinimum withdrawal: 50,000 UZS.`,
        ref_title: (count, link) => `👥 <b>NETWORK</b>\n\nYour link: <code>${link}</code>\nInvited: ${count}\n\n🎁 Rewards:\n- 5 friends = 5,000 UZS\n- 10 friends = 13,000 UZS`,
        settings_menu: "⚙️ <b>SETTINGS</b>\n\nSelect a section:",
        profile_title: (id, status) => `👤 <b>MY PROFILE</b>\n\n🆔 ID: ${id}\n✅ Status: ${status ? 'Verified' : 'No Access'}`,
        guide_title: "📚 <b>USER GUIDE</b>",
        wins_title: "🏆 <b>LATEST WINS LOG:</b>",
        support_msg: "👨‍💻 Describe your issue, admin will reply soon:",
        unverified_alert: "⚠️ <b>ACCESS DENIED!</b>\n\nTo use the Web App (Console) you must:\n\n1️⃣ Register using promo code <b>RICHI28</b>.\n2️⃣ Make a <b>minimum deposit</b>.\n3️⃣ Submit your ID to us for verification.\n\n👇 Go to the <b>\"🚀 SIGNALS\"</b> section!",
        platform_info: (name) => `🎰 <b>${name}</b> Platform\n\n❗️ <b>CONSOLE TERMS:</b>\n\n1️⃣ Register via link with promo code <b>RICHI28</b>!\n2️⃣ Make a deposit.\n3️⃣ Click "🆔 VERIFY ID" and send your ID.`,
        btn_console: "💻 OPEN CONSOLE",
        btn_signals: "🚀 SIGNALS",
        btn_network: "👥 NETWORK",
        btn_wins: "🏆 WINS",
        btn_guide: "📚 GUIDE",
        btn_wallet: "💰 WALLET",
        btn_settings: "🛠 SETTINGS",
        btn_support: "👨‍💻 SUPPORT",
        btn_change_lang: "🔄 Change Language",
        btn_notif: (n) => `🔔 Notifications: ${n ? 'ON' : 'OFF'}`,
        btn_profile: "👤 My Profile",
        btn_verify_id: "🆔 VERIFY ID",
        back: "⬅️ Back"
    }
};

// ==========================================
// 4. KEYBOARD CHECKS & RENDER
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

const getAdminMenu = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🖥 KONSOL EDIT", "admin_console"), Markup.button.callback("🚀 SIGNALS EDIT", "admin_signals")],
        [Markup.button.callback("👥 TARMOQ", "admin_network"), Markup.button.callback("🏆 YUTUQLAR", "admin_wins")],
        [Markup.button.callback("📚 QO'LLANMA", "admin_guide"), Markup.button.callback("💰 HAMYON", "admin_wallet")],
        [Markup.button.callback("📩 ARIZALAR", "admin_support"), Markup.button.callback("🛠 SOZLAMALAR", "admin_settings")],
        [Markup.button.callback("📢 REKLAMA", "admin_broadcast"), Markup.button.callback("📊 STATISTIKA", "admin_stats")]
    ]);
};

const checkSubscription = async (ctx, user) => {
    if (ctx.from.id === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    
    for (const chan of channels) {
        try {
            if (user && user.requestedChannels && user.requestedChannels.includes(chan.chatId)) continue; 
            const member = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
};

bot.on('chat_join_request', async (ctx) => {
    try {
        const userId = ctx.from.id;
        let user = await User.findOne({ userId: userId });
        if (!user) user = await User.create({ userId: userId, firstName: ctx.from.first_name });

        user = await User.findOneAndUpdate({ userId: userId }, { $addToSet: { requestedChannels: ctx.chat.id.toString() } }, { new: true });
        
        const s = strings[user.lang || 'uz'];
        await bot.telegram.sendMessage(userId, `✅ ${s.welcome}`, { parse_mode: 'HTML', ...getMainMenu(user.lang, userId === ADMIN_ID) });
    } catch (error) { console.error(error); }
});

// ==========================================
// 5. BOT FLOW (START & LANGUAGE SELECTION)
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
            return ctx.reply(strings.uz.lang_select, Markup.inlineKeyboard([
                [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
                [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
                [Markup.button.callback("🇬🇧 English", "setlang_en")]
            ]));
        }

        if (await checkSubscription(ctx, user)) {
            return ctx.reply(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
        } else {
            return ctx.reply(strings[user.lang].sub_req, Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].verify_sub, "check_sub")]]));
        }
    } catch (error) { console.error(error); }
});

bot.action(/^setlang_(uz|ru|en)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
        
        if (!(await checkSubscription(ctx, user))) {
            const chans = await Config.find({ key: 'channel' });
            const buttons = chans.map(c => [Markup.button.url(c.name, c.url)]);
            buttons.push([Markup.button.callback(strings[lang].verify_sub, "check_sub")]);
            return ctx.editMessageText(strings[lang].sub_req, Markup.inlineKeyboard(buttons));
        }
        return ctx.editMessageText(strings[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
    } catch (error) { console.error(error); }
});

bot.action(/^updatelang_(uz|ru|en)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
        const s = strings[lang];
        
        await ctx.answerCbQuery(s.lang_changed, { show_alert: true });
        
        return ctx.editMessageText(s.settings_menu, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(s.btn_change_lang, "settings_lang")],
                [Markup.button.callback(s.btn_notif(user.notifications), "settings_notif")],
                [Markup.button.callback(s.btn_profile, "settings_profile")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("check_sub", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        if (await checkSubscription(ctx, user)) {
            return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
        }
        return ctx.answerCbQuery("❌ Ruxsat yo'q!", { show_alert: true });
    } catch (error) { console.error(error); }
});

bot.action("home", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    } catch (error) { console.error(error); }
});

// ==========================================
// 6. SECTIONS & LOGIC
// ==========================================

bot.action("open_console", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        const s = strings[user.lang] || strings.uz;
        
        if (!user.isVerified) {
            return ctx.editMessageText(s.unverified_alert, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(s.btn_signals, "menu_signals")],
                    [Markup.button.callback(s.back, "home")]
                ])
            });
        }
        
        const webappConfig = await Config.findOne({ key: 'webapp_url' });
        const consoleUrl = webappConfig ? webappConfig.url : (process.env.WEB_APP_URL || "https://google.com");

        return ctx.editMessageText("🟢 TERMINAL IS ACTIVE", Markup.inlineKeyboard([
            [Markup.button.webApp(s.btn_console, consoleUrl)],
            [Markup.button.callback(s.back, "home")]
        ]));
    } catch (error) { console.error(error); }
});

bot.action("menu_signals", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        const s = strings[user.lang] || strings.uz;
        const apps = await Config.find({ key: 'app' });
        const btns = [];
        
        apps.forEach(a => btns.push([Markup.button.callback(`🚀 ${a.name}`, `app_${a._id}`)]));
        if(apps.length === 0) {
            btns.push([Markup.button.callback("🎰 1XBET", "app_1xbet")]);
            btns.push([Markup.button.callback("🟢 LINEBET", "app_linebet")]);
        }
        btns.push([Markup.button.callback(s.back, "home")]);
        
        return ctx.editMessageText(s.signals_title, Markup.inlineKeyboard(btns));
    } catch (error) { console.error(error); }
});

bot.action(/^app_(.+)$/, async (ctx) => {
    try {
        initSession(ctx);
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        
        const s = strings[user.lang];
        const appId = ctx.match[1];
        let name = "Platforma", regLink = "https://1xbet.com", dlLink = "https://t.me/richi28_apk";

        if (appId === "1xbet") { 
            name = "1XBET"; 
        } else if (appId === "linebet") { 
            name = "LINEBET"; 
            regLink = "https://linebet.com"; 
        } else {
            if (mongoose.Types.ObjectId.isValid(appId)) {
                const appInfo = await Config.findById(appId);
                if (appInfo) { 
                    name = appInfo.name || name; 
                    regLink = appInfo.url || regLink; 
                    dlLink = appInfo.content || dlLink; 
                }
            }
        }

        ctx.session.selectedApp = name;

        return ctx.editMessageText(s.platform_info(name), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url("🔗 Registration", regLink), Markup.button.url("📥 Download APK", dlLink)],
                [Markup.button.callback(s.btn_verify_id, "verify_id_start")],
                [Markup.button.callback(s.back, "menu_signals")]
            ])
        });
    } catch (error) { 
        console.error("App click error:", error); 
        ctx.answerCbQuery("Xatolik yuz berdi!", { show_alert: true });
    }
});

bot.action("verify_id_start", async (ctx) => {
    initSession(ctx); ctx.session.step = 'await_id';
    return ctx.reply("📝 ID:"); 
});

bot.action("menu_settings", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        const s = strings[user.lang];
        return ctx.editMessageText(s.settings_menu, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(s.btn_change_lang, "settings_lang")],
                [Markup.button.callback(s.btn_notif(user.notifications), "settings_notif")],
                [Markup.button.callback(s.btn_profile, "settings_profile")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("settings_lang", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
        const s = strings[user.lang];
        return ctx.editMessageText(s.lang_select, Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇿 O'zbekcha", "updatelang_uz")],
            [Markup.button.callback("🇷🇺 Русский", "updatelang_ru")],
            [Markup.button.callback("🇬🇧 English", "updatelang_en")],
            [Markup.button.callback(s.back, "menu_settings")]
        ]));
    } catch (error) { console.error(error); }
});

bot.action("settings_notif", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        user.notifications = !user.notifications;
        await user.save();
        const s = strings[user.lang];
        
        return ctx.editMessageText(s.settings_menu, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(s.btn_change_lang, "settings_lang")],
                [Markup.button.callback(s.btn_notif(user.notifications), "settings_notif")],
                [Markup.button.callback(s.btn_profile, "settings_profile")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("settings_profile", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        return ctx.editMessageText(s.profile_title(user.userId, user.isVerified), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "menu_settings")]])
        });
    } catch (error) { console.error(error); }
});

bot.action("menu_network", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        return ctx.editMessageText(s.ref_title(user.referrals, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_wallet", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        return ctx.editMessageText(s.wallet_title(user.balance), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💸 Withdraw", "withdraw_start")], [Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("withdraw_start", (ctx) => { initSession(ctx); ctx.session.step = 'withdraw_card'; return ctx.reply("💳 Card Number:"); });

bot.action("menu_guide", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const guide = await Config.findOne({ key: 'guide' });
        return ctx.editMessageText(`${s.guide_title}\n\n${guide ? guide.content : "Tez orada kiritiladi."}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_wins", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const customWins = await Config.findOne({ key: 'wins_log' });
        
        let wins = `${s.wins_title}\n\n`;
        if(customWins && customWins.content) {
            wins += customWins.content;
        } else {
            for(let i=0; i<10; i++) {
                const id = Math.floor(1000 + Math.random() * 8000);
                const amt = (Math.floor(Math.random() * 5000000) + 500000).toLocaleString();
                wins += `✅ ID: ${id}** | +${amt} UZS\n`;
            }
        }
        return ctx.editMessageText(wins, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_support", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        initSession(ctx); ctx.session.step = 'support';
        return ctx.editMessageText(strings[user.lang].support_msg, Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]));
    } catch (error) { console.error(error); }
});

// Web Appdan yuborilgan ma'lumotni tutib olish
bot.on('web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.webAppData.data());
        if (data.type === 'support') {
            // Admin panelga yoki adminga yuborish
            await ctx.telegram.sendMessage(ADMIN_ID, `📩 **YANGI MUROJAAT (Web Appdan):**\n\nFoydalanuvchi: ${ctx.from.first_name}\nID: ${ctx.from.id}\nMatn: ${data.text}`);
            await ctx.reply("✅ Murojaatingiz adminga yetkazildi!");
        }
    } catch (e) {
        console.error("Web App Data Error:", e);
    }
});


// ==========================================
// 8. ADMIN PANEL ACTIONS & DEEP DIVES
// ==========================================

bot.action("admin_panel", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("Siz admin emassiz!", { show_alert: true });
    initSession(ctx); ctx.session.step = null;
    return ctx.editMessageText("👑 <b>ADMIN MASTER CONTROL</b>\n\nQuyidagi boshqaruv bloklaridan birini tanlang:", { parse_mode: 'HTML', ...getAdminMenu() });
});

// 1. KONSOL EDIT
bot.action("admin_console", (ctx) => {
    return ctx.editMessageText("🖥 <b>KONSOL EDIT</b>\n\nWeb App havolasini va verifikatsiya qoidalarini boshqaring:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🔗 Linkni o'zgartirish", "admin_console_link")],
            [Markup.button.callback("🔑 Kirishni boshqarish", "admin_console_access")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_console_link", (ctx) => { initSession(ctx); ctx.session.step = 'admin_console_link'; return ctx.reply("Yangi Web App (Konsol) havolasini yuboring (https://...):"); });
bot.action("admin_console_access", (ctx) => { return ctx.answerCbQuery("Tez orada qo'shiladi...", { show_alert: true }); });

// 2. SIGNALS EDIT
bot.action("admin_signals", (ctx) => {
    return ctx.editMessageText("🚀 <b>SIGNALS EDIT</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("➕ Ilova qo'shish", "admin_add_app"), Markup.button.callback("✅ ID Tasdiqlash", "admin_verify_ids")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_add_app", (ctx) => { initSession(ctx); ctx.session.step = 'admin_add_app_name'; return ctx.reply("Ilova nomini kiriting (masalan, 1XBET):"); });
bot.action("admin_verify_ids", async (ctx) => { return ctx.answerCbQuery("Tasdiqlanmagan ID lar kutilmoqda...", { show_alert: true }); });

// 3. TARMOQ
bot.action("admin_network", (ctx) => {
    return ctx.editMessageText("👥 <b>TARMOQ (Referal)</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("💵 Bonus narxi", "admin_ref_bonus")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_ref_bonus", (ctx) => { initSession(ctx); ctx.session.step = 'admin_ref_bonus'; return ctx.reply("5 ta do'st uchun yangi bonus summasini yozing:"); });

// 4. YUTUQLAR
bot.action("admin_wins", (ctx) => {
    return ctx.editMessageText("🏆 <b>YUTUQLAR</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("✍️ Log yozish", "admin_wins_log")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_wins_log", (ctx) => { initSession(ctx); ctx.session.step = 'admin_wins_log'; return ctx.reply("Yangi yutuqlar ro'yxatini yuboring (Har biri yangi qatorda):"); });

// 5. QO'LLANMA
bot.action("admin_guide", (ctx) => {
    return ctx.editMessageText("📚 <b>QO'LLANMA</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("📹 Video yuklash", "admin_guide_video"), Markup.button.callback("📝 Matnni tahrirlash", "admin_guide_text")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_guide_text", (ctx) => { initSession(ctx); ctx.session.step = 'admin_guide_text'; return ctx.reply("Qo'llanma matnini yuboring:"); });
bot.action("admin_guide_video", (ctx) => { return ctx.answerCbQuery("Tez orada...", { show_alert: true }); });

// 6. HAMYON
bot.action("admin_wallet", (ctx) => {
    return ctx.editMessageText("💰 <b>HAMYON</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("📥 To'lov so'rovlari", "admin_wallet_reqs"), Markup.button.callback("💳 Minimal summa", "admin_wallet_min")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_wallet_min", (ctx) => { initSession(ctx); ctx.session.step = 'admin_wallet_min'; return ctx.reply("Yangi minimal pul yechish summasini yozing:"); });
bot.action("admin_wallet_reqs", (ctx) => { return ctx.answerCbQuery("Hozircha so'rovlar yo'q.", { show_alert: true }); });

// 7. SOZLAMALAR
bot.action("admin_settings", (ctx) => {
    return ctx.editMessageText("🛠 <b>SOZLAMALAR</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🌐 Tillarni boshqarish", "admin_set_lang"), Markup.button.callback("📢 Majburiy kanallar", "admin_set_chan")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_set_chan", (ctx) => { initSession(ctx); ctx.session.step = 'admin_add_channel'; return ctx.reply("Majburiy obuna uchun kanal linki va IDsini yuboring:"); });
bot.action("admin_set_lang", (ctx) => { return ctx.answerCbQuery("Tillarni kod orqali o'zgartirish qulayroq.", { show_alert: true }); });

// 8. ARIZALAR
bot.action("admin_support", (ctx) => {
    return ctx.editMessageText("📩 <b>ARIZALAR</b>\n\nKutilayotgan murojaatlar ro'yxati hozircha bo'sh.", {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});

// 9. REKLAMA (BROADCAST)
bot.action("admin_broadcast", (ctx) => {
    initSession(ctx); ctx.session.step = 'await_broadcast_msg';
    return ctx.editMessageText("📢 Tarqatmoqchi bo'lgan xabaringizni yuboring (rasm, video yoki matn):", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]]));
});

bot.action("confirm_broadcast", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID || !ctx.session.broadcastMsgId) return;
    ctx.reply("📢 Tarqatish boshlandi... Iltimos kuting.");
    const users = await User.find({}, 'userId');
    let success = 0, fail = 0;
    
    for (const u of users) {
        try {
            await ctx.telegram.copyMessage(u.userId, ctx.from.id, ctx.session.broadcastMsgId);
            success++;
        } catch(e) { fail++; }
    }
    return ctx.reply(`✅ REKLAMA TUGADI!\n\nYetib bordi: ${success} ta\nXato/Bloklaganlar: ${fail} ta`);
});

// 10. STATISTIKA
bot.action("admin_stats", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({isVerified: true});
        const today = new Date(); today.setHours(0,0,0,0);
        const todayUsers = await User.countDocuments({joinedAt: {$gte: today}});
        
        const statsMsg = `📊 <b>STATISTIKA</b>\n\n👥 Jami userlar: ${totalUsers}\n✅ Tasdiqlanganlar: ${verifiedUsers}\n🔄 Bugun kelganlar: ${todayUsers}\n💰 Jami yechilgan summalar: 0 UZS`;
        
        return ctx.editMessageText(statsMsg, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]])});
    } catch(e) { console.error(e); ctx.answerCbQuery("Xato", {show_alert:true}); }
});


// ==========================================
// 9. MESSAGE HANDLER (TEXT & MEDIA)
// ==========================================
bot.on('message', async (ctx) => {
    initSession(ctx);
    const step = ctx.session.step;
    if (!step) return;

    // --- ADMIN BROADCAST HANDLING (Accepts Media/Text) ---
    if (ctx.from.id === ADMIN_ID && step === 'await_broadcast_msg') {
        ctx.session.broadcastMsgId = ctx.message.message_id;
        return ctx.reply(`Hamma kishiga yuboraymi?`, Markup.inlineKeyboard([
            [Markup.button.callback("✅ HA (Barchaga yuborish)", "confirm_broadcast")],
            [Markup.button.callback("❌ BEKOR QILISH", "admin_panel")]
        ]));
    }

    // --- TEXT ONLY HANDLERS BELOW ---
    if (!ctx.message.text) return;
    const text = ctx.message.text.trim();

    try {
        // ADMIN TEXT STATES
        if (ctx.from.id === ADMIN_ID) {
            if (step === 'admin_console_link') {
                await Config.findOneAndUpdate({key: 'webapp_url'}, {url: text}, {upsert: true});
                ctx.session.step = null;
                return ctx.reply("✅ Web App linki yangilandi!");
            }
            if (step === 'admin_ref_bonus') {
                ctx.session.step = null; return ctx.reply("✅ Bonus narxi yangilandi!");
            }
            if (step === 'admin_wins_log') {
                await Config.findOneAndUpdate({key: 'wins_log'}, {content: text}, {upsert: true});
                ctx.session.step = null; return ctx.reply("✅ Yutuqlar ro'yxati yangilandi!");
            }
            if (step === 'admin_guide_text') {
                await Config.findOneAndUpdate({key: 'guide'}, {content: text}, {upsert: true});
                ctx.session.step = null; return ctx.reply("✅ Qo'llanma matni yangilandi!");
            }
            if (step === 'admin_wallet_min') {
                ctx.session.step = null; return ctx.reply("✅ Minimal summa yangilandi!");
            }
            if (step === 'admin_add_app_name') {
                ctx.session.tempApp = { name: text };
                ctx.session.step = 'admin_add_app_url';
                return ctx.reply("Platforma registratsiya ssilkasini yuboring:");
            }
            if (step === 'admin_add_app_url') {
                ctx.session.tempApp.url = text;
                await Config.create({ key: 'app', name: ctx.session.tempApp.name, url: text, content: "https://t.me/" });
                ctx.session.step = null;
                return ctx.reply("✅ Platforma ro'yxatga qo'shildi!");
            }
            if (step.startsWith('reply_to_')) {
                const targetUserId = step.split('_')[2];
                bot.telegram.sendMessage(targetUserId, `👨‍💻 <b>ADMINDAN JAVOB KELDI:</b>\n\n${text}`, { parse_mode: 'HTML' });
                ctx.session.step = null;
                return ctx.reply("✅ Javob yuborildi.");
            }
        }

        // USER TEXT STATES
        if (step === 'await_id') {
            if (!/^\d{10}$/.test(text)) return ctx.reply("❌ Xato! 10 ta raqam bo'lishi kerak.");

            const platform = ctx.session.selectedApp || "Noma'lum";
            await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text });
            
            bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>YANGI ID SO'ROVI</b>\n\n👤 ${ctx.from.first_name}\n🎮 <b>${platform}</b>\n🆔 Game ID: <code>${text}</code>`, {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✅ TASDIQLASH", `approve_${ctx.from.id}`)], [Markup.button.callback("❌ RAD ETISH", `reject_${ctx.from.id}`)]])
            });
            ctx.session.step = null;
            return ctx.reply("⏳ Kuting, adminga yuborildi.");
        } 
        
        if (step === 'support') {
            bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI ARIZA</b>\n\nKimdan: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\n\n📝 ${text}`, {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✍️ Javob yozish", `reply_to_${ctx.from.id}`)]])
            });
            ctx.session.step = null;
            return ctx.reply("✅ Yuborildi.");
        }
        
        if (step === 'withdraw_card') {
            bot.telegram.sendMessage(ADMIN_ID, `📥 <b>YANGI PULL YECHISH SO'ROVI</b>\n\nFoydalanuvchi: ${ctx.from.first_name}\nKarta raqami: ${text}`);
            ctx.session.step = null;
            return ctx.reply("✅ So'rov adminga yuborildi!");
        }

    } catch (error) { console.error(error); }
});

// ADMIN INLINE APPROVAL/REJECTION CALLBACKS
bot.action(/^reply_to_(\d+)$/, (ctx) => {
    initSession(ctx); ctx.session.step = `reply_to_${ctx.match[1]}`;
    return ctx.reply(`✍️ Javob yozing:`);
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    try {
        await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
        bot.telegram.sendMessage(ctx.match[1], "✅ Sizning ID raqamingiz tasdiqlandi! Endi KONSOL ochiq.", { parse_mode: 'HTML' });
        return ctx.editMessageText("✅ Tasdiqlandi!");
    } catch (error) { console.error(error); }
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    try {
        await User.findOneAndUpdate({ userId: ctx.match[1] }, { gameId: "Rad etildi", isVerified: false });
        bot.telegram.sendMessage(ctx.match[1], "❌ Sizning ID raqamingiz rad etildi.", { parse_mode: 'HTML' });
        return ctx.editMessageText("❌ Rad etildi!");
    } catch (error) { console.error(error); }
});

// EXPRESS SERVER
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK - RICHI28 BOT IS RUNNING WITH ADMIN PANEL'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port: ${PORT}`));

bot.launch().then(() => console.log('🚀 RICHI28 BOT STARTED SUCCESSFULLY'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
