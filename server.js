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
    ru: { /* RUS TILI STRINGS SHU YERDA BO'LADI (Joy tejash uchun o'zbekchaga o'xshash qoldirildi) */ },
    en: { /* INGLIZ TILI STRINGS SHU YERDA BO'LADI */ }
};

// Zaxira uchun tarjimalarni hammasini default UZ qilib qo'yamiz (Kodingiz xatosiz ishlashi uchun)
strings.ru = strings.uz; 
strings.en = strings.uz;

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
        [Markup.button.callback("📩 ARIZALAR", "admin_support"), Markup.button.callback("📢 KANALLAR", "admin_channels")], // <-- KANALLARGA O'ZGARTIRILDI
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

bot.action(/^setlang_(uz|ru|en)$/, async (ctx) => { /* Til mantiqi... oldingidek qoldi */ 
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
        // Try-catch bilan o'raldi, chunki Video xabardan keyin editMessageText ishlamaydi
        try {
            await ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
        } catch(e) {
            await ctx.deleteMessage().catch(()=>{});
            await ctx.reply(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
        }
    } catch (error) { console.error(error); }
});

// ==========================================
// 6. SECTIONS & LOGIC
// ==========================================
// (open_console, menu_signals, menu_settings, va h.k oldingidek)
bot.action("open_console", async (ctx) => { /* oldingidek qoldi... */ });
bot.action("menu_signals", async (ctx) => { /* oldingidek qoldi... */ });

bot.action("menu_guide", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        if (!user) return;
        const s = strings[user.lang];
        const guide = await Config.findOne({ key: 'guide' });
        const kb = Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]]);

        // QO'SHILDI: Video qo'llab-quvvatlash
        if (guide && guide.url) { 
            await ctx.deleteMessage().catch(()=>{});
            return ctx.replyWithVideo(guide.url, { caption: `${s.guide_title}\n\n${guide.content}`, parse_mode: 'HTML', ...kb });
        } else {
            return ctx.editMessageText(`${s.guide_title}\n\n${guide ? guide.content : "Tez orada kiritiladi."}`, { parse_mode: 'HTML', ...kb });
        }
    } catch (error) { console.error(error); }
});

// ==========================================
// 8. ADMIN PANEL ACTIONS
// ==========================================
bot.action("admin_panel", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery("Siz admin emassiz!", { show_alert: true });
    initSession(ctx); ctx.session.step = null;
    return ctx.editMessageText("👑 <b>ADMIN MASTER CONTROL</b>\n\nQuyidagi boshqaruv bloklaridan birini tanlang:", { parse_mode: 'HTML', ...getAdminMenu() });
});

// 2. SIGNALS EDIT (OLDIN QO'SHILGANLARNI KO'RSATISH)
bot.action("admin_signals", async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    let btns = [];
    apps.forEach(a => btns.push([Markup.button.callback(`❌ O'chirish: ${a.name}`, `del_app_${a._id}`)]));
    
    btns.push([Markup.button.callback("➕ Ilova qo'shish", "admin_add_app"), Markup.button.callback("✅ ID Tasdiqlash", "admin_verify_ids")]);
    btns.push([Markup.button.callback("⬅️ Ortga", "admin_panel")]);

    return ctx.editMessageText("🚀 <b>SIGNALS EDIT</b>\n\n👇 Mavjud platformalar ro'yxati:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(btns)
    });
});
bot.action("admin_add_app", (ctx) => { initSession(ctx); ctx.session.step = 'admin_add_app_name'; return ctx.reply("Ilova nomini kiriting (masalan, 1XBET):"); });
bot.action(/^del_app_(.+)$/, async (ctx) => {
    await Config.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("Platforma o'chirildi!", {show_alert: true});
    bot.handleUpdate({ callback_query: { id: ctx.callbackQuery.id, from: ctx.from, message: ctx.callbackQuery.message, data: "admin_signals" } }); // Qayta yuklash
});

// 5. QO'LLANMA (VIDEO YOKI MATN SO'RASH)
bot.action("admin_guide", (ctx) => {
    initSession(ctx); ctx.session.step = 'admin_guide_upload';
    return ctx.editMessageText("📚 <b>QO'LLANMA</b>\n\nYangi qo'llanmani yuboring.\n<i>(Video yuborsangiz, tagiga yozuvini qo'shib yuboring. Faqat matn ham yuborish mumkin)</i>:", {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_panel")]])
    });
});

// YAngi qo'shilgan: KANALLAR BO'LIMI (SOZLAMALAR O'RNIGA)
bot.action("admin_channels", async (ctx) => {
    const chans = await Config.find({ key: 'channel' });
    let btns = [];
    let text = "📢 <b>MAJBURIY KANALLAR</b>\n\nQuyidagi kanallar o'rnatilgan:\n";
    
    if(chans.length === 0) text += "Hozircha kanallar yo'q.";
    else chans.forEach((c, i) => {
        text += `${i+1}. ${c.name} (${c.chatId})\n`;
        btns.push([Markup.button.callback(`❌ O'chirish: ${c.name}`, `del_chan_${c._id}`)]);
    });

    btns.push([Markup.button.callback("➕ Kanal qo'shish", "admin_add_chan")]);
    btns.push([Markup.button.callback("⬅️ Ortga", "admin_panel")]);

    return ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});
bot.action("admin_add_chan", (ctx) => {
    initSession(ctx); ctx.session.step = 'admin_add_channel';
    return ctx.reply("Kanal ma'lumotlarini quyidagi formatda yuboring:\n\nKanal Nomi | Kanal Linki | Kanal ID\n\nMasalan:\nMening Kanalim | https://t.me/kanal | -100123456789");
});
bot.action(/^del_chan_(.+)$/, async (ctx) => {
    await Config.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("Kanal o'chirildi!", {show_alert: true});
    bot.handleUpdate({ callback_query: { id: ctx.callbackQuery.id, from: ctx.from, message: ctx.callbackQuery.message, data: "admin_channels" } }); // Qayta yuklash
});


// ==========================================
// 9. MESSAGE HANDLER (TEXT & MEDIA)
// ==========================================
bot.on('message', async (ctx) => {
    initSession(ctx);
    const step = ctx.session.step;
    if (!step) return;

    // --- ADMIN BROADCAST ---
    if (ctx.from.id === ADMIN_ID && step === 'await_broadcast_msg') {
        ctx.session.broadcastMsgId = ctx.message.message_id;
        return ctx.reply(`Hamma kishiga yuboraymi?`, Markup.inlineKeyboard([
            [Markup.button.callback("✅ HA (Barchaga yuborish)", "confirm_broadcast")],
            [Markup.button.callback("❌ BEKOR QILISH", "admin_panel")]
        ]));
    }

    // --- QO'LLANMA YUKLASH (VIDEO VA MATN) ---
    if (ctx.from.id === ADMIN_ID && step === 'admin_guide_upload') {
        const isVideo = !!ctx.message.video;
        const text = isVideo ? (ctx.message.caption || "Qo'llanma") : (ctx.message.text || "Qo'llanma");
        const videoId = isVideo ? ctx.message.video.file_id : null;

        await Config.findOneAndUpdate({ key: 'guide' }, { content: text, url: videoId }, { upsert: true });
        ctx.session.step = null;
        return ctx.reply("✅ Qo'llanma muvaffaqiyatli saqlandi!", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Admin Panel", "admin_panel")]]));
    }

    // --- KANAL QO'SHISH ---
    if (ctx.from.id === ADMIN_ID && step === 'admin_add_channel') {
        if (!ctx.message.text) return ctx.reply("Iltimos, matnli formatda yuboring.");
        const parts = ctx.message.text.split('|').map(p => p.trim());
        if (parts.length === 3) {
            await Config.create({ key: 'channel', name: parts[0], url: parts[1], chatId: parts[2] });
            ctx.session.step = null;
            return ctx.reply(`✅ Kanal qo'shildi: ${parts[0]}`, Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kanallarga qaytish", "admin_channels")]]));
        } else {
            return ctx.reply("❌ Noto'g'ri format! Iltimos, Namuna bo'yicha yuboring:\nKanal nomi | https://t.me/k | -100...");
        }
    }

    // --- PLATFORMA QO'SHISH ---
    if (ctx.from.id === ADMIN_ID && step === 'admin_add_app_name') {
        if (!ctx.message.text) return;
        await Config.create({ key: 'app', name: ctx.message.text, url: 'https://1xbet.com', content: 'https://t.me/dl' });
        ctx.session.step = null;
        return ctx.reply(`✅ ${ctx.message.text} platformasi qo'shildi!`, Markup.inlineKeyboard([[Markup.button.callback("⬅️ Ortga", "admin_signals")]]));
    }
});

bot.launch().then(() => {
    console.log("⚡ Bot muvaffaqiyatli ishga tushdi!");
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🌐 Server ishga tushdi.");
});
