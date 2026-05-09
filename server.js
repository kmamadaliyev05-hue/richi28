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
    rank: { type: String, default: 'NEWBIE' }, // NEWBIE, PRO, ELITE
    insurance: { type: Boolean, default: false },
    accuracy: { type: Number, default: 45 },
    referralCount: { type: Number, default: 0 },
    referredBy: Number,
    accounts: [{ bookmaker: String, gameId: String, status: String }], // Multi-Wallet Portfolio
    lastBonus: { type: Date, default: new Date(0) },
    status: { type: String, default: 'new' },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}));

// --- MULTI-LANG LUG'ATI ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz, agent!",
        sub_req: "⚠️ Kirish rad etildi! Operatsiyani davom ettirish uchun kanallarga obuna bo'ling:",
        check: "🔍 Obunani tekshirish",
        main_menu: "Asosiy operatsion menyu:",
        btn_signal: "🚀 SIGNAL OLISH (Web App)",
        btn_profile: "👤 HACKER PROFILI",
        btn_ref: "👥 VIRUS REFERAL",
        btn_academy: "📚 HACKER ACADEMY",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "🆘 SUPPORT (ADMIN)",
        btn_bonus: "🎁 KUNLIK BONUS",
        input_id: (app) => `🎯 [${app}] platformasi uchun ID raqamingizni kiriting:`,
        searching: "🔍 ID ma'lumotlar bazasidan qidirilmoqda...",
        checking_promo: "🔄 Promokod tekshirilmoqda (RICHI28)...",
        connecting: "📡 Bukmeker serveriga xavfsiz ulanish o'rnatilmoqda...",
        matched: "✅ Ma'lumotlar mos keldi! Admin tasdiqlashini kuting.",
        bonus_taken: "❌ Bugungi bonus olingan! 24 soatdan keyin qaytib keling.",
        bonus_win: (acc) => `🎁 Tabriklaymiz! Bugun sizga +${acc}% aniqlik kodi berildi.`,
        no_sub: "❌ Hali ham obuna topilmadi!",
        verified_msg: "✅ Tizim ochiq! Operatsiyani boshlashingiz mumkin."
    },
    ru: {
        welcome: "добро пожаловать в систему, агент!",
        sub_req: "⚠️ Доступ запрещен! Подпишитесь на каналы для продолжения:",
        check: "🔍 Проверить подписку",
        main_menu: "Главное меню операций:",
        btn_signal: "🚀 ПОЛУЧИТЬ СИГНАЛ (Web App)",
        btn_profile: "👤 ПРОФИЛЬ ХАКЕРА",
        btn_ref: "👥 ВИРУСНЫЙ РЕФЕРАЛ",
        btn_academy: "📚 АКАДЕМИЯ ХАКЕРА",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "🆘 ПОДДЕРЖКА",
        btn_bonus: "🎁 ЕЖЕДНЕВНЫЙ БОНУС",
        input_id: (app) => `🎯 Введите ваш ID для платформы [${app}]:`,
        searching: "🔍 Поиск ID в базе данных...",
        checking_promo: "🔄 Проверка промокода (RICHI28)...",
        connecting: "📡 Установка безопасного соединения...",
        matched: "✅ Данные совпали! Ожидайте подтверждения.",
        bonus_taken: "❌ Бонус уже получен! Приходите завтра.",
        bonus_win: (acc) => `🎁 Поздравляем! Вам начислено +${acc}% к точности.`,
        no_sub: "❌ Подписка не найдена!",
        verified_msg: "✅ Система разблокирована!"
    },
    en: {
        welcome: "welcome to the system, agent!",
        sub_req: "⚠️ Access Denied! Subscribe to channels to proceed:",
        check: "🔍 Check Subscription",
        main_menu: "Main Operational Menu:",
        btn_signal: "🚀 GET SIGNAL (Web App)",
        btn_profile: "👤 HACKER PROFILE",
        btn_ref: "👥 VIRAL REFERRAL",
        btn_academy: "📚 HACKER ACADEMY",
        btn_settings: "🛠 SETTINGS",
        btn_support: "🆘 SUPPORT",
        btn_bonus: "🎁 DAILY BONUS",
        input_id: (app) => `🎯 Enter your ID for [${app}] platform:`,
        searching: "🔍 Searching ID in database...",
        checking_promo: "🔄 Checking Promo Code (RICHI28)...",
        connecting: "📡 Establishing secure connection...",
        matched: "✅ Data matched! Wait for admin approval.",
        bonus_taken: "❌ Bonus already taken! Come back tomorrow.",
        bonus_win: (acc) => `🎁 Congrats! You got +${acc}% accuracy boost.`,
        no_sub: "❌ Subscription not found!",
        verified_msg: "✅ System access granted!"
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

const getMainMenu = (u) => {
    const t = i18n[u.lang || 'uz'];
    const webUrl = `${process.env.WEB_APP_URL}?lang=${u.lang}&id=${u.hackerId}&refs=${u.referralCount}`;
    return Markup.inlineKeyboard([
        [Markup.button.webApp(t.btn_signal, webUrl)],
        [Markup.button.callback(t.btn_profile, 'my_profile'), Markup.button.callback(t.btn_ref, 'ref_menu')],
        [Markup.button.callback(t.btn_bonus, 'get_bonus')],
        [Markup.button.callback(t.btn_academy, 'academy'), Markup.button.callback(t.btn_settings, 'settings')],
        [Markup.button.url(t.btn_support, `tg://user?id=${ADMIN_ID}`)]
    ]);
};

// --- START & SETUP ---
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
    
    return ctx.reply("🌐 Select System Language / Tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]
    ]));
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        const channels = await Config.find({ key: 'channel' });
        const btns = channels.map(c => [Markup.button.url(`📢 ${c.name}`, c.url)]);
        btns.push([Markup.button.callback(i18n[lang].check, 'check_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(`<b>RICHI28 TITAN</b> ${i18n[lang].welcome}\n\n🆔 Agent ID: <code>${user.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(user) });
});

// --- PROFILE & PORTFOLIO ---
bot.action('my_profile', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const t = i18n[u.lang];
    const portfolio = u.accounts.length > 0 ? u.accounts.map(a => `\n   └ ${a.bookmaker}: <code>${a.gameId}</code> [${a.status === 'active' ? '✅' : '⏳'}]`).join('') : " Bo'sh";
    
    const text = `👤 <b>HACKER PROFILI</b>\n\n` +
                 `🆔 <b>ID:</b> <code>${u.hackerId}</code>\n` +
                 `📊 <b>DARAJA:</b> ${u.rank === 'ELITE' ? '🥇 ELITE' : u.rank === 'PRO' ? '🥈 PRO' : '🥉 NEWBIE'}\n` +
                 `📈 <b>ANIQLIK:</b> ${u.accuracy}%\n` +
                 `🛡 <b>SUG'URTA:</b> ${u.insurance ? '✅ FAOL' : '❌ FAOL EMAS'}\n` +
                 `👥 <b>REFERALLAR:</b> ${u.referralCount} ta\n` +
                 `📂 <b>PORTFOLIO:</b>${portfolio}\n\n` +
                 `⚠️ <i>VIP status uchun RICHI28 promokodi bilan minimal 60,000 so'm depozit kerak.</i>`;

    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback("➕ ID QO'SHISH / O'ZGARTIRISH", 'get_signal')],
        [Markup.button.callback("🔙 ORQAGA", 'back_home')]
    ])});
});

// --- VIRUS REFERRAL ---
bot.action('ref_menu', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${u.userId}`;
    const text = `👥 <b>VIRUS REFERAL TIZIMI</b>\n\n` +
                 `Loyihani do'stlarga tarqating va admin tasdiqlashisiz VIP statusga ega bo'ling!\n\n` +
                 `📊 Sizning referallaringiz: <b>${u.referralCount}</b> ta\n` +
                 `🎁 <b>3 ta referal</b> = PRO Rank\n` +
                 `🥇 <b>10 ta referal</b> = ELITE Rank + 99% Aniqlik\n\n` +
                 `🔗 Havolangiz:\n<code>${link}</code>`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 ORQAGA", 'back_home')]])});
});

// --- DAILY BONUS ---
bot.action('get_bonus', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const now = new Date();
    if (now - u.lastBonus < 24 * 60 * 60 * 1000) {
        return ctx.answerCbQuery(i18n[u.lang].bonus_taken, { show_alert: true });
    }
    const addAcc = Math.floor(Math.random() * 5) + 1;
    await User.findOneAndUpdate({ userId: ctx.from.id }, { $inc: { accuracy: addAcc }, lastBonus: now });
    ctx.answerCbQuery(i18n[u.lang].bonus_win(addAcc), { show_alert: true });
});

// --- MULTI-WALLET & ID HANDLING ---
bot.action('get_signal', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `sel_app_${a.name}`)]);
    btns.push([Markup.button.callback("🔙 ORQAGA", 'back_home')]);
    ctx.editMessageText("🎯 Signal olish uchun platformani tanlang:", Markup.inlineKeyboard(btns));
});

bot.action(/^sel_app_(.+)$/, async (ctx) => {
    ctx.session.selectedApp = ctx.match[1];
    ctx.session.step = 'wait_id';
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].input_id(ctx.match[1]), Markup.inlineKeyboard([[Markup.button.callback("🔙", 'get_signal')]]));
});

bot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    const u = await User.findOne({ userId: uid });
    if (!u) return;

    if (ctx.session.step === 'wait_id' && /^\d+$/.test(ctx.message.text)) {
        const gameId = ctx.message.text;
        const app = ctx.session.selectedApp;
        ctx.session.step = null;
        
        const msg = await ctx.reply(i18n[u.lang].searching);
        setTimeout(() => ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].checking_promo), 2000);
        setTimeout(() => ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].connecting), 4000);
        setTimeout(async () => {
            ctx.telegram.editMessageText(uid, msg.message_id, null, i18n[u.lang].matched);
            
            // Super Admin Notification with History
            const history = u.accounts.map(a => `${a.bookmaker}: ${a.gameId}`).join(', ') || 'Yo\'q';
            bot.telegram.sendMessage(ADMIN_ID, 
                `🕵️‍♂️ <b>ID TASDIQLASH SO'ROVI</b>\n\n` +
                `👤 User: <b>${ctx.from.first_name}</b> (@${ctx.from.username || 'yoq'})\n` +
                `🆔 Hacker ID: <code>${u.hackerId}</code>\n\n` +
                `📱 Platforma: <b>${app}</b>\n` +
                `🔢 Yangi ID: <code>${gameId}</code>\n\n` +
                `📊 Tarix: <b>${u.accounts.length} ta ID</b>\n` +
                `📂 Portfolio: <i>${history}</i>\n` +
                `👥 Referallar: <b>${u.referralCount} ta</b>`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Ruxsat berish', `adm_verify_${uid}_${app}_${gameId}`)],
                    [Markup.button.callback('❌ Rad etish', `adm_reject_${uid}`)]
                ])}
            );
        }, 6500);
        return;
    }
});

// --- ADMIN COMMANDS & CONTROL ---
bot.action(/^adm_verify_(\d+)_(.+)_(\d+)$/, async (ctx) => {
    const [_, targetId, app, gId] = ctx.match;
    const target = await User.findOne({ userId: targetId });
    
    // Multi-wallet update: if exists, update; else push
    const exists = target.accounts.find(a => a.bookmaker === app);
    if (exists) {
        await User.updateOne({ userId: targetId, "accounts.bookmaker": app }, { $set: { "accounts.$.gameId": gId, "accounts.$.status": 'active' } });
    } else {
        await User.updateOne({ userId: targetId }, { $push: { accounts: { bookmaker: app, gameId: gId, status: 'active' } } });
    }

    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true, rank: target.referralCount >= 10 ? 'ELITE' : 'PRO', accuracy: target.referralCount >= 10 ? 99 : 85 });
    
    bot.telegram.sendMessage(targetId, "✅ <b>TIZIM TASDIQLANDI!</b>\n\nSizning Portfolio yangilandi. Web App orqali signal olishingiz mumkin.", { parse_mode: 'HTML' });
    ctx.editMessageText(`✅ Agent ${targetId} tasdiqlandi!`);
});

bot.action(/^adm_reject_(\d+)$/, (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "❌ <b>ID RAD ETILDI!</b>\n\nIltimos, RICHI28 promokodi bilan ro'yxatdan o'tganingizni va depozit qilganingizni tekshiring.", { parse_mode: 'HTML' });
    ctx.editMessageText("❌ Rad etildi.");
});

bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText(`🛠 <b>SUPER ADMIN PANEL</b>`, Markup.inlineKeyboard([
        [Markup.button.callback('📊 Global Stats', 'a_stats'), Markup.button.callback('📢 Smart BC', 'a_bc_menu')],
        [Markup.button.callback('🚦 Accuracy Control', 'a_acc'), Markup.button.callback('🔗 Channels/Apps', 'a_config')],
        [Markup.button.callback('🔙 Chiqish', 'back_home')]
    ]));
});

// --- SYSTEM ACTIONS ---
bot.action('check_sub', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (await canAccess(ctx)) return ctx.editMessageText(i18n[u.lang].verified_msg, getMainMenu(u));
    await ctx.answerCbQuery(i18n[u.lang].no_sub, { show_alert: true });
});

bot.action('back_home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (!(await canAccess(ctx))) return ctx.editMessageText(i18n[u.lang].sub_req, await getJoinMenu(u.lang));
    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${u.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(u) });
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

async function seedApps() {
    const apps = ['1XBET', 'LINEBET', 'MELBET', 'MEGAPARI'];
    for (const a of apps) {
        const exists = await Config.findOne({ key: 'app', name: a });
        if (!exists) await Config.create({ key: 'app', name: a });
    }
}

bot.launch().then(() => console.log('🚀 RICHI28 TITAN ENGINE ONLINE'));
const app = express(); app.get('/', (req, res) => res.send('Titan System Online')); app.listen(process.env.PORT || 3000);
