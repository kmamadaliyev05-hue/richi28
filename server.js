const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ MongoDB Connected');
    try { await mongoose.connection.db.collection('configs').dropIndexes(); } catch (e) {}
    seedApps(); 
});

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    status: { type: String, default: 'new' },
    isVerified: { type: Boolean, default: false },
    gameId: String,
    bookmaker: String,
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}, { autoIndex: false }));

// --- MULTI-LANG ---
const i18n = {
    uz: { welcome: "tizimiga xush kelibsiz!", sub_req: "Botdan foydalanish uchun kanallarga a'zo bo'ling yoki so'rov yuboring:", check: "✅ Tekshirish", signal: "🚀 Signal olish", vip_signal: "⚡️ Signal olish (VIP)", apps: "📱 Ilovalar", ref: "👥 Yo'llanma silka", guide: "📖 Bot bilan tanishish", terms: "📜 Signal olish shartlari", back: "🔙 Orqaga", verified: "✅ Tasdiqlandi!", wait_admin: "⏳ Qabul qilindi, kuting.", input_id: "🆔 ID yuboring (raqam):", no_sub: "❌ Obuna topilmadi!" },
    ru: { welcome: "в систему!", sub_req: "Подпишитесь на каналы или отправьте запрос:", check: "✅ Проверить", signal: "🚀 Получить сигнал", vip_signal: "⚡️ Получить VIP", apps: "📱 Приложения", ref: "👥 Рефералка", guide: "📖 Инструкция", terms: "📜 Условия", back: "🔙 Назад", verified: "✅ Подтверждено!", wait_admin: "⏳ Принято, ждите.", input_id: "🆔 Отправьте ID:", no_sub: "❌ Подписка не найдена!" },
    en: { welcome: "to the system!", sub_req: "Subscribe to channels or send request:", check: "✅ Check", signal: "🚀 Get Signal", vip_signal: "⚡️ Get VIP", apps: "📱 Apps", ref: "👥 Referral", guide: "📖 Guide", terms: "📜 Terms", back: "🔙 Back", verified: "✅ Verified!", wait_admin: "⏳ Wait...", input_id: "🆔 Send ID:", no_sub: "❌ No subscription!" }
};

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });

// --- ENG QATTIQ TEKSHIRUV (HARD CHECK) ---
async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;

    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;

    let isSubscribed = false;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            if (['member', 'administrator', 'creator'].includes(member.status)) {
                isSubscribed = true;
                break;
            }
        } catch (e) { continue; }
    }

    const user = await User.findOne({ userId: uid });

    // AGAR OBUNA BO'LMASA:
    if (!isSubscribed) {
        // Agar zayavkada bo'lsa va obunachilar ro'yxatida bo'lmasa:
        if (user && user.status === 'requested') {
            return true;
        }

        // AGAR NA OBUNA NA ZAYAVKA BO'LSA - HAMMA NARSASINI O'CHIRAMIZ (VIP BO'LSA HAM)
        if (user && (user.isVerified || user.status !== 'new')) {
            await User.findOneAndUpdate(
                { userId: uid }, 
                { isVerified: false, status: 'new', gameId: null, bookmaker: null }
            );
        }
        return false;
    }
    return true;
}

const getMainMenu = (u, isAdmin) => {
    const t = i18n[u.lang || 'uz'];
    let btns = [
        [u.isVerified ? Markup.button.webApp(t.vip_signal, `${process.env.WEB_APP_URL}?lang=${u.lang}`) : Markup.button.callback(t.signal, 'get_signal')],
        [Markup.button.callback(t.terms, 'show_terms'), Markup.button.callback(t.guide, 'show_guide')],
        [Markup.button.url(t.apps, 'https://t.me/apple_ilovalar'), Markup.button.callback(t.ref, 'ref_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// --- START ---
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true, new: true });
    return ctx.reply("🇺🇿 Til / 🇷🇺 Язык / 🇬🇧 Lang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]
    ]));
});

// --- TUGMALARNI NAZORAT QILISH (MIDDLEWARE) ---
bot.on('callback_query', async (ctx, next) => {
    const act = ctx.callbackQuery.data;
    if (['set_uz', 'set_ru', 'set_en', 'check_sub'].includes(act)) return next();

    const access = await canAccess(ctx);
    if (!access) {
        const u = await User.findOne({ userId: ctx.from.id });
        const chs = await Config.find({ key: 'channel' });
        const btns = chs.map(c => [Markup.button.url(`📢 ${c.name}`, c.url)]);
        btns.push([Markup.button.callback(i18n[u?.lang || 'uz'].check, 'check_sub')]);
        return ctx.editMessageText(i18n[u?.lang || 'uz'].sub_req, Markup.inlineKeyboard(btns));
    }
    return next();
});

// --- SET LANG ---
bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        const chs = await Config.find({ key: 'channel' });
        const btns = chs.map(c => [Markup.button.url(`📢 ${c.name}`, c.url)]);
        btns.push([Markup.button.callback(i18n[lang].check, 'check_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(`<b>RICHI28 APPLE</b> ${i18n[lang].welcome}\n\n🆔 ID: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('check_sub', async (ctx) => {
    const access = await canAccess(ctx);
    const u = await User.findOne({ userId: ctx.from.id });
    if (access) return ctx.editMessageText(i18n[u.lang].verified, getMainMenu(u, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery(i18n[u.lang].no_sub, { show_alert: true });
});

// --- ADMIN PANEL ---
bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText(`🛠 <b>ADMIN PANEL</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc_menu')], [Markup.button.callback('🔗 Kanallar', 'a_ch_man'), Markup.button.callback('📱 Ilovalar', 'a_app_man')], [Markup.button.callback('🔙 Chiqish', 'back_home')]]) });
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    const uz = await User.countDocuments({ lang: 'uz' });
    const ru = await User.countDocuments({ lang: 'ru' });
    const en = await User.countDocuments({ lang: 'en' });
    ctx.editMessageText(`📊 Jami: ${total}\n✅ VIP: ${verified}\n\n🇺🇿 UZ: ${uz}\n🇷🇺 RU: ${ru}\n🇬🇧 EN: ${en}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]]));
});

bot.action('a_bc_menu', (ctx) => {
    ctx.editMessageText("Reklama filtri:", Markup.inlineKeyboard([[Markup.button.callback("🌍 Hammaga", "bc_all")], [Markup.button.callback("🇺🇿 UZ", "bc_uz"), Markup.button.callback("🇷🇺 RU", "bc_ru"), Markup.button.callback("🇬🇧 EN", "bc_en")], [Markup.button.callback("🔙", "admin_main")]]));
});

bot.action(/^bc_(all|uz|ru|en)$/, (ctx) => { ctx.session.bcTarget = ctx.match[1]; ctx.session.step = 'bc_media'; ctx.reply("Media yuboring:"); });

bot.action('a_ch_man', async (ctx) => {
    const chs = await Config.find({ key: 'channel' });
    const btns = chs.map(c => [Markup.button.callback(`❌ ${c.name}`, `del_cfg_${c._id}`)]);
    btns.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('🔙', 'admin_main')]);
    ctx.editMessageText("🔗 KANALLAR", Markup.inlineKeyboard(btns));
});

bot.action('a_app_man', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(`❌ ${a.name}`, `del_cfg_${a._id}`)]);
    btns.push([Markup.button.callback('➕ Qo\'shish', 'add_app')], [Markup.button.callback('🔙', 'admin_main')]);
    ctx.editMessageText("📱 ILOVALAR", Markup.inlineKeyboard(btns));
});

bot.action(/^del_cfg_(.+)$/, async (ctx) => { await Config.findByIdAndDelete(ctx.match[1]); ctx.editMessageText("O'chirildi.", Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]])); });
bot.action('add_ch', (ctx) => { ctx.session.step = 'ch_n'; ctx.reply("Nomi:"); });
bot.action('add_app', (ctx) => { ctx.session.step = 'app_n'; ctx.reply("Nomi:"); });

// --- TEXT HANDLERS ---
bot.on(['text', 'photo', 'video', 'animation', 'document'], async (ctx) => {
    const step = ctx.session.step;
    if (ctx.from.id === ADMIN_ID) {
        if (step === 'bc_media') {
            const filter = ctx.session.bcTarget === 'all' ? {} : { lang: ctx.session.bcTarget };
            const users = await User.find(filter);
            let count = 0;
            ctx.reply("⏳...");
            for (let u of users) { try { await ctx.copyMessage(u.userId); count++; } catch (e) {} }
            ctx.session.step = null; return ctx.reply(`✅ Yetkazildi: ${count}`);
        }
        if (step === 'ch_n') { ctx.session.tmpN = ctx.message.text; ctx.session.step = 'ch_i'; return ctx.reply("ID:"); }
        if (step === 'ch_i') { ctx.session.tmpI = ctx.message.text; ctx.session.step = 'ch_u'; return ctx.reply("Link:"); }
        if (step === 'ch_u') { await Config.create({ key: 'channel', name: ctx.session.tmpN, chatId: ctx.session.tmpI, url: ctx.message.text }); ctx.session.step = null; return ctx.reply("✅ Qo'shildi!"); }
        if (step === 'app_n') { await Config.create({ key: 'app', name: ctx.message.text }); ctx.session.step = null; return ctx.reply("✅ Qo'shildi!"); }
    }

    if (step === 'input_id' && ctx.message.text) {
        const u = await User.findOne({ userId: ctx.from.id });
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("Raqam yuboring!");
        ctx.session.step = null;
        ctx.reply(i18n[u.lang].wait_admin);
        bot.telegram.sendMessage(ADMIN_ID, `🆔 ID: <code>${ctx.message.text}</code>\n👤: ${ctx.from.first_name}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `confirm_${ctx.from.id}`), Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]]) });
    }
});

// --- BOSHQA FUNKSIYALAR ---
bot.action('back_home', async (ctx) => { const u = await User.findOne({ userId: ctx.from.id }); ctx.editMessageText(`<b>RICHI28 APPLE</b>`, { parse_mode: 'HTML', ...getMainMenu(u, ctx.from.id === ADMIN_ID) }); });
bot.action('show_terms', async (ctx) => { const u = await User.findOne({ userId: ctx.from.id }); ctx.editMessageText(i18n[u.lang].terms_text || "Terms", Markup.inlineKeyboard([[Markup.button.callback('🔙', 'back_home')]])); });
bot.action('show_guide', async (ctx) => { const u = await User.findOne({ userId: ctx.from.id }); ctx.editMessageText(i18n[u.lang].guide_text || "Guide", Markup.inlineKeyboard([[Markup.button.callback('🔙', 'back_home')]])); });
bot.action('ref_menu', async (ctx) => { const u = await User.findOne({ userId: ctx.from.id }); const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`; ctx.editMessageText(`👥 Referal: ${u.referralCount}\n🔗 ${link}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'back_home')]])); });
bot.action('get_signal', async (ctx) => { const u = await User.findOne({ userId: ctx.from.id }); const apps = await Config.find({ key: 'app' }); const btns = apps.map(a => [Markup.button.callback(a.name, `select_app_${a.name}`)]); btns.push([Markup.button.callback('🔙', 'back_home')]); ctx.editMessageText(i18n[u.lang].platform, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) }); });
bot.action(/^select_app_(.+)$/, async (ctx) => { const u = await User.findOne({ userId: ctx.from.id }); ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'input_id'; ctx.editMessageText(i18n[u.lang].input_id, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'get_signal')]])); });
bot.action(/^confirm_(\d+)$/, async (ctx) => { await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true }); bot.telegram.sendMessage(ctx.match[1], "✅ VIP UNLOCKED!"); ctx.editMessageText("✅ Confirmed!"); });
bot.action(/^reject_(\d+)$/, (ctx) => ctx.editMessageText("❌ Rejected!"));
bot.on('chat_join_request', async (ctx) => { await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true }); });

async function seedApps() { const defaultApps = ['1XBET', 'LINEBET']; for (const a of defaultApps) { const exists = await Config.findOne({ key: 'app', name: a }); if (!exists) await Config.create({ key: 'app', name: a }); } }

bot.launch().then(() => console.log('🚀 RICHI28 SECURE LIVE'));
const app = express(); app.get('/', (req, res) => res.send('Online')); app.listen(process.env.PORT || 3000);
