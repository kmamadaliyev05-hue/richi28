const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

const app = express();
const ADMIN_ID = 6137845806; // O'zingizning ID raqamingiz

// ==========================================
// 1. MA'LUMOTLAR BAZASI (MODELS)
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
    key: { type: String }, // channel, app, guide, guide_video, webapp_url, ref_bonus, min_withdraw, wins_log
    name: String,
    url: String,
    chatId: String,
    content: String
});

const User = mongoose.model('User', UserSchema);
const Config = mongoose.model('Config', ConfigSchema);

// ==========================================
// 2. BOT VA BAZANI ISHGA TUSHIRISH
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

const initSession = (ctx) => {
    if (!ctx.session) ctx.session = {};
};

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🛡️ RICHI28 MA\'LUMOTLAR BAZASIGA ULANDI'))
    .catch(err => console.error('❌ Baza xatoligi:', err));

// ==========================================
// 3. MATNLAR VA MUOMALA (I18N)
// ==========================================
const strings = {
    uz: {
        lang_select: "🌐 Iltimos, o'zingizga qulay tilni tanlang / Выберите язык / Select language:",
        lang_changed: "✅ Tilingiz muvaffaqiyatli o'zgartirildi!",
        welcome: "⚡️ <b>[ RICHI28 HACK PORTAL ]</b> ⚡️\n\nHurmatli foydalanuvchi, tizimga xush kelibsiz!",
        sub_req: "🔐 Botimizdan to'liq foydalanish uchun, iltimos, quyidagi kanallarga obuna bo'ling:",
        verify_sub: "✅ Obunani tasdiqlash",
        signals_title: "🚀 O'zingizga qulay platformani tanlang va ro'yxatdan o'tib, o'yin ID raqamingizni yuboring:",
        wallet_title: (bal) => `💰 <b>SHAXSIY HAMYON</b>\n\nJoriy balansingiz: ${bal.toLocaleString()} UZS\n\n💡 <i>Eslatma: Mablag'ni yechib olish uchun hisobingizda yetarli mablag' bo'lishi kerak.</i>`,
        ref_title: (count, link) => `👥 <b>HAMKORLIK TARMOG'I</b>\n\nSizning shaxsiy havolangiz: \n<code>${link}</code>\n\nTaklif qilingan do'stlar: ${count} ta\n\n🎁 <b>Mukofotlar:</b>\nDo'stlaringizni taklif qilib, qo'shimcha daromad toping!`,
        settings_menu: "⚙️ <b>SOZLAMALAR</b>\n\nIltimos, kerakli bo'limni tanlang:",
        profile_title: (id, status) => `👤 <b>MENING PROFILIM</b>\n\n🆔 Shaxsiy ID: ${id}\n✅ Holat: ${status ? 'Tasdiqlangan 🟢' : 'Ruxsat yo\'q 🔴'}`,
        guide_title: "📚 <b>FOYDALANISH QO'LLANMASI</b>",
        wins_title: "🏆 <b>SO'NGGI YUTUQLAR TARIXI:</b>",
        support_msg: "👨‍💻 Hurmatli foydalanuvchi, savol yoki muammoingizni shu yerda yozib qoldiring. Ma'muriyatimiz sizga tez orada javob beradi:",
        unverified_alert: "⚠️ <b>KONSOLGA RUXSAT YO'Q!</b>\n\nAvval <b>\"🚀 SIGNALLAR\"</b> bo'limiga o'ting va u yerdan o'zingizga qulay platformani tanlang. Shartlarda aytilganidek ro'yxatdan o'tib, <b>ID raqamingizni tasdiqlab olishingiz kerak!</b>",
        platform_info: (name) => `🎰 <b>${name}</b> platformasi\n\n❗️ <b>KONSOLDAN FOYDALANISH SHARTLARI:</b>\n\n1️⃣ Platforma havolasi orqali kiring va ro'yxatdan o'tishda <b>RICHI28</b> promokodidan foydalaning!\n2️⃣ Minimal depozit kiriting.\n3️⃣ \"🆔 ID TASDIQLASH\" tugmasini bosib, o'z ID raqamingizni bizga yuboring.`,
        btn_console: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 YORDAM XIZMATI",
        btn_change_lang: "🔄 Tilni o'zgartirish",
        btn_notif: (n) => `🔔 Bildirishnomalar: ${n ? 'YONIQ ✅' : 'O\'CHIQ ❌'}`,
        btn_profile: "👤 Profilim",
        btn_verify_id: "🆔 ID TASDIQLASH",
        back: "⬅️ Ortga qaytish"
    },
    ru: {
        lang_select: "🌐 Выберите язык / Select language:",
        lang_changed: "✅ Язык успешно изменен!",
        welcome: "⚡️ <b>[ RICHI28 HACK PORTAL ]</b> ⚡️\n\nУважаемый пользователь, добро пожаловать в систему!",
        sub_req: "🔐 Для полноценного использования бота, пожалуйста, подпишитесь на наши каналы:",
        verify_sub: "✅ Подтвердить подписку",
        signals_title: "🚀 Выберите удобную платформу и отправьте свой ID:",
        wallet_title: (bal) => `💰 <b>КОШЕЛЕК</b>\n\nВаш баланс: ${bal.toLocaleString()} UZS`,
        ref_title: (count, link) => `👥 <b>ПАРТНЕРСКАЯ СЕТЬ</b>\n\nВаша личная ссылка: \n<code>${link}</code>\n\nПриглашенные друзья: ${count}`,
        settings_menu: "⚙️ <b>НАСТРОЙКИ</b>\n\nПожалуйста, выберите нужный раздел:",
        profile_title: (id, status) => `👤 <b>МОЙ ПРОФИЛЬ</b>\n\n🆔 Ваш ID: ${id}\n✅ Статус: ${status ? 'Подтвержден 🟢' : 'Нет доступа 🔴'}`,
        guide_title: "📚 <b>РУКОВОДСТВО ПОЛЬЗОВАТЕЛЯ</b>",
        wins_title: "🏆 <b>ИСТОРИЯ ПОБЕД:</b>",
        support_msg: "👨‍💻 Пожалуйста, опишите вашу проблему или задайте вопрос:",
        unverified_alert: "⚠️ <b>ДОСТУП К КОНСОЛИ ЗАКРЫТ!</b>\n\nСначала перейдите в раздел <b>\"🚀 СИГНАЛЫ\"</b>, выберите платформу, зарегистрируйтесь по правилам и отправьте свой ID на проверку!",
        platform_info: (name) => `🎰 Платформа <b>${name}</b>\n\n❗️ <b>УСЛОВИЯ ИСПОЛЬЗОВАНИЯ:</b>\n\n1️⃣ Зарегистрируйтесь с промокодом <b>RICHI28</b>!\n2️⃣ Внесите депозит.\n3️⃣ Отправьте нам свой ID.`,
        btn_console: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ПОБЕДЫ",
        btn_guide: "📚 РУКОВОДСТВО",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 ПОДДЕРЖКА",
        btn_change_lang: "🔄 Изменить язык",
        btn_notif: (n) => `🔔 Уведомления: ${n ? 'ВКЛ ✅' : 'ВЫКЛ ❌'}`,
        btn_profile: "👤 Мой профиль",
        btn_verify_id: "🆔 ПОДТВЕРДИТЬ ID",
        back: "⬅️ Назад"
    },
    en: {
        lang_select: "🌐 Select language:",
        lang_changed: "✅ Language changed successfully!",
        welcome: "⚡️ <b>[ RICHI28 HACK PORTAL ]</b> ⚡️\n\nDear user, welcome to the system!",
        sub_req: "🔐 To fully use our bot, please subscribe to our official channels:",
        verify_sub: "✅ Verify Subscription",
        signals_title: "🚀 Please select a platform, register, and send your ID:",
        wallet_title: (bal) => `💰 <b>MY WALLET</b>\n\nCurrent balance: ${bal.toLocaleString()} UZS`,
        ref_title: (count, link) => `👥 <b>AFFILIATE NETWORK</b>\n\nYour personal link: \n<code>${link}</code>\n\nInvited friends: ${count}`,
        settings_menu: "⚙️ <b>SETTINGS</b>\n\nPlease select a section:",
        profile_title: (id, status) => `👤 <b>MY PROFILE</b>\n\n🆔 Personal ID: ${id}\n✅ Status: ${status ? 'Verified 🟢' : 'No Access 🔴'}`,
        guide_title: "📚 <b>USER GUIDE</b>",
        wins_title: "🏆 <b>LATEST WINS HISTORY:</b>",
        support_msg: "👨‍💻 Please describe your issue or ask your question:",
        unverified_alert: "⚠️ <b>CONSOLE ACCESS DENIED!</b>\n\nFirst, go to the <b>\"🚀 SIGNALS\"</b> section, choose a platform, register following the rules, and submit your ID for verification!",
        platform_info: (name) => `🎰 <b>${name}</b> Platform\n\n❗️ <b>CONSOLE TERMS OF USE:</b>\n\n1️⃣ Register using the promo code <b>RICHI28</b>!\n2️⃣ Make a deposit.\n3️⃣ Send your ID.`,
        btn_console: "💻 OPEN CONSOLE",
        btn_signals: "🚀 SIGNALS",
        btn_network: "👥 NETWORK",
        btn_wins: "🏆 WINS",
        btn_guide: "📚 GUIDE",
        btn_wallet: "💰 WALLET",
        btn_settings: "🛠 SETTINGS",
        btn_support: "👨‍💻 SUPPORT",
        btn_change_lang: "🔄 Change Language",
        btn_notif: (n) => `🔔 Notifications: ${n ? 'ON ✅' : 'OFF ❌'}`,
        btn_profile: "👤 My Profile",
        btn_verify_id: "🆔 VERIFY ID",
        back: "⬅️ Back"
    }
};

// ==========================================
// 4. KLAVIATURALAR VA TEKSHIRUVLAR
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
        [Markup.button.callback("🖥 KONSOL SOZLAMALARI", "admin_console"), Markup.button.callback("🚀 PLATFORMALAR", "admin_signals")],
        [Markup.button.callback("👥 TARMOQ", "admin_network"), Markup.button.callback("🏆 YUTUQLAR", "admin_wins")],
        [Markup.button.callback("📚 QO'LLANMA", "admin_guide"), Markup.button.callback("💰 HAMYON", "admin_wallet")],
        [Markup.button.callback("📩 ARIZALAR", "admin_support"), Markup.button.callback("📢 KANALLAR / SOZLAMALAR", "admin_settings")],
        [Markup.button.callback("📢 REKLAMA YUBORISH", "admin_broadcast"), Markup.button.callback("📊 STATISTIKA", "admin_stats")],
        [Markup.button.callback("⬅️ Asosiy menyuga qaytish", "home")]
    ]);
};

const getSubMenu = async (lang) => {
    const chans = await Config.find({ key: 'channel' });
    const buttons = chans.map(c => [Markup.button.url(c.name || "Kanalga obuna bo'lish", c.url)]);
    buttons.push([Markup.button.callback(strings[lang]?.verify_sub || strings.uz.verify_sub, "check_sub")]);
    return Markup.inlineKeyboard(buttons);
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
        } catch (e) { 
            return false; 
        }
    }
    return true;
};

const safeEdit = async (ctx, text, extra) => {
    try {
        await ctx.editMessageText(text, extra);
    } catch (e) {
        try {
            await ctx.deleteMessage();
            await ctx.reply(text, extra);
        } catch (err) {
            await ctx.reply(text, extra);
        }
    }
};

bot.on('chat_join_request', async (ctx) => {
    try {
        const userId = ctx.from.id;
        await User.findOneAndUpdate(
            { userId: userId },
            { 
                $setOnInsert: { firstName: ctx.from.first_name, joinedAt: Date.now() },
                $addToSet: { requestedChannels: ctx.chat.id.toString() }
            },
            { new: true, upsert: true }
        );
        // O'ZGARISH: Darhol menyu bermaymiz. Shunchaki botga o'tib tugmani bosishni so'raymiz
        await bot.telegram.sendMessage(userId, "✅ So'rovingiz qabul qilindi. Iltimos, botga qaytib <b>✅ Obunani tasdiqlash</b> tugmasini bosing.", { parse_mode: 'HTML' });
    } catch (error) { console.error(error); }
});

// ==========================================
// 5. BOTNI BOSHASH VA TIL TANLASH
// ==========================================
bot.start(async (ctx) => {
    try {
        const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
        let user = await User.findOne({ userId: ctx.from.id });

        if (!user) {
            user = new User({ userId: ctx.from.id, firstName: ctx.from.first_name, invitedBy: refId });
            await user.save();
            if (refId && refId !== ctx.from.id) {
                await User.findOneAndUpdate({ userId: refId }, { $inc: { balance: 1000, referrals: 1 } });
            }
            return await ctx.reply(strings.uz.lang_select, Markup.inlineKeyboard([
                [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
                [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
                [Markup.button.callback("🇬🇧 English", "setlang_en")]
            ]));
        }

        if (await checkSubscription(ctx, user)) {
            return await ctx.reply(strings[user.lang].welcome, { parse_mode: 'HTML', ...getMainMenu(user.lang, ctx.from.id === ADMIN_ID) });
        } else {
            const subMenu = await getSubMenu(user.lang);
            return await ctx.reply(strings[user.lang].sub_req, subMenu);
        }
    } catch (error) { console.error(error); }
});

bot.action(/^setlang_(uz|ru|en)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
        
        if (!(await checkSubscription(ctx, user))) {
            const subMenu = await getSubMenu(lang);
            return await safeEdit(ctx, strings[lang].sub_req, subMenu);
        }
        return await safeEdit(ctx, strings[lang].welcome, { parse_mode: 'HTML', ...getMainMenu(lang, ctx.from.id === ADMIN_ID) });
    } catch (error) { console.error(error); }
});

bot.action(/^updatelang_(uz|ru|en)$/, async (ctx) => {
    try {
        const lang = ctx.match[1];
        const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
        const s = strings[lang];
        await ctx.answerCbQuery(s.lang_changed, { show_alert: true });
        return await safeEdit(ctx, s.settings_menu, {
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
        if (!user) return await ctx.answerCbQuery("Iltimos, botni qayta ishga tushiring: /start", { show_alert: true });
        
        if (await checkSubscription(ctx, user)) {
            return await safeEdit(ctx, strings[user.lang].welcome, { parse_mode: 'HTML', ...getMainMenu(user.lang, ctx.from.id === ADMIN_ID) });
        }
        return await ctx.answerCbQuery("❌ Kechirasiz, siz barcha kanallarga a'zo bo'lmagansiz!", { show_alert: true });
    } catch (error) { console.error(error); }
});

bot.action("home", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return await ctx.answerCbQuery("Iltimos, botni qayta ishga tushiring: /start", { show_alert: true });
        return await safeEdit(ctx, strings[user.lang].welcome, { parse_mode: 'HTML', ...getMainMenu(user.lang, ctx.from.id === ADMIN_ID) });
    } catch (error) { console.error(error); }
});

// ==========================================
// 6. ASOSIY BO'LIMLAR VA MANTIQ
// ==========================================

bot.action("open_console", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang] || strings.uz;
        
        if (!user.isVerified) {
            return await safeEdit(ctx, s.unverified_alert, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(s.btn_signals, "menu_signals")],
                    [Markup.button.callback(s.back, "home")]
                ])
            });
        }
        
        const webappConfig = await Config.findOne({ key: 'webapp_url' });
        const consoleUrl = webappConfig ? webappConfig.url : (process.env.WEB_APP_URL || "https://kmamadaliyev05-hue.github.io/richi28");

        return await safeEdit(ctx, "🟢 <b>TERMINAL IS ACTIVE</b>\n\nIltimos, konsolni ochish uchun quyidagi tugmani bosing:", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp(s.btn_console, consoleUrl)],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("menu_signals", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang] || strings.uz;
        const apps = await Config.find({ key: 'app' });
        const btns = [];
        
        apps.forEach(a => btns.push([Markup.button.callback(`🚀 ${a.name}`, `app_${a._id}`)]));
        if(apps.length === 0) {
            btns.push([Markup.button.callback("🎰 1XBET", "app_1xbet")]);
            btns.push([Markup.button.callback("🟢 LINEBET", "app_linebet")]);
        }
        btns.push([Markup.button.callback(s.back, "home")]);
        
        return await safeEdit(ctx, s.signals_title, Markup.inlineKeyboard(btns));
    } catch (error) { console.error(error); }
});

bot.action(/^app_(.+)$/, async (ctx) => {
    try {
        initSession(ctx);
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const appId = ctx.match[1];
        let name = "Platforma", regLink = "https://refpa74525.com/L?tag=s_5580072m_6741C_&Site=5580072&ad=6741", dlLink = "https://t.me/richi28_apk";

        if (appId === "1xbet") { name = "1XBET"; } 
        else if (appId === "linebet") { name = "LINEBET"; regLink = "https://lb-aff.com/L?tag=d_5580122m_95873C_&Site=5580122&ad=95873"; } 
        else {
            if (mongoose.Types.ObjectId.isValid(appId)) {
                const appInfo = await Config.findById(appId);
                if (appInfo) { name = appInfo.name || name; regLink = appInfo.url || regLink; dlLink = appInfo.content || dlLink; }
            }
        }
        ctx.session.selectedApp = name;

        return await safeEdit(ctx, s.platform_info(name), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url("🔗 Ro'yxatdan o'tish", regLink), Markup.button.url("📥 APK Yuklash", dlLink)],
                [Markup.button.callback(s.btn_verify_id, "verify_id_start")],
                [Markup.button.callback(s.back, "menu_signals")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("verify_id_start", async (ctx) => {
    initSession(ctx); ctx.session.step = 'await_id';
    return await ctx.reply("📝 Iltimos, o'yin ID raqamingizni kiriting:"); 
});

bot.action("menu_settings", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        return await safeEdit(ctx, s.settings_menu, {
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
        if (!user) return;
        const s = strings[user.lang];
        return await safeEdit(ctx, s.lang_select, Markup.inlineKeyboard([
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
        return await safeEdit(ctx, s.settings_menu, {
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
        return await safeEdit(ctx, s.profile_title(user.userId, user.isVerified), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "menu_settings")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_network", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        return await safeEdit(ctx, s.ref_title(user.referrals, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_wallet", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        return await safeEdit(ctx, s.wallet_title(user.balance), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💸 Pulni yechib olish", "withdraw_start")], [Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("withdraw_start", async (ctx) => { initSession(ctx); ctx.session.step = 'withdraw_card'; return await ctx.reply("💳 Iltimos, pul yechib olinadigan karta raqamingizni yuboring:"); });

bot.action("menu_guide", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const guideText = await Config.findOne({ key: 'guide' });
        const guideVideo = await Config.findOne({ key: 'guide_video' });
        
        const text = `${s.guide_title}\n\n${guideText && guideText.content ? guideText.content : "Tez orada ma'lumot kiritiladi."}`;
        
        if (guideVideo && guideVideo.content) {
            try { await ctx.deleteMessage(); } catch(e) {}
            return await ctx.replyWithVideo(guideVideo.content, { caption: text, parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
        } else {
            return await safeEdit(ctx, text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
        }
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
        return await safeEdit(ctx, wins, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_support", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        initSession(ctx); ctx.session.step = 'support';
        return await safeEdit(ctx, strings[user.lang].support_msg, Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]));
    } catch (error) { console.error(error); }
});


// ==========================================
// 8. ADMIN PANEL VA BOSHQARUV
// ==========================================

bot.action("admin_panel", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return await ctx.answerCbQuery("Kechirasiz, bu bo'lim administratorlar uchun!", { show_alert: true });
    initSession(ctx); ctx.session.step = null;
    return await safeEdit(ctx, "👑 <b>ADMINISTRATOR PANELI</b>\n\nBoshqaruv bo'limlaridan birini tanlang:", { parse_mode: 'HTML', ...getAdminMenu() });
});

bot.action("admin_console", async (ctx) => {
    return await safeEdit(ctx, "🖥 <b>KONSOL SOZLAMALARI</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🔗 Linkni o'zgartirish", "admin_console_link")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_console_link", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_console_link'; return await ctx.reply("Yangi Web App (Konsol) havolasini yuboring (https://... formatida):"); });

bot.action("admin_signals", async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = [];
    apps.forEach(a => btns.push([Markup.button.callback(`❌ O'chirish: ${a.name}`, `admin_del_app_${a._id}`)]));
    btns.push([Markup.button.callback("➕ Yangi platforma qo'shish", "admin_add_app")]);
    btns.push([Markup.button.callback("⬅️ Ortga", "admin_panel")]);

    return await safeEdit(ctx, "🚀 <b>PLATFORMALAR (SIGNALS)</b>\n\nJoriy platformalar ro'yxati va ularni o'chirish:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(btns)
    });
});
bot.action("admin_add_app", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_add_app_name'; return await ctx.reply("Yangi platforma nomini kiriting (Masalan: 1WIN):"); });
bot.action(/^admin_del_app_(.+)$/, async (ctx) => {
    try {
        await Config.findByIdAndDelete(ctx.match[1]);
        await ctx.answerCbQuery("✅ Platforma o'chirildi!", { show_alert: true });
        return bot.action("admin_signals")(ctx);
    } catch(e) { console.error(e); }
});

bot.action("admin_network", async (ctx) => {
    return await safeEdit(ctx, "👥 <b>TARMOQ (Referal tizimi)</b>", {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💵 Bonus miqdorini o'zgartirish", "admin_ref_bonus")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});
bot.action("admin_ref_bonus", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_ref_bonus'; return await ctx.reply("Yangi bonus summasini yozing:"); });

bot.action("admin_wins", async (ctx) => {
    return await safeEdit(ctx, "🏆 <b>YUTUQLAR TARIXI</b>", {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✍️ Yangi ro'yxat kiritish", "admin_wins_log")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});
bot.action("admin_wins_log", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_wins_log'; return await ctx.reply("Yangi yutuqlar ro'yxatini yuboring (Har biri yangi qatorda bo'lishi tavsiya etiladi):"); });

bot.action("admin_guide", async (ctx) => {
    return await safeEdit(ctx, "📚 <b>QO'LLANMA SOZLAMALARI</b>\n\nQo'llanma uchun matn yoki video yuklashingiz mumkin:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("📹 Video yuklash/yangilash", "admin_guide_video")], 
            [Markup.button.callback("📝 Matnni tahrirlash", "admin_guide_text")],
            [Markup.button.callback("🗑 Videoni olib tashlash", "admin_guide_del_video")],
            [Markup.button.callback("⬅️ Ortga", "admin_panel")]
        ])
    });
});
bot.action("admin_guide_text", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_guide_text'; return await ctx.reply("Qo'llanma uchun yangi matnni yuboring:"); });
bot.action("admin_guide_video", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_guide_video'; return await ctx.reply("Qo'llanma uchun videoni yuboring (.mp4 yoki telegram video):"); });
bot.action("admin_guide_del_video", async (ctx) => {
    await Config.findOneAndDelete({ key: 'guide_video' });
    return await ctx.answerCbQuery("✅ Video o'chirildi, endi faqat matn ko'rinadi.", { show_alert: true });
});

bot.action("admin_wallet", async (ctx) => {
    return await safeEdit(ctx, "💰 <b>HAMYON SOZLAMALARI</b>", {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💳 Minimal summa", "admin_wallet_min")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});
bot.action("admin_wallet_min", async (ctx) => { initSession(ctx); ctx.session.step = 'admin_wallet_min'; return await ctx.reply("Pul yechish uchun yangi minimal summani yozing:"); });

bot.action("admin_settings", async (ctx) => {
    const channels = await Config.find({ key: 'channel' });
    const btns = [];
    channels.forEach(ch => btns.push([Markup.button.callback(`❌ O'chirish: ${ch.name}`, `admin_del_chan_${ch._id}`)]));
    btns.push([Markup.button.callback("➕ Yangi kanal qo'shish", "admin_add_chan")]);
    btns.push([Markup.button.callback("⬅️ Ortga", "admin_panel")]);

    return await safeEdit(ctx, "📢 <b>MAJBURIY KANALLAR VA SOZLAMALAR</b>\n\nJoriy majburiy kanallar:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(btns)
    });
});

bot.action("admin_add_chan", async (ctx) => { 
    initSession(ctx); 
    ctx.session.step = 'admin_add_channel'; 
    return await ctx.reply("Yangi kanal ma'lumotlarini quyidagi formatda yuboring:\n\n`Kanal Nomi | https://t.me/kanal_link | -1001234567890`", {parse_mode: 'Markdown'}); 
});

bot.action(/^admin_del_chan_(.+)$/, async (ctx) => {
    try {
        await Config.findByIdAndDelete(ctx.match[1]);
        await ctx.answerCbQuery("✅ Kanal majburiy obunadan olib tashlandi!", { show_alert: true });
        return bot.action("admin_settings")(ctx);
    } catch(e) { console.error(e); }
});

bot.action("admin_support", async (ctx) => {
    return await safeEdit(ctx, "📩 <b>ARIZALAR</b>\n\nBu bo'lim foydalanuvchilarning murojaatlariga to'g'ridan-to'g'ri xabar kelganda javob berish uchundir.", {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});

bot.action("admin_broadcast", async (ctx) => {
    initSession(ctx); 
    ctx.session.step = 'await_broadcast_msg';
    return await safeEdit(ctx, "📢 Barcha foydalanuvchilarga tarqatmoqchi bo'lgan xabaringizni yuboring (Rasm, video yoki matn):", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Bekor qilish", "admin_panel")]]));
});

bot.action("confirm_broadcast", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID || !ctx.session.broadcastMsgId) return;
    await ctx.reply("📢 Tarqatish boshlandi... Iltimos, jarayon tugaguncha kuting.");
    
    const users = await User.find({}, 'userId');
    let success = 0, fail = 0;
    
    for (const u of users) {
        try {
            await ctx.telegram.copyMessage(u.userId, ctx.from.id, ctx.session.broadcastMsgId);
            success++;
        } catch(e) { fail++; }
    }
    return await ctx.reply(`✅ <b>REKLAMA TUGADI!</b>\n\nMuvaffaqiyatli yetib bordi: ${success} ta\nXato / Botni bloklaganlar: ${fail} ta`, { parse_mode: 'HTML' });
});

bot.action("admin_stats", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({isVerified: true});
        const today = new Date(); today.setHours(0,0,0,0);
        const todayUsers = await User.countDocuments({joinedAt: {$gte: today}});
        
        const statsMsg = `📊 <b>STATISTIKA</b>\n\n👥 Jami foydalanuvchilar: ${totalUsers} ta\n✅ Tasdiqlanganlar: ${verifiedUsers} ta\n🔄 Bugun qo'shilganlar: ${todayUsers} ta`;
        return await safeEdit(ctx, statsMsg, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]])});
    } catch(e) { console.error(e); }
});

// ==========================================
// 9. WEB APP XABARLARINI QABUL QILISH (O'zgarish 2)
// ==========================================
bot.on('web_app_data', async (ctx) => {
    try {
        const data = JSON.parse(ctx.message.web_app_data.data);
        if (data.type === 'support' || data.text) {
            const text = data.text || "Noma'lum xabar";
            await bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI MUROJAAT (Web App)</b>\n\nKimdan: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\n\n📝 Matn: ${text}`, {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✍️ Javob yozish", `reply_to_${ctx.from.id}`)]])
            });
            return await ctx.reply("✅ Murojaatingiz qabul qilindi. Tez orada ma'muriyat javob beradi.");
        }
    } catch (e) {
        console.error("Web App xabari xatosi:", e);
    }
});


// ==========================================
// 10. XABARLARNI QABUL QILISH (TEXT & VIDEO)
// ==========================================
bot.on('message', async (ctx) => {
    initSession(ctx);
    const step = ctx.session.step;
    if (!step) return;

    if (ctx.from.id === ADMIN_ID && step === 'await_broadcast_msg') {
        ctx.session.broadcastMsgId = ctx.message.message_id;
        return await ctx.reply(`Ushbu xabarni barchaga yuborishni tasdiqlaysizmi?`, Markup.inlineKeyboard([
            [Markup.button.callback("✅ HA (Barchaga yuborish)", "confirm_broadcast")],
            [Markup.button.callback("❌ BEKOR QILISH", "admin_panel")]
        ]));
    }

    if (ctx.from.id === ADMIN_ID && step === 'admin_guide_video' && ctx.message.video) {
        await Config.findOneAndUpdate({key: 'guide_video'}, {content: ctx.message.video.file_id}, {upsert: true, new: true});
        ctx.session.step = null;
        return await ctx.reply("✅ Qo'llanma videosi muvaffaqiyatli yuklandi!");
    }

    if (!ctx.message.text) return;
    const text = ctx.message.text.trim();

    try {
        if (ctx.from.id === ADMIN_ID) {
            if (step === 'admin_console_link') {
                await Config.findOneAndUpdate({key: 'webapp_url'}, {url: text}, {upsert: true, new: true});
                ctx.session.step = null; return await ctx.reply("✅ Web App havolasi yangilandi!");
            }
            if (step === 'admin_ref_bonus') {
                ctx.session.step = null; return await ctx.reply("✅ Bonus miqdori saqlandi!");
            }
            if (step === 'admin_wins_log') {
                await Config.findOneAndUpdate({key: 'wins_log'}, {content: text}, {upsert: true, new: true});
                ctx.session.step = null; return await ctx.reply("✅ Yutuqlar ro'yxati yangilandi!");
            }
            if (step === 'admin_guide_text') {
                await Config.findOneAndUpdate({key: 'guide'}, {content: text}, {upsert: true, new: true});
                ctx.session.step = null; return await ctx.reply("✅ Qo'llanma matni yangilandi!");
            }
            if (step === 'admin_wallet_min') {
                ctx.session.step = null; return await ctx.reply("✅ Minimal pul yechish summasi yangilandi!");
            }
            
            if (step === 'admin_add_channel') {
                const parts = text.split('|').map(p => p.trim());
                if (parts.length === 3) {
                    await Config.create({ key: 'channel', name: parts[0], url: parts[1], chatId: parts[2] });
                    ctx.session.step = null;
                    return await ctx.reply("✅ Majburiy kanal bazaga muvaffaqiyatli qo'shildi!");
                } else {
                    return await ctx.reply("❌ Format xato. Iltimos: `Nomi | https://t.me/link | ID` shaklida yozing.", {parse_mode: 'Markdown'});
                }
            }

            if (step === 'admin_add_app_name') {
                ctx.session.tempApp = { name: text };
                ctx.session.step = 'admin_add_app_url';
                return await ctx.reply("Platforma uchun ro'yxatdan o'tish ssilkasini yuboring (Masalan: https://1win.com):");
            }
            if (step === 'admin_add_app_url') {
                ctx.session.tempApp.url = text;
                ctx.session.step = 'admin_add_app_apk';
                return await ctx.reply("Platformaning APK yuklash ssilkasini yuboring (Agar yo'q bo'lsa, kanalingiz linkini bering):");
            }
            if (step === 'admin_add_app_apk') {
                await Config.create({ key: 'app', name: ctx.session.tempApp.name, url: ctx.session.tempApp.url, content: text });
                ctx.session.step = null;
                return await ctx.reply("✅ Yangi platforma muvaffaqiyatli qo'shildi!");
            }

            if (step.startsWith('reply_to_')) {
                const targetUserId = step.split('_')[2];
                await bot.telegram.sendMessage(targetUserId, `👨‍💻 <b>MA'MURIYATDAN JAVOB KELDI:</b>\n\n${text}`, { parse_mode: 'HTML' });
                ctx.session.step = null;
                return await ctx.reply("✅ Javobingiz foydalanuvchiga yuborildi.");
            }
        }

        if (step === 'await_id') {
            const platform = ctx.session.selectedApp || "Noma'lum platforma";
            await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text });
            
            await bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>YANGI ID TASDIQLASH SO'ROVI</b>\n\n👤 Foydalanuvchi: ${ctx.from.first_name}\n🎮 Platforma: <b>${platform}</b>\n🆔 O'yin ID: <code>${text}</code>`, {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✅ TASDIQLASH", `approve_${ctx.from.id}`)], [Markup.button.callback("❌ RAD ETISH", `reject_${ctx.from.id}`)]])
            });
            ctx.session.step = null;
            return await ctx.reply("⏳ Rahmat! So'rovingiz ma'muriyatga yuborildi. Iltimos, tasdiqlashlarini kuting.");
        } 
        
        if (step === 'support') {
            await bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI MUROJAAT</b>\n\nKimdan: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\n\n📝 Matn: ${text}`, {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✍️ Javob yozish", `reply_to_${ctx.from.id}`)]])
            });
            ctx.session.step = null;
            return await ctx.reply("✅ Murojaatingiz qabul qilindi. Tez orada javob beramiz.");
        }
        
        if (step === 'withdraw_card') {
            await bot.telegram.sendMessage(ADMIN_ID, `📥 <b>YANGI PUL YECHISH SO'ROVI</b>\n\nFoydalanuvchi: ${ctx.from.first_name} (ID: ${ctx.from.id})\nKarta raqami: <code>${text}</code>`, { parse_mode: 'HTML' });
            ctx.session.step = null;
            return await ctx.reply("✅ So'rovingiz adminga yuborildi! Tekshiruvdan so'ng hisobingizga o'tkazib beriladi.");
        }

    } catch (error) { console.error("Xabar qabul qilishda xatolik:", error); }
});

bot.action(/^reply_to_(\d+)$/, async (ctx) => {
    initSession(ctx); ctx.session.step = `reply_to_${ctx.match[1]}`;
    return await ctx.reply(`✍️ Foydalanuvchi uchun javob matnini yozing:`);
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    try {
        const userId = ctx.match[1];
        await User.findOneAndUpdate({ userId: userId }, { isVerified: true });
        
        const webappConfig = await Config.findOne({ key: 'webapp_url' });
        const consoleUrl = webappConfig ? webappConfig.url : (process.env.WEB_APP_URL || "https://kmamadaliyev05-hue.github.io/richi28");
        
        const userObj = await User.findOne({ userId: userId });
        const s = strings[userObj?.lang || 'uz'];
        const btnText = s.btn_console || "💻 KONSOLNI OCHISH";

        const msg = `✅ <b>Tabriklaymiz! Sizning ID raqamingiz tasdiqlandi!</b>\n\n⚠️ <i>Diqqat: Agar hack tizimini aldasangiz buni darhol sezadi va sizga yolg'on signal berishi mumkin (shartlarni to'liq bajarmagan bo'lsangiz).</i>\n\n👇 Quyidagi tugma orqali hack tizimiga (konsolga) kirishingiz mumkin:`;

        await bot.telegram.sendMessage(userId, msg, { 
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.webApp(btnText, consoleUrl)]
            ])
        });
        return await ctx.editMessageText("✅ Muvaffaqiyatli tasdiqlandi!");
    } catch (error) { console.error(error); }
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    try {
        await User.findOneAndUpdate({ userId: ctx.match[1] }, { gameId: "Rad etildi", isVerified: false });
        await bot.telegram.sendMessage(ctx.match[1], "❌ Kechirasiz, siz yuborgan ID raqam tasdiqlanmadi. Iltimos, shartlarni to'g'ri bajarganingizga ishonch hosil qilib qaytadan yuboring.", { parse_mode: 'HTML' });
        return await ctx.editMessageText("❌ Rad etildi!");
    } catch (error) { console.error(error); }
});

// EXPRESS SERVER
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK - RICHI28 BOT SERVER IS RUNNING'));
app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Server ishga tushdi (Port: ${PORT})`));

// BOTNI ISHGA TUSHIRISH
bot.launch().then(() => console.log('🚀 RICHI28 BOT MUVAZZAQIYATLI ISHGA TUSHDI')).catch(err => console.error(err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
