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
    isVerified: { type: Boolean, default: false }, // Admin ruxsati uchun
    gameId: { type: String, default: "Kiritilmagan" },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    notifications: { type: Boolean, default: true },
    requestedChannels: { type: [String], default: [] }, // Zayafka yuborgan kanallari ro'yxati
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
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli.",
        sub_req: "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling yoki a'zo bo'lish uchun ariza (zayafka) qoldiring:",
        verify_sub: "✅ Tasdiqlash",
        main_menu: "Asosiy menyu:",
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
    }
};

// ==========================================
// 4. KEYBOARD & SUBSCRIPTION CHECKER
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

// Obunani va Zayafkani tekshiruvchi qat'iy funksiya
const checkSubscription = async (ctx, user) => {
    if (ctx.from.id === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    
    for (const chan of channels) {
        try {
            // Agar foydalanuvchi zayafka yuborgan bo'lsa, obuna bo'lgan deb hisoblaymiz
            if (user && user.requestedChannels && user.requestedChannels.includes(chan.chatId)) {
                continue; 
            }
            // Aks holda obunani tekshiramiz
            const member = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) {
            return false;
        }
    }
    return true;
};

// ==========================================
// ZAYAFKA YUBORILGANDA AVTOMATIK MENYU BERISH
// ==========================================
bot.on('chat_join_request', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id.toString();
        
        let user = await User.findOne({ userId: userId });
        if (!user) {
            user = await User.create({ userId: userId, firstName: ctx.from.first_name });
        }

        // Zayafkani bazaga saqlaymiz
        user = await User.findOneAndUpdate(
            { userId: userId },
            { $addToSet: { requestedChannels: chatId } },
            { new: true }
        );

        // Ariza qabul qilinganini aytib, darhol menyuni yuboramiz!
        const lang = user.lang || "uz";
        const s = strings[lang] || strings.uz;
        
        await bot.telegram.sendMessage(
            userId, 
            `✅ <b>Arizangiz qabul qilindi!</b>\n\n${s.welcome}`, 
            { 
                parse_mode: 'HTML', 
                ...getMainMenu(lang, userId === ADMIN_ID) 
            }
        );
    } catch (error) { console.error("Zayafka xatosi:", error); }
});

// ==========================================
// 5. BOT FLOW & START
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

        return ctx.reply("🌐 Select Language / Tilni tanlang:", Markup.inlineKeyboard([
            [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")]
        ]));
    } catch (error) { console.error(error); }
});

bot.action(/^setlang_(.+)$/, async (ctx) => {
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

bot.action("check_sub", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (await checkSubscription(ctx, user)) {
            return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
        }
        return ctx.answerCbQuery("❌ Obuna bo'lmagansiz yoki arizangiz yuborilmagan!", { show_alert: true });
    } catch (error) { console.error(error); }
});

bot.action("home", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    } catch (error) { console.error(error); }
});

// ==========================================
// 6. SECTIONS & LOGIC
// ==========================================

// 1. KONSOL (WEB APP) - QAT'IY TASDIQLASH BILAN
bot.action("open_console", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        
        // Agar admin foydalanuvchini tasdiqlamagan bo'lsa
        if (!user.isVerified) {
            const alertText = `⚠️ <b>RUXSAT ETILMAGAN!</b>\n\n` +
                              `Web App (Konsol) dan foydalanish uchun quyidagi shartlarni bajarishingiz shart:\n\n` +
                              `1️⃣ <b>RICHI28</b> promokodi bilan platformada yangi ro'yxatdan o'tish.\n` +
                              `2️⃣ Hisobga <b>minimal depozit</b> tushirish.\n` +
                              `3️⃣ O'z ID raqamingizni bizga yuborib, admin orqali tasdiqlatish.\n\n` +
                              `👇 Iltimos, shartlarni bajarish uchun <b>"🚀 SIGNALLAR"</b> bo'limiga o'ting!`;

            return ctx.editMessageText(alertText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("🚀 SIGNALLAR (Platforma tanlash)", "menu_signals")],
                    [Markup.button.callback(s.back, "home")]
                ])
            });
        }
        
        // Agar admin ruxsat bergan bo'lsa
        return ctx.editMessageText("🟢 TERMINAL IS ACTIVE\n\nQuyidagi tugma orqali Web App konsolga ulanishingiz mumkin:", Markup.inlineKeyboard([
            [Markup.button.webApp("🚀 KONSOLNI OCHISH", process.env.WEB_APP_URL || "https://google.com")],
            [Markup.button.callback(s.back, "home")]
        ]));
    } catch (error) { console.error(error); }
});

// 2. SIGNALLAR VA PLATFORMALAR (ID YUBORISH)
bot.action("menu_signals", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const apps = await Config.find({ key: 'app' });
        const btns = [];
        
        apps.forEach(a => btns.push([Markup.button.callback(`🚀 ${a.name}`, `view_app_${a._id}`)]));
        if(apps.length === 0) {
            btns.push([Markup.button.callback("🎰 1XBET", "view_app_default_1xbet")]);
            btns.push([Markup.button.callback("🟢 LINEBET", "view_app_default_linebet")]);
        }
        btns.push([Markup.button.callback(s.back, "home")]);
        
        return ctx.editMessageText(s.signals_title, Markup.inlineKeyboard(btns));
    } catch (error) { console.error(error); }
});

bot.action(/^view_app_(.+)$/, async (ctx) => {
    try {
        initSession(ctx);
        const appId = ctx.match[1];
        let name = "Platforma";
        let regLink = "https://1xbet.com";
        let dlLink = "https://t.me/richi28_apk";

        if (appId === "default_1xbet") { name = "1XBET"; } 
        else if (appId === "default_linebet") { name = "LINEBET"; regLink = "https://linebet.com"; } 
        else {
            const appInfo = await Config.findById(appId);
            if (appInfo) {
                name = appInfo.name;
                regLink = appInfo.url || "https://1xbet.com";
                dlLink = appInfo.content || "https://t.me/richi28_apk";
            }
        }

        ctx.session.selectedApp = name;

        // PROMO KOD VA DEPOZIT HAQIDA QAT'IY XABAR
        const text = `🎰 <b>${name}</b> platformasi\n\n` +
                     `❗️ <b>DIQQAT! KONSOLDAN FOYDALANISH SHARTLARI:</b>\n\n` +
                     `1️⃣ Quyidagi link orqali kiring va <b>RICHI28</b> promokodini yozib ro'yxatdan o'ting!\n` +
                     `2️⃣ Hisobingiz ishlashi uchun minimal depozit (pul) kiriting.\n` +
                     `3️⃣ "🆔 ID TASDIQLASH" tugmasini bosib, yangi ID raqamingizni yuboring.\n\n` +
                     `<i>⚠️ Promokodsiz va depozitsiz ID raqamlar admin tomonidan qat'iyan RAD ETILADI!</i>`;

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
    return ctx.reply("📝 Platformadagi ID raqamingizni kiriting:\n\n❗️ Faqat 10 ta raqamdan iborat bo'lishi shart.\n\n(Bekor qilish uchun /start ni bosing)");
});

// QOLGAN MENYULAR
bot.action("menu_network", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        return ctx.editMessageText(s.ref_title(user.referrals, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_wallet", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        return ctx.editMessageText(s.wallet_title(user.balance), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💸 Puli Yechish", "withdraw_start")], [Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("withdraw_start", (ctx) => {
    initSession(ctx); ctx.session.step = 'withdraw_card'; return ctx.reply("💳 Karta raqamingizni kiriting:");
});

bot.action("menu_settings", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        return ctx.editMessageText(s.settings_title(user.userId, user.isVerified, user.notifications), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_guide", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const guide = await Config.findOne({ key: 'guide' });
        return ctx.editMessageText(`${s.guide_title}\n\n${guide ? guide.content : "Tez kunda..."}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

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
        return ctx.editMessageText(wins, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]) });
    } catch (error) { console.error(error); }
});

bot.action("menu_support", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        initSession(ctx); ctx.session.step = 'support';
        return ctx.editMessageText(strings[user.lang].support_msg, Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]]));
    } catch (error) { console.error(error); }
});

// ==========================================
// 7. TEXT HANDLERS (ID VA MA'LUMOT YUBORISH)
// ==========================================
bot.on('text', async (ctx) => {
    initSession(ctx);
    if (!ctx.session.step) return;

    try {
        // A. ID TASDIQLASH UCHUN ADMINGA YUBORISH
        if (ctx.session.step === 'await_id') {
            const inputId = ctx.message.text.trim();
            const idRegex = /^\d{10}$/; 

            if (!idRegex.test(inputId)) {
                return ctx.reply("❌ Xato! ID faqat 10 ta raqamdan iborat bo'lishi kerak va harf qatnashmasligi shart.\n\nNamuna: 1234567890\n\nQaytadan kiriting:");
            }

            const platform = ctx.session.selectedApp || "Noma'lum";
            await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: inputId });
            
            // Adminga tekshirish uchun barcha ma'lumot boradi
            const adminMsg = `🆔 <b>YANGI ID SO'ROVI</b>\n\n` +
                             `👤 Foydalanuvchi: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>\n` +
                             `🔑 User ID: <code>${ctx.from.id}</code>\n` +
                             `🎮 <b>Platforma: ${platform}</b>\n` +
                             `🆔 Game ID: <code>${inputId}</code>\n\n` +
                             `<i>⚠️ Diqqat: Bu ID RICHI28 promokodi va depozit bilan kiritilganligini tekshirib, keyin tasdiqlang!</i>`;

            bot.telegram.sendMessage(ADMIN_ID, adminMsg, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✅ TASDIQLASH (Web App ochiladi)", `approve_${ctx.from.id}`)],
                    [Markup.button.callback("❌ RAD ETISH (Bloklanadi)", `reject_${ctx.from.id}`)]
                ])
            });

            ctx.session.step = null;
            return ctx.reply(`⏳ Arizangiz ko'rib chiqish uchun adminga yuborildi!\n\nPlatforma: <b>${platform}</b>\nID: <b>${inputId}</b>\n\nAdmin sizning RICHI28 promokodi orqali ro'yxatdan o'tganingizni va hisobingizda depozit borligini tekshirgach ruxsat beradi. Iltimos, kuting...`, { parse_mode: 'HTML' });
        } 
        
        // B. SUPPORT
        if (ctx.session.step === 'support') {
            bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI ARIZA</b>\n\nKimdan: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\n\n📝 Xabar:\n${ctx.message.text}`, {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("✍️ Javob yozish", `reply_to_${ctx.from.id}`)]])
            });
            ctx.session.step = null;
            return ctx.reply("✅ Arizangiz adminga yuborildi.");
        }

        // C. ADMIN JAVOBI
        if (ctx.session.step.startsWith('reply_to_')) {
            const targetUserId = ctx.session.step.split('_')[2];
            bot.telegram.sendMessage(targetUserId, `👨‍💻 <b>ADMINDAN JAVOB KELDI:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
            ctx.session.step = null;
            return ctx.reply("✅ Javobingiz foydalanuvchiga muvaffaqiyatli yetkazildi.");
        }

        // D. KARTA
        if (ctx.session.step === 'withdraw_card') {
            ctx.reply("💰 Summani kiriting:");
            ctx.session.step = 'withdraw_amount';
        }

    } catch (error) { console.error(error); }
});

// ==========================================
// ADMIN CALLBACKS (ID TASDIQLASH / RAD ETISH)
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
        // Tasdiqlanganda isVerified = true bo'ladi va KONSOL ochiladi
        await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
        
        bot.telegram.sendMessage(targetId, "✅ <b>TABRIKLAYMIZ!</b>\n\nSizning ID raqamingiz muvaffaqiyatli tasdiqlandi. Endi Asosiy menyudan KONSOL (Web App) ni to'liq ishlatishingiz mumkin.", { parse_mode: 'HTML' });
        
        return ctx.editMessageText("✅ Foydalanuvchi tasdiqlandi va unga ruxsat berildi!");
    } catch (error) { console.error(error); }
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    try {
        const targetId = ctx.match[1];
        // Rad etilganda ruxsat bekor qilinadi
        await User.findOneAndUpdate({ userId: targetId }, { gameId: "Rad etilgan", isVerified: false });
        
        bot.telegram.sendMessage(targetId, "❌ <b>ID RAD ETILDI!</b>\n\nKechirasiz, sizning ID raqamingiz tasdiqlanmadi. Bunga sabab quyidagilardan biri bo'lishi mumkin:\n\n1. Siz RICHI28 promokodi bilan ro'yxatdan o'tmagansiz.\n2. Hisobingizga hali minimal depozit kiritilmagan.\n\nIltimos, shartlarni to'liq bajarib, yana qaytadan ID yuboring.", { parse_mode: 'HTML' });
        
        return ctx.editMessageText("❌ Foydalanuvchi arizasi rad etildi!");
    } catch (error) { console.error(error); }
});

// ==========================================
// EXPRESS SERVER (KEEP ALIVE)
// ==========================================
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK - RICHI28 BOT IS RUNNING'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server is running on port: ${PORT}`));

bot.launch().then(() => console.log('🚀 RICHI28 BOT STARTED SUCCESSFULLY'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
