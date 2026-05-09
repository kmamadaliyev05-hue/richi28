const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI
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

// --- MULTI-LANG LUG'ATI ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz!",
        sub_req: "Botdan foydalanish uchun kanallarga a'zo bo'ling yoki so'rov yuboring:",
        check: "✅ Tekshirish",
        signal: "🚀 Signal olish",
        vip_signal: "⚡️ Signal olish (VIP)",
        apps: "📱 Ilovalar",
        ref: "👥 Yo'llanma silka",
        guide: "📖 Bot bilan tanishish",
        terms: "📜 Signal olish shartlari",
        platform: "🎯 <b>Platformani tanlang:</b>",
        input_id: "🆔 ID yuboring (faqat raqam):",
        back: "🔙 Orqaga",
        no_sub: "❌ Obuna yoki so'rov topilmadi!",
        verified: "✅ Tasdiqlandi!",
        ref_text: (count, task, link) => `👥 <b>Referal tizimi</b>\n\n📊 Odamlar: <b>${count}</b> ta\n🎯 Vazifa: <b>${task}</b> ta\n\n🔗 Havolangiz:\n<code>${link}</code>`,
        terms_text: "<b>📜 SIGNAL OLISH SHARTLARI:</b>\n\n1. Ro'yxatdan o'tishda <b>RICHI28</b> promokodini ishlating.\n2. Balansni kamida 60,000 so'mga to'ldiring.\n3. O'yin ID raqamini botga yuboring.\n\n⚠️ Diqqat: Shartlar bajarilmasa, Hack tizimi xato ishlashi mumkin!",
        guide_text: "<b>📖 FOYDALANISH QO'LLANMASI:</b>\n\n1. Avval kanallarga obuna bo'ling.\n2. 'Signal olish' tugmasini bosing.\n3. O'zingiz o'ynayotgan platformani tanlang va ID yuboring.\n4. Admin tasdiqlagach, VIP tugmasi orqali Web App'ga kiring."
    },
    ru: {
        welcome: "Добро пожаловать в систему!",
        sub_req: "Для использования бота подпишитесь на каналы или отправьте запрос:",
        check: "✅ Проверить",
        signal: "🚀 Получить сигнал",
        vip_signal: "⚡️ Получить сигнал (VIP)",
        apps: "📱 Приложения",
        ref: "👥 Рефералка",
        guide: "📖 Инструкция",
        terms: "📜 Условия получения",
        platform: "🎯 <b>Выберите платформу:</b>",
        input_id: "🆔 Отправьте ID (только цифры):",
        back: "🔙 Назад",
        no_sub: "❌ Подписка не найдена!",
        verified: "✅ Подтверждено!"
    },
    en: {
        welcome: "Welcome to the system!",
        sub_req: "Subscribe to the channels to use the bot:",
        check: "✅ Check",
        signal: "🚀 Get Signal",
        vip_signal: "⚡️ Get Signal (VIP)",
        apps: "📱 Apps",
        ref: "👥 Referral link",
        guide: "📖 How to use",
        terms: "📜 Terms & Conditions",
        platform: "🎯 <b>Select platform:</b>",
        input_id: "🆔 Send ID (numbers only):",
        back: "🔙 Back",
        no_sub: "❌ Subscription not found!",
        verified: "✅ Verified!"
    }
};

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });

// --- ENG QATTIQ REAL-TIME NAZORAT ---
async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    let isSubscribed = false;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            if (['member', 'administrator', 'creator'].includes(member.status)) { isSubscribed = true; break; }
        } catch (e) {}
    }
    if (!isSubscribed) {
        const user = await User.findOne({ userId: uid });
        if (user && user.status === 'requested') return true;
        if (user && (user.isVerified || user.status !== 'new')) {
            await User.findOneAndUpdate({ userId: uid }, { isVerified: false, status: 'new', gameId: null });
        }
        return false;
    }
    return true;
}

const getMainMenu = (u, isAdmin) => {
    const lang = u.lang || 'uz';
    const t = i18n[lang];
    const webUrl = `${process.env.WEB_APP_URL}?lang=${lang}&id=${u.userId}`;
    let btns = [
        [u.isVerified ? Markup.button.webApp(t.vip_signal, webUrl) : Markup.button.callback(t.signal, 'get_signal')],
        [Markup.button.callback(t.terms, 'show_terms'), Markup.button.callback(t.guide, 'show_guide')],
        [Markup.button.url(t.apps, 'https://t.me/apple_ilovalar'), Markup.button.callback(t.ref, 'ref_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

const getJoinMenu = async (lang) => {
    const t = i18n[lang] || i18n.uz;
    const channels = await Config.find({ key: 'channel' });
    const btns = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
    btns.push([Markup.button.callback(t.check, 'check_sub')]);
    return Markup.inlineKeyboard(btns);
};

// --- HANDLERS ---
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true });
    return ctx.reply("🌐 Tilni tanlang / Язык / Language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]
    ]));
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        return ctx.editMessageText(i18n[lang].sub_req, await getJoinMenu(lang));
    }
    ctx.editMessageText(`<b>RICHI28 APPLE</b> ${i18n[lang].welcome}`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('check_sub', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (await canAccess(ctx)) return ctx.editMessageText(i18n[u.lang].verified, getMainMenu(u, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery(i18n[u.lang].no_sub, { show_alert: true });
});

bot.action('get_signal', async (ctx) => {
    if (!(await canAccess(ctx))) return;
    const u = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `select_app_${a.name}`)]);
    btns.push([Markup.button.callback(i18n[u.lang].back, 'back_home')]);
    ctx.editMessageText(i18n[u.lang].platform, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^select_app_(.+)$/, async (ctx) => {
    if (!(await canAccess(ctx))) return;
    ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'input_id';
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].input_id, Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'get_signal')]]));
});

// MULTI-STEP VERIFICATION IMITATION
bot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    if (ctx.session.step === 'input_id' && /^\d+$/.test(ctx.message.text)) {
        if (!(await canAccess(ctx))) return ctx.reply("Avval obuna bo'ling!");
        ctx.session.step = null;
        const u = await User.findOne({ userId: uid });
        const msg = await ctx.reply("🔍 Searching ID in database...");
        setTimeout(() => ctx.telegram.editMessageText(uid, msg.message_id, null, "🔄 Checking Promo Code (RICHI28)..."), 2500);
        setTimeout(() => ctx.telegram.editMessageText(uid, msg.message_id, null, "📡 Connecting to Bukmeker Server..."), 5000);
        setTimeout(() => {
            ctx.telegram.editMessageText(uid, msg.message_id, null, "✅ Data matched! Waiting for Admin approval.");
            bot.telegram.sendMessage(ADMIN_ID, `🆔 ID: <code>${ctx.message.text}</code>\n👤: ${ctx.from.first_name}`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `confirm_${uid}`), Markup.button.callback('❌ Reject', `reject_${uid}`)]]) });
        }, 7500);
        return;
    }
    if (ctx.session.step === 'input_id') return ctx.reply("Numbers only!");
});

// --- ADMIN PANEL ---
bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText(`🛠 <b>ADMIN PANEL</b>`, Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc_menu')],
        [Markup.button.callback('🔗 Kanallar', 'a_ch_man'), Markup.button.callback('📱 Ilovalar', 'a_app_man')],
        [Markup.button.callback('🔙 Chiqish', 'back_home')]
    ]));
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    const today = await User.countDocuments({ joinedAt: { $gte: new Date().setHours(0,0,0,0) } });
    const uz = await User.countDocuments({ lang: 'uz' });
    const ru = await User.countDocuments({ lang: 'ru' });
    const en = await User.countDocuments({ lang: 'en' });
    ctx.editMessageText(`📊 <b>STATISTIKA</b>\n\n👥 Jami: ${total}\n✅ VIP: ${verified}\n🆕 Bugun: ${today}\n\n🇺🇿 UZ: ${uz} | 🇷🇺 RU: ${ru} | 🇬🇧 EN: ${en}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]]));
});

bot.action('a_bc_menu', (ctx) => {
    ctx.editMessageText("Reklama filtri:", Markup.inlineKeyboard([
        [Markup.button.callback("🌍 Hammaga", "bc_all")],
        [Markup.button.callback("🇺🇿 UZ", "bc_uz"), Markup.button.callback("🇷🇺 RU", "bc_ru"), Markup.button.callback("🇬🇧 EN", "bc_en")],
        [Markup.button.callback("🔙", 'admin_main')]
    ]));
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
bot.action('add_ch', (ctx) => { ctx.session.step = 'ch_n'; ctx.reply("Kanal nomi:"); });
bot.action('add_app', (ctx) => { ctx.session.step = 'app_n'; ctx.reply("Ilova nomi:"); });

// --- BUTTON ACTIONS ---
bot.action('show_terms', async (ctx) => { if (!(await canAccess(ctx))) return; const u = await User.findOne({userId: ctx.from.id}); ctx.editMessageText(i18n[u.lang].terms_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'back_home')]]) }); });
bot.action('show_guide', async (ctx) => { if (!(await canAccess(ctx))) return; const u = await User.findOne({userId: ctx.from.id}); ctx.editMessageText(i18n[u.lang].guide_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'back_home')]]) }); });
bot.action('back_home', async (ctx) => { if (!(await canAccess(ctx))) return; const u = await User.findOne({userId: ctx.from.id}); ctx.editMessageText(`<b>RICHI28 APPLE</b>`, { parse_mode: 'HTML', ...getMainMenu(u, ctx.from.id === ADMIN_ID) }); });
bot.action('ref_menu', async (ctx) => { if (!(await canAccess(ctx))) return; const u = await User.findOne({userId: ctx.from.id}); const link = `https://t.me/${ctx.botInfo.username}?start=${u.userId}`; ctx.editMessageText(i18n[u.lang].ref_text(u.referralCount, u.refTask, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'back_home')]]) }); });

bot.action(/^confirm_(\d+)$/, async (ctx) => { if (ctx.from.id !== ADMIN_ID) return; await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true }); bot.telegram.sendMessage(ctx.match[1], "✅ VIP UNLOCKED!"); ctx.editMessageText("✅ Confirmed!"); });
bot.action(/^reject_(\d+)$/, (ctx) => ctx.editMessageText("❌ Rejected!"));

bot.on(['photo', 'video', 'animation', 'document'], async (ctx) => {
    if (ctx.from.id === ADMIN_ID && ctx.session.step === 'bc_media') {
        const filter = ctx.session.bcTarget === 'all' ? {} : { lang: ctx.session.bcTarget };
        const users = await User.find(filter);
        ctx.reply("⏳ Tarqatilmoqda...");
        let c = 0; for (let u of users) { try { await ctx.copyMessage(u.userId); c++; } catch (e) {} }
        ctx.session.step = null; ctx.reply(`✅ Yetkazildi: ${c}`);
    }
});

bot.on('chat_join_request', async (ctx) => { await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true }); });

async function seedApps() { const defaultApps = ['1XBET', 'LINEBET']; for (const a of defaultApps) { const exists = await Config.findOne({ key: 'app', name: a }); if (!exists) await Config.create({ key: 'app', name: a }); } }

bot.launch().then(() => console.log('🚀 RICHI28 ULTIMATE LIVE'));
const app = express(); app.get('/', (req, res) => res.send('Online')); app.listen(process.env.PORT || 3000);
