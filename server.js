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
    key: String, // webapp_url, ref_bonus, min_withdraw, guide_text, win_logs
    valueString: String,
    valueNumber: Number,
    // channel va app uchun:
    name: String,
    url: String,
    chatId: String,
    content: String 
});

const WithdrawSchema = new mongoose.Schema({
    userId: Number,
    amount: Number,
    card: String,
    status: { type: String, default: "pending" }, // pending, paid, rejected
    date: { type: Date, default: Date.now }
});

const SupportSchema = new mongoose.Schema({
    userId: Number,
    message: String,
    status: { type: String, default: "pending" }
});

const User = mongoose.model('User', UserSchema);
const Config = mongoose.model('Config', ConfigSchema);
const Withdraw = mongoose.model('Withdraw', WithdrawSchema);
const Support = mongoose.model('Support', SupportSchema);

// ==========================================
// 2. BOT INITIALIZATION & DEFAULTS
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

const initSession = (ctx) => { if (!ctx.session) ctx.session = {}; };

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('🛡️ DATABASE CONNECTED');
        // Standart sozlamalarni yaratish (agar yo'q bo'lsa)
        const checkAndCreate = async (k, str, num) => {
            if (!(await Config.findOne({ key: k }))) await Config.create({ key: k, valueString: str, valueNumber: num });
        };
        await checkAndCreate('webapp_url', 'https://google.com', null);
        await checkAndCreate('ref_bonus', null, 5000);
        await checkAndCreate('min_withdraw', null, 50000);
        await checkAndCreate('guide_text', "Tez orada kiritiladi.", null);
        await checkAndCreate('win_logs', "✅ ID: 1245** | +5,400,000 UZS\n✅ ID: 8932** | +1,200,000 UZS", null);
        await checkAndCreate('auth_type', 'verified', null); // verified yoki all
    })
    .catch(err => console.error('❌ DB Error:', err));

// ==========================================
// 3. I18N STRINGS
// ==========================================
const strings = {
    uz: {
        lang_select: "🌐 Tilni tanlang:", welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nTizimga xush kelibsiz, Agent!",
        sub_req: "🔐 Botdan foydalanish uchun kanallarga obuna bo'ling:", verify_sub: "✅ Tasdiqlash",
        signals_title: "🚀 Platformani tanlang va ID yuboring:", wallet_title: (bal, min) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\nKamida ${min.toLocaleString()} UZS bo'lganda yechish mumkin.`,
        ref_title: (count, link, bonus) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta\n\n🎁 Har bir do'st uchun: ${bonus.toLocaleString()} UZS`,
        settings_menu: "⚙️ <b>SOZLAMALAR</b>", profile_title: (id, status) => `👤 <b>PROFILIM</b>\n\n🆔 ID: ${id}\n✅ Status: ${status ? 'Tasdiqlangan' : 'Ruxsat yo\'q'}`,
        guide_title: "📚 <b>FOYDALANISH QO'LLANMASI</b>", wins_title: "🏆 <b>SO'NGGI YUTUQLAR LOGI:</b>",
        support_msg: "👨‍💻 Muammoingizni yozing:", unverified_alert: "⚠️ <b>RUXSAT ETILMAGAN!</b>\n1️⃣ Ro'yxatdan o'ting.\n2️⃣ ID tasdiqlating.",
        platform_info: (name) => `🎰 <b>${name}</b>\n1️⃣ Ro'yxatdan o'ting.\n2️⃣ Depozit qiling.\n3️⃣ ID tasdiqlating.`,
        btn_console: "💻 KONSOLNI OCHISH", btn_signals: "🚀 SIGNALLAR", btn_network: "👥 TARMOQ", btn_wins: "🏆 YUTUQLAR", btn_guide: "📚 QO'LLANMA", btn_wallet: "💰 HAMYON", btn_settings: "🛠 SOZLAMALAR", btn_support: "👨‍💻 ALOQA", btn_verify_id: "🆔 ID TASDIQLASH", back: "⬅️ Ortga"
    },
    ru: { /* huddi shunday ruscha matnlar */
        lang_select: "🌐 Выберите язык:", welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nДобро пожаловать!", sub_req: "🔐 Подпишитесь на каналы:", verify_sub: "✅ Подтвердить", signals_title: "🚀 Выберите платформу:", wallet_title: (bal, min) => `💰 Баланс: ${bal} UZS\nМин. вывод: ${min} UZS`, ref_title: (c, l, b) => `👥 Сеть\nСсылка: ${l}\nПриглашено: ${c}\nБонус: ${b} UZS`, settings_menu: "⚙️ Настройки", profile_title: (id, s) => `👤 Профиль\nID: ${id}\nСтатус: ${s ? 'Ок' : 'Нет'}`, guide_title: "📚 Инструкция", wins_title: "🏆 Выигрыши:", support_msg: "👨‍💻 Напишите проблему:", unverified_alert: "⚠️ ДОСТУП ЗАКРЫТ", platform_info: (n) => `🎰 ${n}`, btn_console: "💻 КОНСОЛЬ", btn_signals: "🚀 СИГНАЛЫ", btn_network: "👥 СЕТЬ", btn_wins: "🏆 ВЫИГРЫШИ", btn_guide: "📚 ИНСТРУКЦИЯ", btn_wallet: "💰 КОШЕЛЕК", btn_settings: "🛠 НАСТРОЙКИ", btn_support: "👨‍💻 ПОДДЕРЖКА", btn_verify_id: "🆔 ПОДТВЕРДИТЬ", back: "⬅️ Назад"
    },
    en: { /* inglizcha */
        lang_select: "🌐 Select language:", welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nWelcome!", sub_req: "🔐 Subscribe channels:", verify_sub: "✅ Verify", signals_title: "🚀 Select platform:", wallet_title: (bal, min) => `💰 Balance: ${bal} UZS\nMin withdraw: ${min} UZS`, ref_title: (c, l, b) => `👥 Network\nLink: ${l}\nInvited: ${c}\nBonus: ${b} UZS`, settings_menu: "⚙️ Settings", profile_title: (id, s) => `👤 Profile\nID: ${id}\nStatus: ${s ? 'Ok' : 'No'}`, guide_title: "📚 Guide", wins_title: "🏆 Wins:", support_msg: "👨‍💻 Write issue:", unverified_alert: "⚠️ ACCESS DENIED", platform_info: (n) => `🎰 ${n}`, btn_console: "💻 CONSOLE", btn_signals: "🚀 SIGNALS", btn_network: "👥 NETWORK", btn_wins: "🏆 WINS", btn_guide: "📚 GUIDE", btn_wallet: "💰 WALLET", btn_settings: "🛠 SETTINGS", btn_support: "👨‍💻 SUPPORT", btn_verify_id: "🆔 VERIFY", back: "⬅️ Back"
    }
};

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

// ==========================================
// 4. USER BOT FLOW
// ==========================================
bot.start(async (ctx) => {
    try {
        const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
        let user = await User.findOne({ userId: ctx.from.id });

        if (!user) {
            user = await User.create({ userId: ctx.from.id, firstName: ctx.from.first_name, invitedBy: refId });
            if (refId && refId !== ctx.from.id) {
                const bonus = await Config.findOne({ key: 'ref_bonus' });
                await User.findOneAndUpdate({ userId: refId }, { $inc: { balance: bonus.valueNumber || 5000, referrals: 1 } });
            }
            return ctx.reply("🌐 Tilni tanlang / Выберите язык / Select language:", Markup.inlineKeyboard([
                [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")], [Markup.button.callback("🇷🇺 Русский", "setlang_ru")], [Markup.button.callback("🇬🇧 English", "setlang_en")]
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
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await checkSubscription(ctx, user))) {
        const chans = await Config.find({ key: 'channel' });
        const buttons = chans.map(c => [Markup.button.url(c.name, c.url)]);
        buttons.push([Markup.button.callback(strings[lang].verify_sub, "check_sub")]);
        return ctx.editMessageText(strings[lang].sub_req, Markup.inlineKeyboard(buttons));
    }
    return ctx.editMessageText(strings[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
});

bot.action("check_sub", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return ctx.answerCbQuery("Botni yangilang: /start", { show_alert: true });
    if (await checkSubscription(ctx, user)) return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    return ctx.answerCbQuery("❌ Ruxsat yo'q!", { show_alert: true });
});

bot.action("home", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if(!user) return;
    initSession(ctx); ctx.session.step = null;
    return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

// USER SECTIONS
bot.action("open_console", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    const authType = await Config.findOne({ key: 'auth_type' });
    const appUrl = await Config.findOne({ key: 'webapp_url' });

    if (authType.valueString === 'verified' && !user.isVerified) {
        return ctx.editMessageText(s.unverified_alert, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.btn_signals, "menu_signals")], [Markup.button.callback(s.back, "home")]])});
    }
    return ctx.editMessageText("🟢 TERMINAL IS ACTIVE", Markup.inlineKeyboard([[Markup.button.webApp(s.btn_console, appUrl.valueString)], [Markup.button.callback(s.back, "home")]]));
});

bot.action("menu_signals", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(`🚀 ${a.name}`, `app_${a._id}`)]);
    if(apps.length === 0) { btns.push([Markup.button.callback("🎰 1XBET", "app_1xbet")], [Markup.button.callback("🟢 LINEBET", "app_linebet")]); }
    btns.push([Markup.button.callback(s.back, "home")]);
    return ctx.editMessageText(s.signals_title, Markup.inlineKeyboard(btns));
});

bot.action(/^app_(.+)$/, async (ctx) => {
    initSession(ctx);
    const user = await User.findOne({ userId: ctx.from.id });
    const s = strings[user.lang];
    const appId = ctx.match[1];
    let name = "Platforma", regLink = "https://1xbet.com", dlLink = "https://t.me/richi28_apk";

    if (appId === "1xbet") { name = "1XBET"; } else if (appId === "linebet") { name = "LINEBET"; regLink = "https://linebet.com"; } else {
        if (mongoose.Types.ObjectId.isValid(appId)) {
            const appInfo = await Config.findById(appId);
            if (appInfo) { name = appInfo.name; regLink = appInfo.url; dlLink = appInfo.content; }
        }
    }
    ctx.session.selectedApp = name;
    return ctx.editMessageText(s.platform_info(name), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.url("🔗 Reg", regLink), Markup.button.url("📥 APK", dlLink)], [Markup.button.callback(s.btn_verify_id, "verify_id_start")], [Markup.button.callback(s.back, "menu_signals")]])});
});

bot.action("verify_id_start", (ctx) => { initSession(ctx); ctx.session.step = 'await_id'; return ctx.reply("📝 ID Yuboring:"); });

bot.action("menu_network", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const bonus = await Config.findOne({ key: 'ref_bonus' });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    return ctx.editMessageText(strings[user.lang].ref_title(user.referrals, link, bonus.valueNumber), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]) });
});

bot.action("menu_wallet", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const minW = await Config.findOne({ key: 'min_withdraw' });
    return ctx.editMessageText(strings[user.lang].wallet_title(user.balance, minW.valueNumber), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💸 Withdraw", "withdraw_start")], [Markup.button.callback(strings[user.lang].back, "home")]]) });
});

bot.action("withdraw_start", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const minW = await Config.findOne({ key: 'min_withdraw' });
    if(user.balance < minW.valueNumber) return ctx.answerCbQuery("❌ Balans yetarli emas!", { show_alert: true });
    initSession(ctx); ctx.session.step = 'withdraw_card'; return ctx.reply("💳 Karta raqamingizni yuboring:"); 
});

bot.action("menu_guide", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const guide = await Config.findOne({ key: 'guide_text' });
    return ctx.editMessageText(`${strings[user.lang].guide_title}\n\n${guide.valueString}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]) });
});

bot.action("menu_wins", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const logs = await Config.findOne({ key: 'win_logs' });
    return ctx.editMessageText(`${strings[user.lang].wins_title}\n\n${logs.valueString}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]) });
});

bot.action("menu_support", async (ctx) => {
    initSession(ctx); ctx.session.step = 'support';
    const user = await User.findOne({ userId: ctx.from.id });
    return ctx.editMessageText(strings[user.lang].support_msg, Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]));
});

bot.action("menu_settings", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    return ctx.editMessageText(strings[user.lang].settings_menu, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔄 Tilni o'zgartirish", "settings_lang")], [Markup.button.callback(strings[user.lang].back, "home")]]) });
});

// ==========================================
// 5. ADMIN PANEL LOGIC (YANGI QO'SHILGAN)
// ==========================================
const isAdmin = (ctx, next) => { if (ctx.from.id === ADMIN_ID) return next(); };

const getAdminPanel = async () => {
    const reqs = await Support.countDocuments({ status: "pending" });
    const msg = `┌─────────────────────────────────────────┐\n│      ⚙️ ADMIN MASTER CONTROL     │\n└─────────────────────────────────────────┘`;
    const kb = Markup.inlineKeyboard([
        [Markup.button.callback("🖥 KONSOL EDIT", "ad_console"), Markup.button.callback("🚀 SIGNALS EDIT", "ad_signals")],
        [Markup.button.callback("👥 TARMOQ", "ad_network"), Markup.button.callback("🏆 YUTUQLAR", "ad_wins")],
        [Markup.button.callback("📚 QO'LLANMA", "ad_guide"), Markup.button.callback("💰 HAMYON", "ad_wallet")],
        [Markup.button.callback(`📩 ARIZALAR (${reqs})`, "ad_support"), Markup.button.callback("🛠 SOZLAMALAR", "ad_settings")],
        [Markup.button.callback("📢 REKLAMA", "ad_broadcast"), Markup.button.callback("📊 STATISTIKA", "ad_stats")],
        [Markup.button.callback("⬅️ ASOSIY MENYUGA QAYTISH", "home")]
    ]);
    return { msg, kb };
};

bot.action("admin_panel", isAdmin, async (ctx) => {
    initSession(ctx); ctx.session.step = null;
    const panel = await getAdminPanel();
    return ctx.editMessageText(panel.msg, panel.kb);
});

// 1. KONSOL EDIT
bot.action("ad_console", isAdmin, async (ctx) => {
    const auth = await Config.findOne({ key: 'auth_type' });
    const url = await Config.findOne({ key: 'webapp_url' });
    return ctx.editMessageText(`🖥 <b>KONSOL SOZLAMALARI</b>\n\n🔗 Hozirgi link: ${url.valueString}\n🔑 Kirish: ${auth.valueString === 'verified' ? 'Faqat Tasdiqlanganlar' : 'Hamma uchun'}`, {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔗 Linkni o'zgartirish", "ad_console_link")], [Markup.button.callback("🔑 Kirish turini o'zgartirish", "ad_console_auth")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});
bot.action("ad_console_link", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_set_url'; return ctx.reply("Yangi WebApp havolasini yuboring (https bilan):"); });
bot.action("ad_console_auth", isAdmin, async (ctx) => {
    const auth = await Config.findOne({ key: 'auth_type' });
    auth.valueString = auth.valueString === 'verified' ? 'all' : 'verified'; await auth.save();
    return ctx.answerCbQuery("✅ Holat o'zgardi!", {show_alert:true});
});

// 2. SIGNALS EDIT
bot.action("ad_signals", isAdmin, async (ctx) => {
    return ctx.editMessageText(`🚀 <b>SIGNALLAR (PLATFORMALAR)</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("➕ Yangi Ilova qo'shish", "ad_sig_add")], [Markup.button.callback("🗑 Ilovalarni tozalash", "ad_sig_clear")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]]) });
});
bot.action("ad_sig_add", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_add_app_name'; return ctx.reply("Yangi ilova nomini yozing (Masalan: PinUp):"); });
bot.action("ad_sig_clear", isAdmin, async (ctx) => { await Config.deleteMany({ key: 'app' }); return ctx.answerCbQuery("O'chirildi!"); });

// 3. TARMOQ (Referal)
bot.action("ad_network", isAdmin, async (ctx) => {
    const bonus = await Config.findOne({ key: 'ref_bonus' });
    return ctx.editMessageText(`👥 <b>TARMOQ SOZLAMALARI</b>\n\n💵 Hozirgi bonus narxi: ${bonus.valueNumber} UZS`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💵 Bonus summasini o'zgartirish", "ad_net_bonus")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]]) });
});
bot.action("ad_net_bonus", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_set_bonus'; return ctx.reply("Yangi summa miqdorini raqamda yozing:"); });

// 4. YUTUQLAR (Logs)
bot.action("ad_wins", isAdmin, async (ctx) => {
    return ctx.editMessageText(`🏆 <b>YUTUQLAR LOGI</b>\nShu yerdan foydalanuvchilarga ko'rinadigan soxta yutuqlar ro'yxatini tahrirlashingiz mumkin.`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✍️ Log yozish", "ad_win_log")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]]) });
});
bot.action("ad_win_log", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_set_win'; return ctx.reply("Yangi log matnini to'liq yuboring:\n(Masalan: ID 12** | 5,000 UZS)"); });

// 5. QO'LLANMA
bot.action("ad_guide", isAdmin, async (ctx) => {
    return ctx.editMessageText(`📚 <b>QO'LLANMA SOZLAMALARI</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("📝 Matnni tahrirlash", "ad_guide_text")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]]) });
});
bot.action("ad_guide_text", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_set_guide'; return ctx.reply("Yangi qo'llanma matnini yuboring:"); });

// 6. HAMYON (Zayavkalar va Limit)
bot.action("ad_wallet", isAdmin, async (ctx) => {
    const minW = await Config.findOne({ key: 'min_withdraw' });
    const p = await Withdraw.countDocuments({ status: "pending" });
    return ctx.editMessageText(`💰 <b>HAMYON SOZLAMALARI</b>\n\n💳 Minimal yechish: ${minW.valueNumber} UZS\n📥 Kutilayotgan so'rovlar: ${p} ta`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("📥 To'lov so'rovlarini ko'rish", "ad_wal_req")], [Markup.button.callback("💳 Minimal summani o'zgartirish", "ad_wal_min")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]]) });
});
bot.action("ad_wal_min", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_set_minw'; return ctx.reply("Yangi limitni raqamda yuboring:"); });
bot.action("ad_wal_req", isAdmin, async (ctx) => {
    const reqs = await Withdraw.find({ status: "pending" }).limit(5);
    if(reqs.length === 0) return ctx.answerCbQuery("So'rovlar yo'q!");
    for (const r of reqs) {
        await ctx.reply(`💳 So'rov!\nID: ${r.userId}\nSumma: ${r.amount}\nKarta: ${r.card}`, Markup.inlineKeyboard([[Markup.button.callback("✅ To'landi", `w_paid_${r._id}`)], [Markup.button.callback("❌ Bekor qilish", `w_rej_${r._id}`)]]));
    }
});
bot.action(/^w_paid_(.+)$/, isAdmin, async (ctx) => {
    const w = await Withdraw.findByIdAndUpdate(ctx.match[1], { status: "paid" });
    await bot.telegram.sendMessage(w.userId, `✅ ${w.amount} UZS to'lov kartangizga tushirildi!`);
    return ctx.editMessageText("✅ To'landi qilib belgilandi.");
});
bot.action(/^w_rej_(.+)$/, isAdmin, async (ctx) => {
    const w = await Withdraw.findByIdAndUpdate(ctx.match[1], { status: "rejected" });
    await User.findOneAndUpdate({ userId: w.userId }, { $inc: { balance: w.amount } });
    await bot.telegram.sendMessage(w.userId, `❌ To'lov rad etildi. Pullar balansingizga qaytarildi.`);
    return ctx.editMessageText("❌ Rad etildi.");
});

// 7. SOZLAMALAR (Kanallar)
bot.action("ad_settings", isAdmin, async (ctx) => {
    return ctx.editMessageText(`🛠 <b>UMUMIY SOZLAMALAR</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("📢 Majburiy kanal qo'shish", "ad_chan_add")], [Markup.button.callback("🗑 Kanallarni tozalash", "ad_chan_clear")], [Markup.button.callback("⬅️ Ortga", "admin_panel")]]) });
});
bot.action("ad_chan_add", isAdmin, (ctx) => { initSession(ctx); ctx.session.step = 'ad_add_chan_id'; return ctx.reply("Kanal ID sini yuboring (Masalan: -10012345678):"); });
bot.action("ad_chan_clear", isAdmin, async (ctx) => { await Config.deleteMany({ key: 'channel' }); return ctx.answerCbQuery("O'chirildi!"); });

// 8. ARIZALAR (Support)
bot.action("ad_support", isAdmin, async (ctx) => {
    const reqs = await Support.find({ status: "pending" }).limit(5);
    if(reqs.length === 0) return ctx.answerCbQuery("Arizalar yo'q!");
    for (const r of reqs) {
        await ctx.reply(`📩 ARIZA!\nID: ${r.userId}\nMatn: ${r.message}`, Markup.inlineKeyboard([[Markup.button.callback("✍️ Javob yozish", `s_reply_${r.userId}_${r._id}`)]]));
    }
});
bot.action(/^s_reply_(\d+)_(.+)$/, isAdmin, async (ctx) => {
    initSession(ctx); ctx.session.step = `s_reply_${ctx.match[1]}_${ctx.match[2]}`;
    return ctx.reply("Javob matnini yuboring:");
});

// 9. REKLAMA (Broadcast)
bot.action("ad_broadcast", isAdmin, (ctx) => {
    initSession(ctx); ctx.session.step = 'ad_broad_wait';
    return ctx.reply("📢 Reklama postini yuboring (Matn, rasm yoki video):");
});
bot.action("ad_broad_confirm", isAdmin, async (ctx) => {
    const msgId = ctx.session.broadcastMsgId;
    const fromId = ctx.session.broadcastFrom;
    ctx.session.step = null;
    ctx.editMessageText("⏳ Tarqatish boshlandi...");
    const users = await User.find();
    let sent = 0;
    for (const u of users) {
        try { await bot.telegram.copyMessage(u.userId, fromId, msgId); sent++; } catch(e){}
    }
    return ctx.reply(`✅ Reklama ${sent} ta odamga yetkazildi.`);
});

// 10. STATISTIKA
bot.action("ad_stats", isAdmin, async (ctx) => {
    const tot = await User.countDocuments();
    const ver = await User.countDocuments({ isVerified: true });
    let t = new Date(); t.setHours(0,0,0,0);
    const tod = await User.countDocuments({ joinedAt: { $gte: t } });
    const wData = await Withdraw.aggregate([{ $match: { status: "paid" } }, { $group: { _id: null, sum: { $sum: "$amount" } } }]);
    const wSum = wData.length ? wData[0].sum : 0;
    
    return ctx.editMessageText(`📊 <b>TIZIM STATISTIKASI</b>\n\n👥 Jami userlar: ${tot}\n✅ Tasdiqlanganlar: ${ver}\n🔄 Bugun kelganlar: ${tod}\n💰 Jami yechilgan summalar: ${wSum.toLocaleString()} UZS`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]])});
});

// Tasdiqlash tugmalari (KONSOL)
bot.action(/^approve_(\d+)$/, isAdmin, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "✅ ID tasdiqlandi! KONSOL ochildi."); return ctx.editMessageText("✅ Tasdiqlandi!");
});
bot.action(/^reject_(\d+)$/, isAdmin, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { gameId: "Rad etildi", isVerified: false });
    bot.telegram.sendMessage(ctx.match[1], "❌ ID rad etildi."); return ctx.editMessageText("❌ Rad etildi!");
});


// ==========================================
// 6. TEXT / MEDIA MESSAGE HANDLER (CORE ROUTING)
// ==========================================
bot.on('message', async (ctx) => {
    initSession(ctx);
    if (!ctx.session.step) return;
    const txt = ctx.message.text ? ctx.message.text.trim() : "";

    // 1. REKLAMA KUTISH (Barcha formatlarni qo'llab-quvvatlash uchun)
    if (ctx.session.step === 'ad_broad_wait') {
        ctx.session.broadcastMsgId = ctx.message.message_id;
        ctx.session.broadcastFrom = ctx.chat.id;
        const count = await User.countDocuments();
        return ctx.reply(`${count} kishiga yuborishni tasdiqlaysizmi?`, Markup.inlineKeyboard([[Markup.button.callback("✅ HA", "ad_broad_confirm"), Markup.button.callback("❌ BEKOR QILISH", "admin_panel")]]));
    }

    // Bundan keyingi logikalar faqat MATN talab qiladi
    if (!ctx.message.text) return;

    // USER LOGICS
    if (ctx.session.step === 'await_id') {
        if (!/^\d{8,15}$/.test(txt)) return ctx.reply("❌ Xato! ID faqat raqamlardan iborat bo'lishi kerak.");
        const appName = ctx.session.selectedApp || "Noma'lum";
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: txt });
        bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>YANGI ID SO'ROVI</b>\n👤 ${ctx.from.first_name}\n🎮 ${appName}\n🆔 ID: <code>${txt}</code>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✅ TASDIQLASH", `approve_${ctx.from.id}`)], [Markup.button.callback("❌ RAD ETISH", `reject_${ctx.from.id}`)]]) });
        ctx.session.step = null; return ctx.reply("⏳ Adminga yuborildi.");
    }
    
    if (ctx.session.step === 'withdraw_card') {
        ctx.session.w_card = txt; ctx.session.step = 'withdraw_sum'; return ctx.reply("Summani kiriting (Faqat raqam):");
    }
    if (ctx.session.step === 'withdraw_sum') {
        const amt = parseInt(txt); const user = await User.findOne({ userId: ctx.from.id });
        const minW = await Config.findOne({ key: 'min_withdraw' });
        if(isNaN(amt) || amt < minW.valueNumber || amt > user.balance) return ctx.reply("❌ Xato summa yoki balans yetarli emas!");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { $inc: { balance: -amt } });
        await Withdraw.create({ userId: ctx.from.id, amount: amt, card: ctx.session.w_card });
        ctx.session.step = null; return ctx.reply("✅ So'rov adminga yuborildi!");
    }

    if (ctx.session.step === 'support') {
        await Support.create({ userId: ctx.from.id, message: txt });
        ctx.session.step = null; return ctx.reply("✅ Yuborildi.");
    }

    // ADMIN LOGICS
    if (ctx.from.id !== ADMIN_ID) return;

    if (ctx.session.step === 'ad_set_url') {
        await Config.findOneAndUpdate({ key: 'webapp_url' }, { valueString: txt });
        ctx.session.step = null; return ctx.reply("✅ Saqlandi!");
    }
    if (ctx.session.step === 'ad_set_bonus') {
        await Config.findOneAndUpdate({ key: 'ref_bonus' }, { valueNumber: parseInt(txt) || 5000 });
        ctx.session.step = null; return ctx.reply("✅ Saqlandi!");
    }
    if (ctx.session.step === 'ad_set_minw') {
        await Config.findOneAndUpdate({ key: 'min_withdraw' }, { valueNumber: parseInt(txt) || 50000 });
        ctx.session.step = null; return ctx.reply("✅ Saqlandi!");
    }
    if (ctx.session.step === 'ad_set_guide') {
        await Config.findOneAndUpdate({ key: 'guide_text' }, { valueString: txt });
        ctx.session.step = null; return ctx.reply("✅ Saqlandi!");
    }
    if (ctx.session.step === 'ad_set_win') {
        await Config.findOneAndUpdate({ key: 'win_logs' }, { valueString: txt });
        ctx.session.step = null; return ctx.reply("✅ Saqlandi!");
    }

    // Add App
    if (ctx.session.step === 'ad_add_app_name') {
        ctx.session.app_name = txt; ctx.session.step = 'ad_add_app_url'; return ctx.reply("Endi ro'yxatdan o'tish linkini yuboring:");
    }
    if (ctx.session.step === 'ad_add_app_url') {
        ctx.session.app_url = txt; ctx.session.step = 'ad_add_app_apk'; return ctx.reply("Endi APK yuklab olish linkini yuboring:");
    }
    if (ctx.session.step === 'ad_add_app_apk') {
        await Config.create({ key: 'app', name: ctx.session.app_name, url: ctx.session.app_url, content: txt });
        ctx.session.step = null; return ctx.reply("✅ Ilova qo'shildi!");
    }

    // Add Channel
    if (ctx.session.step === 'ad_add_chan_id') {
        ctx.session.chan_id = txt; ctx.session.step = 'ad_add_chan_url'; return ctx.reply("Kanal invite linkini yuboring:");
    }
    if (ctx.session.step === 'ad_add_chan_url') {
        ctx.session.chan_url = txt; ctx.session.step = 'ad_add_chan_name'; return ctx.reply("Kanal nomini yuboring:");
    }
    if (ctx.session.step === 'ad_add_chan_name') {
        await Config.create({ key: 'channel', chatId: ctx.session.chan_id, url: ctx.session.chan_url, name: txt });
        ctx.session.step = null; return ctx.reply("✅ Kanal qo'shildi!");
    }

    if (ctx.session.step.startsWith('s_reply_')) {
        const parts = ctx.session.step.split('_');
        const targetId = parts[2]; const docId = parts[3];
        await bot.telegram.sendMessage(targetId, `👨‍💻 <b>ADMINDAN JAVOB:</b>\n\n${txt}`, { parse_mode: 'HTML' });
        await Support.findByIdAndUpdate(docId, { status: "answered" });
        ctx.session.step = null; return ctx.reply("✅ Javob yuborildi.");
    }
});

// EXPRESS SERVER
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK - RICHI28 BOT IS RUNNING'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port: ${PORT}`));

bot.launch().then(() => console.log('🚀 RICHI28 BOT STARTED SUCCESSFULLY'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
