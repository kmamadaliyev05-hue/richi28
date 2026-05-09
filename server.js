const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI & SCHEMA
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ MongoDB Connected: Security System Active');
    seedApps(); 
});

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    hackerId: { type: String, unique: true }, 
    firstName: String,
    lang: { type: String, default: 'uz' },
    isVerified: { type: Boolean, default: false },
    rank: { type: String, default: 'NEWBIE' }, 
    insurance: { type: Boolean, default: false },
    accuracy: { type: Number, default: 45 },
    referralCount: { type: Number, default: 0 },
    referredBy: Number,
    accounts: [{ bookmaker: String, gameId: String, status: String }], 
    lastBonus: { type: Date, default: new Date(0) },
    status: { type: String, default: 'new' },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}, { autoIndex: false }));

// --- LUG'AT (Tuzatilgan va to'ldirilgan) ---
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
        input_id: (app) => `🆔 [${app}] uchun ID yuboring (faqat raqam):`,
        back: "🔙 Orqaga",
        no_sub: "❌ Obuna yoki so'rov topilmadi!",
        verified: "✅ Tasdiqlandi!",
        ref_text: (count, link) => `👥 <b>Referal tizimi</b>\n\n📊 Odamlar: <b>${count}</b> ta\n\n🔗 Havolangiz:\n<code>${link}</code>`,
        searching: "🔍 ID bazadan qidirilmoqda...",
        checking_promo: "🔄 Promokod tekshirilmoqda (RICHI28)...",
        matched: "✅ Ma'lumotlar mos keldi! Admin tasdiqlashini kuting."
    },
    ru: {
        welcome: "добро пожаловать в систему!",
        sub_req: "Для использования бота подпишитесь на каналы:",
        check: "✅ Проверить",
        signal: "🚀 Получить сигнал",
        vip_signal: "⚡️ Получить сигнал (VIP)",
        apps: "📱 Приложения",
        ref: "👥 Рефералка",
        guide: "📖 Инструкция",
        terms: "📜 Условия",
        platform: "🎯 <b>Выберите платформу:</b>",
        input_id: (app) => `🆔 Отправьте ID для [${app}]:`,
        back: "🔙 Назад",
        no_sub: "❌ Подписка не найдена!",
        verified: "✅ Подтверждено!"
    },
    en: {
        welcome: "welcome to the system!",
        sub_req: "Subscribe to the channels to use the bot:",
        check: "✅ Check",
        signal: "🚀 Get Signal",
        vip_signal: "⚡️ Get Signal (VIP)",
        apps: "📱 Apps",
        ref: "👥 Referral link",
        guide: "📖 Guide",
        terms: "📜 Terms",
        platform: "🎯 <b>Select platform:</b>",
        input_id: (app) => `🆔 Send ID for [${app}]:`,
        back: "🔙 Back",
        no_sub: "❌ Subscription not found!",
        verified: "✅ Verified!"
    }
};

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
            await User.findOneAndUpdate({ userId: uid }, { isVerified: false, status: 'new' });
        }
        return false;
    }
    return true;
}

const getMainMenu = (u, isAdmin) => {
    const lang = u.lang || 'uz';
    const t = i18n[lang];
    const webUrl = `${process.env.WEB_APP_URL}?lang=${lang}&id=${u.hackerId}&refs=${u.referralCount}`;
    let btns = [
        [u.isVerified ? Markup.button.webApp(t.vip_signal, webUrl) : Markup.button.callback(t.signal, 'get_signal')],
        [Markup.button.callback(t.ref, 'ref_menu'), Markup.button.callback("👤 PROFIL", 'my_profile')],
        [Markup.button.callback(t.terms, 'show_terms'), Markup.button.callback(t.guide, 'show_guide')],
        [Markup.button.url(t.apps, 'https://t.me/apple_ilovalar')]
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
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ 
            userId: id, 
            firstName: first_name, 
            hackerId: generateHackerId(),
            referredBy: refId
        });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
        }
    }
    
    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык / 🇬🇧 Lang:", 
        Markup.inlineKeyboard([[Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]]));
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        return ctx.editMessageText(i18n[lang].sub_req, await getJoinMenu(lang));
    }
    ctx.editMessageText(`<b>RICHI28 APPLE</b> ${i18n[lang].welcome}\n🆔 ID: <code>${user.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('check_sub', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (await canAccess(ctx)) return ctx.editMessageText(i18n[u.lang].verified, getMainMenu(u, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery(i18n[u.lang].no_sub, { show_alert: true });
});

// --- PROFILE ---
bot.action('my_profile', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const portfolio = u.accounts.length > 0 ? u.accounts.map(a => `\n└ ${a.bookmaker}: <code>${a.gameId}</code> ✅`).join('') : " Bo'sh";
    const text = `👤 <b>HACKER PROFILI</b>\n\n🆔 ID: <code>${u.hackerId}</code>\n📊 DARAJA: <b>${u.rank}</b>\n📈 ANIQLIK: <b>${u.accuracy}%</b>\n👥 REFERALLAR: <b>${u.referralCount} ta</b>\n📂 PORTFOLIO: ${portfolio}`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'back_home')]]) });
});

bot.action('ref_menu', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${u.userId}`;
    ctx.editMessageText(i18n[u.lang].ref_text(u.referralCount, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'back_home')]]) });
});

// --- SIGNALS ---
bot.action('get_signal', async (ctx) => {
    if (!(await canAccess(ctx))) return;
    const u = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `sel_app_${a.name}`)]);
    btns.push([Markup.button.callback(i18n[u.lang].back, 'back_home')]);
    ctx.editMessageText(i18n[u.lang].platform, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^sel_app_(.+)$/, async (ctx) => {
    ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'wait_id';
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].input_id(ctx.match[1]), Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'get_signal')]]));
});

bot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    if (ctx.session.step === 'wait_id' && /^\d+$/.test(ctx.message.text)) {
        ctx.session.step = null;
        const u = await User.findOne({ userId: uid });
        const app = ctx.session.selectedApp;
        const gameId = ctx.message.text;

        const msg = await ctx.reply(i18n[u.lang].searching);
        setTimeout(() => ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].checking_promo), 2000);
        setTimeout(() => {
            ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].matched);
            bot.telegram.sendMessage(ADMIN_ID, `🕵️‍♂️ <b>YANGI ID SO'ROVI</b>\n\n👤: ${ctx.from.first_name}\n🆔 HackerID: <code>${u.hackerId}</code>\n📱 Platforma: ${app}\n🔢 ID: <code>${gameId}</code>\n👥 Referallar: ${u.referralCount}`, 
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Ruxsat', `adm_v_${uid}_${app}_${gameId}`), Markup.button.callback('❌ Rad', `adm_r_${uid}`)]]) });
        }, 4000);
        return;
    }
});

// --- ADMIN COMMANDS ---
bot.action(/^adm_v_(\d+)_(.+)_(\d+)$/, async (ctx) => {
    const [_, targetId, app, gId] = ctx.match;
    await User.findOneAndUpdate({ userId: targetId }, { 
        isVerified: true, rank: 'PRO', accuracy: 85,
        $push: { accounts: { bookmaker: app, gameId: gId, status: 'active' } }
    });
    bot.telegram.sendMessage(targetId, "✅ <b>VIP TASDIQLANDI!</b>\n\nEndi Web App orqali signal olishingiz mumkin.", { parse_mode: 'HTML' });
    ctx.editMessageText("✅ Tasdiqlandi!");
});

bot.action(/^adm_r_(\d+)$/, (ctx) => ctx.editMessageText("❌ Rad etildi."));

bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    ctx.editMessageText(`🛠 <b>ADMIN PANEL</b>\n📊 Jami: ${total}`, Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc_menu')],
        [Markup.button.callback('🔗 Kanallar', 'a_ch_man'), Markup.button.callback('📱 Ilovalar', 'a_app_man')],
        [Markup.button.callback('🔙 Chiqish', 'back_home')]
    ]));
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    ctx.editMessageText(`📊 <b>STATISTIKA</b>\n\n👥 Jami: ${total}\n✅ VIP: ${verified}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]]));
});

bot.action('back_home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 APPLE</b>`, { parse_mode: 'HTML', ...getMainMenu(u, ctx.from.id === ADMIN_ID) });
});

// --- BOILERPLATE (BC, Config, Apps) ---
bot.action('a_bc_menu', (ctx) => {
    ctx.editMessageText("Reklama maqsadi:", Markup.inlineKeyboard([
        [Markup.button.callback("🌍 Hammaga", "bc_all")],
        [Markup.button.callback("🔙", 'admin_main')]
    ]));
});

bot.action('bc_all', (ctx) => { ctx.session.step = 'bc_m'; ctx.reply("Media/Matn yuboring:"); });

bot.on(['photo', 'video', 'text', 'animation'], async (ctx) => {
    if (ctx.from.id === ADMIN_ID && ctx.session.step === 'bc_m') {
        ctx.session.step = null;
        const users = await User.find();
        ctx.reply("⏳ Tarqatish boshlandi...");
        for (let u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
        ctx.reply("✅ Tayyor!");
    }
});

bot.action('a_ch_man', async (ctx) => {
    const chs = await Config.find({ key: 'channel' });
    const btns = chs.map(c => [Markup.button.callback(`❌ ${c.name}`, `del_${c._id}`)]);
    btns.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('🔙', 'admin_main')]);
    ctx.editMessageText("🔗 KANALLAR", Markup.inlineKeyboard(btns));
});
bot.action('add_ch', (ctx) => { ctx.session.step = 'ch_n'; ctx.reply("Nomi:"); });
bot.action(/^del_(.+)$/, async (ctx) => { await Config.findByIdAndDelete(ctx.match[1]); ctx.editMessageText("O'chirildi.", Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]])); });

bot.on('chat_join_request', async (ctx) => { await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true }); });

async function seedApps() {
    const apps = ['1XBET', 'LINEBET', 'MELBET'];
    for (const a of apps) { if (!await Config.findOne({ key: 'app', name: a })) await Config.create({ key: 'app', name: a }); }
}

bot.launch().then(() => console.log('🚀 RICHI28 TITAN LIVE'));
const app = express(); app.get('/', (req, res) => res.send('System Online')); app.listen(process.env.PORT || 3000);
