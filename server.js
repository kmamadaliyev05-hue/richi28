const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE STRUKTURASI (Optimallashtirilgan)
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ RICHI28 DATABASE CONNECTED'))
    .catch(err => console.error('❌ DB ERROR:', err));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    isVerified: { type: Boolean, default: false },
    gameId: { type: String, default: 'Kiritilmagan' },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    notifications: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, // 'channel', 'app', 'guide_video', 'guide_text'
    name: String,
    url: String,
    chatId: String,
    content: String
}));

// 2. BOT VA SERVER SOZLAMALARI
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// 3. MULTI-LANG LUG'ATI (Professional daraja)
const i18n = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli.",
        sub_req: "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:",
        verify_sub: "✅ Tasdiqlash",
        btn_web: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        back: "⬅️ Ortga",
        no_access: "⚠️ Ruxsat yo'q! Avval ID tasdiqlang.",
        id_prompt: "🆔 Platformadagi ID raqamingizni yuboring:",
        wallet_text: (bal) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\n\nKamida 50,000 UZS bo'lganda yechish mumkin.`,
        ref_text: (count, link) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta\n\n🎁 Mukofotlar:\n- 5 do'st = 5,000 UZS\n- 10 do'st = 13,000 UZS`,
        settings_text: (id, status, notify) => `🛠 <b>SOZLAMALAR</b>\n\n👤 Profil ID: ${id}\n✅ Status: ${status ? 'Verified' : 'Unverified'}\n🔔 Bildirishnomalar: ${notify ? 'On' : 'Off'}`
    },
    ru: { /* Lug'at qisqartirildi, zarur bo'lsa to'liq qo'shiladi */ },
    en: { /* Lug'at qisqartirildi, zarur bo'lsa to'liq qo'shiladi */ }
};

// 4. KLAIATURE GENERATOR (Dinamik)
const getMainMenu = (lang, isAdmin) => {
    const t = i18n[lang] || i18n.uz;
    let btns = [
        [Markup.button.callback(t.btn_web, 'open_web')],
        [Markup.button.callback(t.btn_signals, 'menu_signals'), Markup.button.callback(t.btn_network, 'menu_network')],
        [Markup.button.callback(t.btn_wins, 'menu_wins'), Markup.button.callback(t.btn_guide, 'menu_guide')],
        [Markup.button.callback(t.btn_wallet, 'menu_wallet'), Markup.button.callback(t.btn_settings, 'menu_settings')],
        [Markup.button.callback(t.btn_support, 'menu_support')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('⚙️ ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// 5. MAJBURIY OBUNA FILTRI (GATING)
const checkSub = async (ctx) => {
    if (ctx.from.id === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    for (const chan of channels) {
        try {
            const res = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(res.status)) return false;
        } catch (e) { continue; }
    }
    return true;
};

// 6. ASOSIY START VA TIL TANLASH
bot.start(async (ctx) => {
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOne({ userId: ctx.from.id });
    if (!user) {
        user = await User.create({ userId: ctx.from.id, firstName: ctx.from.first_name, invitedBy: refId });
        if (refId && refId !== ctx.from.id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referrals: 1, balance: 1000 } });
        }
    }
    return ctx.reply("🌐 Tilingizni tanlang / Choose language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz"), Markup.button.callback("🇷🇺 Русский", "setlang_ru"), Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

bot.action(/^setlang_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ userId: ctx.from.id }, { lang });
    if (!(await checkSub(ctx))) {
        const chans = await Config.find({ key: 'channel' });
        const btns = chans.map(c => [Markup.button.url(c.name, c.url)]);
        btns.push([Markup.button.callback(i18n[lang].verify_sub, 'verify_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(i18n[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
});

bot.action('verify_sub', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (await checkSub(ctx)) return ctx.editMessageText(i18n[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    ctx.answerCbQuery("❌ Obuna topilmadi!", { show_alert: true });
});

// 7. BO'LIMLAR MANTIQLARI
bot.action('home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

bot.action('open_web', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user.isVerified) return ctx.answerCbQuery(i18n[user.lang].no_access, { show_alert: true });
    ctx.reply("🟢 KONSOLGA KIRISH RUXSAT ETILDI:", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 TERMINALNI ISHGA TUSHIRISH", process.env.WEB_APP_URL)],
        [Markup.button.callback(i18n[user.lang].back, 'home')]
    ]));
});

bot.action('menu_signals', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 ID TASDIQLASH", 'verify_id_start')]);
    btns.push([Markup.button.callback(i18n[user.lang].back, 'home')]);
    ctx.editMessageText("🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:", Markup.inlineKeyboard(btns));
});

bot.action('menu_network', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(i18n[user.lang].ref_text(user.referrals, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]]) });
});

bot.action('menu_wallet', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].wallet_text(user.balance), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("💸 Pul yechish", "withdraw_req")], [Markup.button.callback(i18n[user.lang].back, 'home')]]) });
});

bot.action('menu_settings', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].settings_text(user.userId, user.isVerified, user.notifications), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔄 Tilni o'zgartirish", "home")], [Markup.button.callback(i18n[user.lang].back, 'home')]]) });
});

bot.action('menu_guide', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const video = await Config.findOne({ key: 'guide_video' });
    const text = await Config.findOne({ key: 'guide_text' });
    if (video) await ctx.replyWithVideo(video.url);
    ctx.reply(text ? text.content : "Tez orada...", Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]]));
});

bot.action('menu_wins', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    let wins = "🏆 <b>SO'NGGI YUTUQLAR:</b>\n\n";
    for(let i=0; i<10; i++) wins += `✅ ID: ${Math.floor(Math.random()*9000)+1000}** | +${(Math.random()*1500000).toLocaleString()} UZS\n`;
    ctx.editMessageText(wins, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]]) });
});

// 8. ADMIN PANEL (FULL CONTROL)
bot.action('admin_main', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("⚙️ <b>ADMIN CONTROL PANEL</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 KANALLAR', 'adm_chans'), Markup.button.callback('📱 ILOVALAR', 'adm_apps')],
            [Markup.button.callback('✅ ID TASDIQLASH', 'adm_verify'), Markup.button.callback('💰 TO\'LOVLAR', 'adm_pays')],
            [Markup.button.callback('📩 ARIZALAR', 'adm_tickets'), Markup.button.callback('📚 QO\'LLANMA', 'adm_guide')],
            [Markup.button.callback('📢 REKLAMA', 'adm_promo'), Markup.button.callback('📊 STATISTIKA', 'adm_stats')],
            [Markup.button.callback('🔙 CHIQUV', 'home')]
        ])
    });
});

bot.action('adm_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    ctx.editMessageText(`📊 <b>STATISTIKA:</b>\n\nJami: ${total}\nTasdiqlangan: ${verified}`, Markup.inlineKeyboard([[Markup.button.callback(i18n.uz.back, 'admin_main')]]));
});

// 9. TEXT HANDLER (Support, ID, Withdraw)
bot.on('text', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (ctx.session.step === 'awaiting_id') {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text });
        ctx.reply("⏳ Adminga yuborildi.");
        bot.telegram.sendMessage(ADMIN_ID, `🆔 YANGI ID: ${ctx.message.text}\nUser: ${ctx.from.first_name}`, Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash', `approve_${ctx.from.id}`)]]));
        ctx.session.step = null;
    } else if (ctx.session.step === 'support_msg') {
        ctx.reply("✅ Ticket yuborildi.");
        bot.telegram.sendMessage(ADMIN_ID, `📩 ARIZA: ${ctx.message.text}\nID: ${ctx.from.id}`, Markup.inlineKeyboard([[Markup.button.callback('✍️ Javob', `reply_${ctx.from.id}`)]]));
        ctx.session.step = null;
    }
});

// 10. CALLBACK HANDLERLAR (Admin Actions)
bot.action(/^approve_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "✅ ID tasdiqlandi, Konsol ochildi!");
    ctx.answerCbQuery("Tasdiqlandi");
});

bot.action('verify_id_start', (ctx) => {
    ctx.session.step = 'awaiting_id';
    ctx.reply(i18n.uz.id_prompt);
});

bot.action('menu_support', (ctx) => {
    ctx.session.step = 'support_msg';
    ctx.reply("✍️ Muammoingizni yozing:");
});

// SERVER START
const app = express();
app.get('/', (req, res) => res.send('Server Running'));
app.listen(process.env.PORT || 3000);

bot.launch();
console.log('🚀 BOT IS LIVE');
