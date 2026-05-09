const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI & SCHEMA (Hech narsa o'chmadi, faqat qo'shildi)
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ RICHI28 TITAN ENGINE ONLINE');
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

// --- MULTI-LANG LUG'ATI (Professional darajada) ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz!",
        sub_req: "Botdan foydalanish uchun kanallarga a'zo bo'ling:",
        check: "✅ Tekshirish",
        btn_signal: "🚀 SIGNAL OLISH (Web App)",
        btn_profile: "👤 PROFIL",
        btn_ref: "👥 YO'LLANMA SILKA",
        btn_academy: "📚 ACADEMY",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "🆘 SUPPORT",
        btn_bonus: "🎁 BONUS",
        btn_terms: "📜 Shartlar",
        input_id: (app) => `🆔 [${app}] uchun ID yuboring (faqat raqam):`,
        searching: "🔍 ID bazadan qidirilmoqda...",
        checking_promo: "🔄 Promokod tekshirilmoqda (RICHI28)...",
        matched: "✅ Ma'lumotlar mos keldi! Admin tasdiqlashini kuting.",
        verified: "✅ Tasdiqlandi!",
        no_sub: "❌ Obuna topilmadi!",
        bonus_msg: (acc) => `🎁 Tabriklaymiz! Bugun sizga +${acc}% aniqlik kodi berildi.`
    },
    ru: {
        welcome: "в систему!",
        sub_req: "Подпишитесь на каналы:",
        check: "✅ Проверить",
        btn_signal: "🚀 ПОЛУЧИТЬ СИГНАЛ (Web App)",
        btn_profile: "👤 ПРОФИЛЬ",
        btn_ref: "👥 РЕФЕРАЛКА",
        btn_academy: "📚 АКАДЕМИЯ",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "🆘 ПОДДЕРЖКА",
        btn_bonus: "🎁 БОНУС",
        btn_terms: "📜 Условия",
        input_id: (app) => `🆔 Отправьте ID для [${app}]:`,
        searching: "🔍 Поиск ID в базе...",
        checking_promo: "🔄 Проверка промокода (RICHI28)...",
        matched: "✅ Данные совпали! Ожидайте подтверждения."
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
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            if (!['member', 'administrator', 'creator'].includes(member.status)) return false;
        } catch (e) { continue; }
    }
    return true;
}

const getMainMenu = (u, isAdmin) => {
    const lang = u.lang || 'uz';
    const t = i18n[lang];
    const webUrl = `${process.env.WEB_APP_URL}?lang=${lang}&id=${u.hackerId}&refs=${u.referralCount}`;
    let btns = [
        [Markup.button.webApp(t.btn_signal, webUrl)],
        [Markup.button.callback(t.btn_profile, 'my_profile'), Markup.button.callback(t.btn_ref, 'ref_menu')],
        [Markup.button.callback(t.btn_bonus, 'get_bonus')],
        [Markup.button.callback(t.btn_academy, 'academy'), Markup.button.callback(t.btn_settings, 'settings')],
        [Markup.button.url(t.btn_support, `tg://user?id=${ADMIN_ID}`)]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
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
    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru")]
    ]));
});

bot.action(/^set_(uz|ru)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        const channels = await Config.find({ key: 'channel' });
        const btns = channels.map(c => [Markup.button.url(`📢 ${c.name}`, c.url)]);
        btns.push([Markup.button.callback(i18n[lang].check, 'check_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(`<b>RICHI28 TITAN</b> ${i18n[lang].welcome}\n\n🆔 Agent ID: <code>${user.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('check_sub', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (await canAccess(ctx)) return ctx.editMessageText(i18n[u.lang].verified, getMainMenu(u, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery(i18n[u.lang].no_sub, { show_alert: true });
});

// --- PROFILE & REFS ---
bot.action('my_profile', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const portfolio = u.accounts.map(a => `\n└ ${a.bookmaker}: <code>${a.gameId}</code> ✅`).join('') || " Bo'sh";
    const text = `👤 <b>HACKER PROFILI</b>\n\n🆔 ID: <code>${u.hackerId}</code>\n📊 DARAXA: <b>${u.rank}</b>\n📈 ANIQLIK: <b>${u.accuracy}%</b>\n🛡 SUG'URTA: <b>${u.insurance ? '✅ FAOL' : '❌ FAOL EMAS'}</b>\n👥 REFERALLAR: <b>${u.referralCount} ta</b>\n📂 PORTFOLIO:${portfolio}\n\n⚠️ <i>VIP status uchun RICHI28 promokodi bilan minimal 60,000 so'm depozit kerek.</i>`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("➕ ID QO'SHISH", 'get_signal')], [Markup.button.callback("🔙 ORQAGA", 'back_home')]]) });
});

bot.action('ref_menu', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${u.userId}`;
    ctx.editMessageText(`👥 <b>VIRUS REFERAL</b>\n\nDo'stlarni chaqiring va Rankni oshiring!\n\n📊 Referallar: ${u.referralCount}\n🔗 Link: <code>${link}</code>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 ORQAGA", 'back_home')]]) });
});

bot.action('get_bonus', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (new Date() - u.lastBonus < 86400000) return ctx.answerCbQuery("❌ Bonus olingan!", { show_alert: true });
    const add = Math.floor(Math.random() * 5) + 1;
    await User.findOneAndUpdate({ userId: u.userId }, { $inc: { accuracy: add }, lastBonus: new Date() });
    ctx.answerCbQuery(i18n[u.lang].bonus_msg(add), { show_alert: true });
});

// --- MULTI-WALLET & SIGNALS ---
bot.action('get_signal', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `sel_app_${a.name}`)]);
    btns.push([Markup.button.callback("🔙 ORQAGA", 'back_home')]);
    ctx.editMessageText("🎯 Platformani tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/^sel_app_(.+)$/, async (ctx) => {
    ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'wait_id';
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].input_id(ctx.match[1]), Markup.inlineKeyboard([[Markup.button.callback("🔙", 'get_signal')]]));
});

bot.on('text', async (ctx) => {
    if (ctx.session.step === 'wait_id' && /^\d+$/.test(ctx.message.text)) {
        const uid = ctx.from.id; const gameId = ctx.message.text; const app = ctx.session.selectedApp;
        ctx.session.step = null; const u = await User.findOne({ userId: uid });
        const msg = await ctx.reply(i18n[u.lang].searching);
        setTimeout(() => ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].checking_promo), 2000);
        setTimeout(() => {
            ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].matched);
            bot.telegram.sendMessage(ADMIN_ID, `🕵️‍♂️ <b>YANGI ID SO'ROVI</b>\n\n👤: ${ctx.from.first_name}\n🆔: <code>${u.hackerId}</code>\n📱: ${app}\n🔢: <code>${gameId}</code>\n👥 Refs: ${u.referralCount}`, 
                Markup.inlineKeyboard([[Markup.button.callback('✅ Ruxsat', `adm_v_${uid}_${app}_${gameId}`), Markup.button.callback('❌ Rad', `adm_r_${uid}`)]]));
        }, 4000);
        return;
    }
});

// --- ADMIN PANEL ---
bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText(`🛠 <b>ADMIN PANEL</b>`, Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc')],
        [Markup.button.callback('🔗 Kanallar', 'a_ch'), Markup.button.callback('🔙 Chiqish', 'back_home')]
    ]));
});

bot.action(/^adm_v_(\d+)_(.+)_(\d+)$/, async (ctx) => {
    const [_, targetId, app, gId] = ctx.match;
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true, rank: 'PRO', accuracy: 85, $push: { accounts: { bookmaker: app, gameId: gId, status: 'active' } } });
    bot.telegram.sendMessage(targetId, "✅ <b>TASDIQLANDI!</b>\nSignal olishingiz mumkin.");
    ctx.editMessageText("✅ Tasdiqlandi!");
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    ctx.editMessageText(`📊 Jami userlar: ${total}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]]));
});

bot.action('back_home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${u.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(u, ctx.from.id === ADMIN_ID) });
});

bot.on('chat_join_request', async (ctx) => { await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true }); });

async function seedApps() {
    const apps = ['1XBET', 'LINEBET', 'MELBET'];
    for (const a of apps) { if (!await Config.findOne({ key: 'app', name: a })) await Config.create({ key: 'app', name: a }); }
}

bot.launch();
const app = express(); app.get('/', (req, res) => res.send('Online')); app.listen(process.env.PORT || 3000);
