const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('✅ RICHI28 TITAN CONNECTED');
    seedApps();
});

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    hackerId: String,
    firstName: String,
    lang: { type: String, default: 'uz' },
    rank: { type: String, default: 'NEWBIE' },
    accuracy: { type: Number, default: 45 },
    referralCount: { type: Number, default: 0 },
    accounts: [{ bookmaker: String, gameId: String, status: String }], // Multi-Wallet
    lastBonus: { type: Date, default: new Date(0) },
    status: { type: String, default: 'new' },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}));

const SupportMessage = mongoose.model('Support', new mongoose.Schema({
    userId: Number, hackerId: String, text: String, date: { type: Date, default: Date.now }, status: { type: String, default: 'new' }
}));

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });

// --- UTILS ---
const generateHackerId = () => Math.floor(10000000 + Math.random() * 90000000).toString();

async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            // Zayafka yuborgan bo'lsa ham hisobga olamiz:
            if (!['member', 'administrator', 'creator', 'restricted'].includes(member.status)) {
                // Agar zayafka yuborgan bo'lsa mantiqan ruxsat berish mumkin (lekin odatda keshda qoladi)
                // Shuning uchun bazadagi user statusni tekshiramiz
                const user = await User.findOne({ userId: uid });
                if (user && user.status !== 'requested') return false;
            }
        } catch (e) { continue; }
    }
    return true;
}

// --- LUG'AT (IMLO XATOSIZ) ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz!",
        main_menu: "Boshqaruv paneli terminali:",
        btn_signal: "🚀 SIGNAL OLISH (Web App)",
        btn_profile: "👤 PROFIL",
        btn_ref: "👥 YO'LLANMA SILKA",
        btn_bonus: "🎁 BONUS",
        btn_guide: "📚 YO'RIQNOMA",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "🆘 SUPPORT",
        btn_admin: "🛠 Admin Panel",
        guide_text: "<b>📚 RICHI28 FOYDALANISH YO'RIQNOMASI</b>\n\n1. Avval RICHI28 promokodi bilan ro'yxatdan o'ting.\n2. Balansingizni kamida 60,000 so'mga to'ldiring.\n3. Botga ID raqamingizni yuboring va tasdiqlatib oling.\n4. Web App ichida faqat birinchi o'yindagi signal bo'yicha harakat qiling.\n\n⚠️ <b>Diqqat:</b> Shartlar bajarilmasa, tizim aniqligi pasayadi!",
        settings_text: "<b>🛠 SOZLAMALAR</b>\n\nBu yerda tilni o'zgartirishingiz yoki bukmekerlik ma'lumotlarini boshqarishingiz mumkin.",
        support_prompt: "✍️ Adminga yubormoqchi bo'lgan xabaringizni yozing. Sizga tez orada javob beriladi:",
        support_sent: "✅ Xabaringiz adminga yuborildi. Tez orada javob olasiz.",
        wallet_manage: "📂 <b>MULTI-WALLET BOSHQARUVI</b>\n\nSizning platformalaringiz:",
        input_id: "🆔 ID raqamingizni yuboring:"
    },
    ru: {
        welcome: "добро пожаловать в систему!",
        btn_signal: "🚀 ПОЛУЧИТЬ СИГНАЛ",
        btn_profile: "👤 ПРОФИЛЬ",
        btn_ref: "👥 РЕФЕРАЛКА",
        btn_bonus: "🎁 БОНУС",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "🆘 ПОДДЕРЖКА"
    },
    en: {
        welcome: "welcome to the system!",
        btn_signal: "🚀 GET SIGNAL",
        btn_profile: "👤 PROFILE",
        btn_ref: "👥 REFERRAL LINK",
        btn_bonus: "🎁 BONUS",
        btn_guide: "📚 GUIDE",
        btn_settings: "🛠 SETTINGS",
        btn_support: "🆘 SUPPORT"
    }
};

const getMainMenu = (u, isAdmin) => {
    const t = i18n[u.lang || 'uz'];
    const webUrl = `${process.env.WEB_APP_URL}?lang=${u.lang}&id=${u.hackerId}&refs=${u.referralCount}`;
    let btns = [
        [Markup.button.webApp(t.btn_signal, webUrl)],
        [Markup.button.callback(t.btn_profile, 'my_profile'), Markup.button.callback(t.btn_ref, 'ref_menu')],
        [Markup.button.callback(t.btn_bonus, 'get_bonus')],
        [Markup.button.callback(t.btn_guide, 'show_guide'), Markup.button.callback(t.btn_settings, 'settings_menu')],
        [Markup.button.callback(t.btn_support, 'support_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback(t.btn_admin, 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// --- HANDLERS ---
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, hackerId: generateHackerId() });
        if (refId && refId !== id) await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }
    return ctx.reply("🌐 Tilni tanlang / Выберите язык / Select language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]
    ]));
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        const channels = await Config.find({ key: 'channel' });
        const btns = channels.map(c => [Markup.button.url(`📢 ${c.name}`, c.url)]);
        btns.push([Markup.button.callback("✅ Tasdiqlash", 'check_sub')]);
        return ctx.editMessageText("⚠️ Botni faollashtirish uchun obuna bo'ling:", Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${user.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('check_sub', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (await canAccess(ctx)) return ctx.editMessageText("✅ Tasdiqlandi!", getMainMenu(u, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery("❌ Obuna topilmadi!", { show_alert: true });
});

// --- YO'RIQNOMA VA SOZLAMALAR ---
bot.action('show_guide', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].guide_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'back_home')]]) });
});

bot.action('settings_menu', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].settings_text, { parse_mode: 'HTML', 
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🌐 Tilni o'zgartirish", 'change_lang')],
            [Markup.button.callback("📂 Portfolio boshqaruvi", 'manage_wallet')],
            [Markup.button.callback("🔙 Orqaga", 'back_home')]
        ])
    });
});

bot.action('change_lang', (ctx) => {
    ctx.editMessageText("🌐 Tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")],
        [Markup.button.callback("🔙", 'settings_menu')]
    ]));
});

// --- MULTI-WALLET (ILOVALARNI BOSHQARISH) ---
bot.action('manage_wallet', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    let btns = u.accounts.map((a, i) => [Markup.button.callback(`❌ O'chirish: ${a.bookmaker} (${a.gameId})`, `del_acc_${i}`)]);
    btns.push([Markup.button.callback("➕ Bukmeker qo'shish", 'add_acc')]);
    btns.push([Markup.button.callback("🔙 Orqaga", 'settings_menu')]);
    ctx.editMessageText(i18n[u.lang].wallet_manage, Markup.inlineKeyboard(btns));
});

bot.action(/^del_acc_(\d+)$/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const u = await User.findOne({ userId: ctx.from.id });
    u.accounts.splice(idx, 1);
    await u.save();
    ctx.answerCbQuery("O'chirildi!");
    return ctx.editMessageText("Harakat bajarildi.", Markup.inlineKeyboard([[Markup.button.callback("🔙", 'manage_wallet')]]));
});

bot.action('add_acc', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `sel_add_${a.name}`)]);
    btns.push([Markup.button.callback("🔙", 'manage_wallet')]);
    ctx.editMessageText("Qaysi bukmekerni qo'shmoqchisiz?", Markup.inlineKeyboard(btns));
});

bot.action(/^sel_add_(.+)$/, (ctx) => {
    ctx.session.tmpApp = ctx.match[1];
    ctx.session.step = 'input_new_id';
    ctx.reply("🆔 Yangi ID raqamingizni yuboring:");
});

// --- SUPPORT TIZIMI ---
bot.action('support_menu', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'support_wait';
    ctx.editMessageText(i18n[u.lang].support_prompt, Markup.inlineKeyboard([[Markup.button.callback("🔙", 'back_home')]]));
});

// --- TEXT HANDLERS ---
bot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    const step = ctx.session.step;

    if (step === 'support_wait') {
        const u = await User.findOne({ userId: uid });
        await SupportMessage.create({ userId: uid, hackerId: u.hackerId, text: ctx.message.text });
        ctx.session.step = null;
        return ctx.reply(i18n[u.lang].support_sent, getMainMenu(u, uid === ADMIN_ID));
    }

    if (step === 'input_new_id' && /^\d+$/.test(ctx.message.text)) {
        const u = await User.findOne({ userId: uid });
        u.accounts.push({ bookmaker: ctx.session.tmpApp, gameId: ctx.message.text, status: 'pending' });
        await u.save();
        ctx.session.step = null;
        ctx.reply("✅ ID qabul qilindi va tahlilga yuborildi.");
        bot.telegram.sendMessage(ADMIN_ID, `🛎 <b>YANGI TASDIQLASH SO'ROVI</b>\n\nUser: ${u.firstName}\nHacker ID: ${u.hackerId}\nPlatforma: ${ctx.session.tmpApp}\nID: ${ctx.message.text}`, { parse_mode: 'HTML' });
        return;
    }

    // Admin panel javob qaytarish mantiqi:
    if (uid === ADMIN_ID && ctx.message.reply_to_message) {
        const text = ctx.message.text;
        const replyMatch = ctx.message.reply_to_message.text.match(/ID: (\d+)/);
        if (replyMatch) {
            const targetId = replyMatch[1];
            bot.telegram.sendMessage(targetId, `📩 <b>SUPPORT JAVOBI:</b>\n\n${text}`, { parse_mode: 'HTML' });
            ctx.reply("✅ Javob yuborildi.");
        }
    }
});

// --- SUPER ADMIN PANEL ---
bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const stats = await User.countDocuments();
    ctx.editMessageText(`🛰 <b>TITAN SERVER BOSHQARUVI</b>\n\nJami agentlar: ${stats}`, Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('📩 Support Xabarlar', 'a_support')],
        [Markup.button.callback('🔗 Kanallar', 'a_ch'), Markup.button.callback('📱 Ilovalar', 'a_app')],
        [Markup.button.callback('✉️ Xabar Tarqatish', 'a_bc')],
        [Markup.button.callback('🔙 Chiqish', 'back_home')]
    ]));
});

bot.action('a_support', async (ctx) => {
    const msg = await SupportMessage.find({ status: 'new' }).limit(1);
    if (msg.length === 0) return ctx.answerCbQuery("Yangi xabarlar yo'q!");
    const m = msg[0];
    ctx.reply(`📩 <b>Yangi xabar</b>\n\nUser ID: ${m.userId}\nHacker ID: ${m.hackerId}\nMatn: ${m.text}`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ O'qildi", `read_sup_${m._id}`)]
    ]));
});

bot.action(/^read_sup_(.+)$/, async (ctx) => {
    await SupportMessage.findByIdAndUpdate(ctx.match[1], { status: 'read' });
    ctx.editMessageText("✅ Xabar arxivlandi.");
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    ctx.editMessageText(`📊 <b>CHUQUZ STATISTIKA</b>\n\nJami foydalanuvchilar: ${total}\nVIP (Tasdiqlangan): ${verified}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]]));
});

bot.action('back_home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${u.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(u, ctx.from.id === ADMIN_ID) });
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

async function seedApps() {
    const apps = ['1XBET', 'LINEBET', 'MELBET'];
    for (const a of apps) { if (!await Config.findOne({ key: 'app', name: a })) await Config.create({ key: 'app', name: a }); }
}

bot.launch();
const app = express(); app.get('/', (req, res) => res.send('Titan Online')); app.listen(process.env.PORT || 3000);
