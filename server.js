const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, // Kanal nomi yoki linki
    chatId: String // Kanalning ID si (-100...)
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

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ MongoDB connected'));

// --- YORDAMCHI FUNKSIYALAR ---

async function checkSub(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const user = await User.findOne({ userId: ctx.from.id });
            const isSub = ['member', 'administrator', 'creator'].includes(member.status);
            if (!isSub && user?.status !== 'requested') return false;
        } catch (e) {
            const user = await User.findOne({ userId: ctx.from.id });
            if (user?.status !== 'requested') return false;
        }
    }
    return true;
}

const getMainMenu = (isVerified) => Markup.inlineKeyboard([
    [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
    [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
    [Markup.button.callback('👥 REFERAL SILKA', 'referral_menu')]
]);

// 3. MAIN LOGIC

bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    
    let user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true, new: true });
    
    if (user.joinedAt.getTime() === user.lastActive?.getTime() && refId && refId !== id) {
        await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }

    const isSub = await checkSub(ctx);
    if (!isSub) {
        const channels = await Config.find({ key: 'force_channel' });
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.url)]);
        buttons.push([Markup.button.callback('✅ Tekshirish', 'check_sub_status')]);
        return ctx.replyWithHTML(`⚠️ <b>Xush kelibsiz!</b>\n\nBotdan foydalanish uchun kanallarga a'zo bo'ling:`, Markup.inlineKeyboard(buttons));
    }

    await ctx.replyWithHTML(`<b>RICHI28 APPLE</b> professional tizimiga xush kelibsiz!`, getMainMenu(user.isVerified));
});

// Orqaga qaytish mantiqi (Barcha bo'limlar uchun)
bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, {
        parse_mode: 'HTML',
        ...getMainMenu(user.isVerified)
    });
});

// Majburiy obuna tekshirish tugmasi
bot.action('check_sub_status', async (ctx) => {
    const isSub = await checkSub(ctx);
    if (isSub) {
        const user = await User.findOne({ userId: ctx.from.id });
        return ctx.editMessageText("✅ Tasdiqlandi! Xush kelibsiz.", getMainMenu(user.isVerified));
    }
    await ctx.answerCbQuery("❌ Siz hali a'zo emassiz!", { show_alert: true });
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

// Signal olish Funnel
bot.action('get_signal', async (ctx) => {
    const isSub = await checkSub(ctx);
    if (!isSub) return ctx.answerCbQuery("Avval obuna bo'ling!", { show_alert: true });

    await ctx.editMessageText(`🎯 <b>Platformani tanlang:</b>`, {
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

// ID qabul qilish
bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID && ctx.session.step !== 'await_id') return next();

    if (ctx.session.step === 'await_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("❌ Faqat raqam yuboring!");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, status: 'id_submitted' });
        await ctx.reply("⏳ <b>ID yuborildi!</b>\n15-30 daqiqa ichida tasdiqlaymiz.");

        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>ID:</b> <code>${ctx.message.text}</code>\nPlatforma: ${ctx.session.book || 'Noma"lum'}`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `verify_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `reject_${ctx.from.id}`)]
        ]));
        ctx.session.step = null;
    }
});

// Referal Tizimi
bot.action('referral_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.editMessageText(
        `🔗 <b>Sizning silkangiz:</b>\n<code>${link}</code>\n\n👥 Do'stlar: ${user.referralCount} ta\n🎯 Vazifa: ${user.refTask} ta`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([
            [Markup.button.callback('💰 Pul yechish', 'withdraw')],
            [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
        ])}
    );
});

bot.action('withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const nextTask = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: nextTask, referralCount: 0 });
        await ctx.answerCbQuery(`✅ Vazifa bajarildi! Keyingisi: ${nextTask} ta.`, { show_alert: true });
    } else {
        await ctx.answerCbQuery(`Yana ${user.refTask - user.referralCount} ta odam qo'shing!`, { show_alert: true });
    }
});

// --- ADMIN PANEL ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("🛠 <b>Admin Panel:</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📢 REKLAMA', 'admin_broadcast')],
        [Markup.button.callback('📡 KANALLAR', 'manage_channels')]
    ]));
});

bot.action('manage_channels', async (ctx) => {
    const channels = await Config.find({ key: 'force_channel' });
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.value}`, `delch_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ QO\'SHISH', 'add_ch_step1')]);
    buttons.push([Markup.button.callback('🔙 Orqaga', 'back_to_admin')]);
    ctx.editMessageText("📡 <b>Majburiy obuna kanallari:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('back_to_admin', (ctx) => {
    ctx.editMessageText("🛠 <b>Admin Panel:</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📢 REKLAMA', 'admin_broadcast')],
        [Markup.button.callback('📡 KANALLAR', 'manage_channels')]
    ]));
});

bot.action(/^verify_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 <b>VIP signallar ochildi!</b>\nBotga qayta kirish uchun /start bosing.");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));
const app = express();
app.listen(process.env.PORT || 3000);
