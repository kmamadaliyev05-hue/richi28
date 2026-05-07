const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    bookmaker: String,
    gameId: String,
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, default: null },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, // Kanal nomi
    chatId: String, // -100...
    url: String // https://t.me/...
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

// --- HELPERS ---
const isAdmin = (ctx) => ctx.from && ctx.from.id === ADMIN_ID;

async function checkSub(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const isSub = ['member', 'administrator', 'creator'].includes(member.status);
            if (isSub) return true;
        } catch (e) {
            const user = await User.findOne({ userId: ctx.from.id });
            if (user?.status === 'requested') return true;
        }
    }
    return false;
}

const getMainMenu = (ctx, isVerified) => {
    const buttons = [
        [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
        [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 REFERAL SILKA', 'referral_menu')]
    ];
    if (isAdmin(ctx)) buttons.push([Markup.button.callback('🛠 ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(buttons);
};

// 3. MAIN LOGIC
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, username, referredBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
        }
    }

    await ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!`, getMainMenu(ctx, user.isVerified));
});

// SIGNAL OLISH
bot.action('get_signal', async (ctx) => {
    const isSub = await checkSub(ctx);
    if (!isSub) {
        const channels = await Config.find({ key: 'force_channel' });
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.url)]);
        buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
        
        return ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignal olish uchun kanalimizga a'zo bo'ling yoki zayavka yuboring:", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
    }

    await ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('1XBET', 'setup_1xbet'), Markup.button.callback('LINEBET', 'setup_linebet')],
            [Markup.button.callback('WINWIN', 'setup_winwin'), Markup.button.callback('888STARZ', 'setup_888starz')],
            [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
        ])
    });
});

bot.action(/^setup_(.+)$/, async (ctx) => {
    ctx.session.book = ctx.match[1].toUpperCase();
    ctx.session.step = 'await_id';
    await ctx.editMessageText(
        `📌 <b>SHARTLAR (${ctx.session.book}):</b>\n\n` +
        `1. <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n` +
        `2. Depozit: 60,000 so'm / 5$ / 400₽.\n\n` +
        `🆔 <b>ID raqamingizni yuboring:</b>`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]) }
    );
});

// TEXT HANDLER
bot.on('text', async (ctx, next) => {
    if (isAdmin(ctx) && ctx.session.step !== 'await_id') return next();

    if (ctx.session.step === 'await_id') {
        const idText = ctx.message.text;
        if (!/^\d+$/.test(idText)) return ctx.reply("❌ Faqat raqam yuboring!");

        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: idText, bookmaker: ctx.session.book, status: 'id_submitted' });
        await ctx.reply("⏳ <b>ID yuborildi!</b>\n15-30 daqiqa ichida tasdiqlaymiz.");

        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>YANGI ID:</b>\n\nID: <code>${idText}</code>\nPlatforma: ${ctx.session.book}`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `verify_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `reject_${ctx.from.id}`)]
        ]));
        ctx.session.step = null;
    }
});

// REFERAL
bot.action('referral_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.editMessageText(
        `🔗 <b>Sizning silkangiz:</b>\n<code>${link}</code>\n\n👥 Do'stlar: ${user.referralCount} ta\n🎯 Vazifa: ${user.refTask} ta`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('💰 Pul yechish', 'withdraw')], [Markup.button.callback('🔙 Orqaga', 'back_to_main')]]) }
    );
});

bot.action('withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const nextTask = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: nextTask, referralCount: 0 });
        await ctx.answerCbQuery(`✅ Vazifa bajarildi! Keyingisi: ${nextTask} ta.`, { show_alert: true });
        await bot.telegram.sendMessage(ADMIN_ID, `💰 <b>PUL YECHISH SO'ROVI:</b>\nUser: ${user.firstName}\nID: ${user.userId}`);
    } else {
        await ctx.answerCbQuery(`Yana ${user.refTask - user.referralCount} ta odam qo'shing!`, { show_alert: true });
    }
});

// ADMIN PANEL
bot.action('admin_main', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.editMessageText("🛠 <b>Admin Panel:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 REKLAMA', 'admin_broadcast')],
            [Markup.button.callback('📡 KANALLAR', 'manage_channels')],
            [Markup.button.callback('📊 STATISTIKA', 'admin_stats')],
            [Markup.button.callback('🔙 ORQAGA', 'back_to_main')]
        ])
    });
});

bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, { parse_mode: 'HTML', ...getMainMenu(ctx, user.isVerified) });
});

bot.action(/^verify_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 <b>VIP signallar ochildi!</b> /start bosing.");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

// SERVER
bot.launch().then(() => console.log('🚀 BOT LIVE'));
const app = express();
app.get('/', (req, res) => res.send('Active'));
app.listen(process.env.PORT || 3000);

const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR BAZASI
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    bookmaker: String,
    gameId: String,
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 }, // 5-4-3-2-1 vazifasi
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, // Kanal nomi
    chatId: String, // -100...
    url: String // Link
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

// --- HELPERS ---
const isAdmin = (ctx) => ctx.from && ctx.from.id === ADMIN_ID;

async function checkSub(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const isSub = ['member', 'administrator', 'creator'].includes(member.status);
            if (isSub) return true;
        } catch (e) {
            const user = await User.findOne({ userId: ctx.from.id });
            if (user?.status === 'requested') return true;
        }
    }
    return false;
}

const getMainMenu = (ctx, isVerified) => {
    const buttons = [
        [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
        [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 REFERAL SILKA', 'referral_menu')]
    ];
    if (isAdmin(ctx)) buttons.push([Markup.button.callback('🛠 ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(buttons);
};

// 3. MAIN LOGIC
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, referredBy: refId });
        if (refId && refId !== id) await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }
    await ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!`, getMainMenu(ctx, user.isVerified));
});

// SIGNAL OLISH FUNNEL
bot.action('get_signal', async (ctx) => {
    if (!(await checkSub(ctx))) {
        const channels = await Config.find({ key: 'force_channel' });
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.url)]);
        buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
        return ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignal olish uchun kanalga a'zo bo'ling:", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    }
    await ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('1XBET', 'setup_1xbet'), Markup.button.callback('LINEBET', 'setup_linebet')],
            [Markup.button.callback('WINWIN', 'setup_winwin'), Markup.button.callback('888STARZ', 'setup_888starz')],
            [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
        ])
    });
});

bot.action(/^setup_(.+)$/, async (ctx) => {
    ctx.session.book = ctx.match[1].toUpperCase();
    ctx.session.step = 'await_id';
    await ctx.editMessageText(`🆔 <b>${ctx.session.book} ID raqamingizni yuboring:</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]) });
});

bot.on('text', async (ctx, next) => {
    if (ctx.session.step === 'await_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("❌ Faqat raqam!");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.book, status: 'id_submitted' });
        ctx.session.step = null;
        await ctx.reply("⏳ <b>ID yuborildi!</b> Tasdiqlash kutilmoqda.");
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>YANGI ID:</b> <code>${ctx.message.text}</code>\nPlatforma: ${ctx.session.book}`, Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`)]]));
        return;
    }
    if (isAdmin(ctx)) return next();
});

// REFERAL & WITHDRAW
bot.action('referral_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.editMessageText(`🔗 Link: <code>${link}</code>\n👥 Do'stlar: ${user.referralCount}\n🎯 Vazifa: ${user.refTask} ta`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('💰 Pul yechish', 'withdraw')], [Markup.button.callback('🔙 Orqaga', 'back_to_main')]]) });
});

bot.action('withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const nextTask = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: nextTask, referralCount: 0 });
        await ctx.answerCbQuery(`✅ Vazifa bajarildi! Keyingisi: ${nextTask} ta.`, { show_alert: true });
    } else await ctx.answerCbQuery(`Yana ${user.refTask - user.referralCount} ta odam qo'shing!`, { show_alert: true });
});

bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, { parse_mode: 'HTML', ...getMainMenu(ctx, user.isVerified) });
});

bot.action(/^v_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 <b>VIP signallar ochildi!</b>");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

// ADMIN PANEL TUGMASI (Logikani boyitish uchun)
bot.action('admin_main', (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.editMessageText("🛠 <b>Admin Panel:</b>", Markup.inlineKeyboard([[Markup.button.callback('📊 Statistika', 'a_stats')], [Markup.button.callback('📡 Kanallar', 'manage_channels')], [Markup.button.callback('🔙 Orqaga', 'back_to_main')]]));
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    await ctx.answerCbQuery(`Jami a'zolar: ${total}`, { show_alert: true });
});

bot.launch().then(() => console.log('🚀 RICHI28 APPLE LIVE'));
const app = express();
app.listen(process.env.PORT || 3000);
