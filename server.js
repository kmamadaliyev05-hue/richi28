const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR BAZASI (MODELS)
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
    refTask: { type: Number, default: 5 }, // 5, 4, 3, 2, 1 vazifasi
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, // Kanal linklari yoki ilovalar uchun
    chatId: String // Majburiy obuna kanali ID si
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; // Sizning asosiy ID raqamingiz

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ MongoDB connected'));

// 3. YORDAMCHI MIDDLEWARELAR
const isAdmin = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    return ctx.reply("❌ Faqat adminlar uchun.");
};

async function checkSub(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const user = await User.findOne({ userId: ctx.from.id });
            const isMember = ['member', 'administrator', 'creator'].includes(member.status);
            if (!isMember && user?.status !== 'requested') return false;
        } catch (e) { return false; }
    }
    return true;
}

// 4. KLAVIATURALAR
const mainKeyboard = (isVerified) => Markup.inlineKeyboard([
    [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
    [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
    [Markup.button.callback('👥 REFERAL SILKA', 'referral_menu')]
]);

// 5. ASOSIY LOGIKA (USER INTERFACE)
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, username, referredBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
            try { await bot.telegram.sendMessage(refId, `🔔 Yangi do'st qo'shildi!`); } catch (e) {}
        }
    }

    const isSubscribed = await checkSub(ctx);
    if (!isSubscribed) {
        const channels = await Config.find({ key: 'force_channel' });
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.url)]);
        buttons.push([Markup.button.callback('✅ Tekshirish', 'check_sub')]);
        return ctx.replyWithHTML(`<b>Assalomu alaykum ${first_name}!</b>\nBotdan foydalanish uchun kanallarga a'zo bo'ling.`, Markup.inlineKeyboard(buttons));
    }

    await ctx.replyWithHTML(`<b>Xush kelibsiz!</b>\nRICHI28 APPLE professional signallar tizimi faol.`, mainKeyboard(user.isVerified));
});

// Zayavka (Join Request) tutish
bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

// Signal olish Funnel
bot.action('get_signal', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.isVerified) return ctx.editMessageText("<b>VIP Ruxsat!</b>", mainKeyboard(true));

    const apps = ["1XBET", "LINEBET", "WINWIN", "888STARZ"];
    const buttons = apps.map(app => [Markup.button.callback(app, `book_${app.toLowerCase()}`)]);
    buttons.push([Markup.button.callback('🔙 Orqaga', 'start')]);
    
    await ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action(/^book_(.+)$/, async (ctx) => {
    ctx.session.book = ctx.match[1].toUpperCase();
    ctx.session.step = 'await_id';
    await ctx.editMessageText(
        `📌 <b>SHARTLAR (${ctx.session.book}):</b>\n\n` +
        `1. <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n` +
        `2. Minimal depozit: 60,000 so'm / 5$ / 400₽.\n\n` +
        `🆔 <b>ID raqamingizni yuboring:</b>`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]) }
    );
});

// Referal Tizimi (5-4-3-2-1 Logikasi)
bot.action('referral_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    
    await ctx.editMessageText(
        `👥 <b>Referal tizimi:</b>\n\n🔗 Link: <code>${link}</code>\n` +
        `📊 Do'stlar: ${user.referralCount} ta\n` +
        `🎯 Hozirgi vazifa: ${user.refTask} ta odam qo'shish.`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([
            [Markup.button.callback('💰 Pul yechish', 'withdraw')],
            [Markup.button.callback('🔙 Orqaga', 'start')]
        ])}
    );
});

bot.action('withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const nextTask = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: nextTask, referralCount: 0 });
        await ctx.answerCbQuery(`🎉 Vazifa bajarildi! Keyingi bosqich: ${nextTask} ta odam.`);
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>TO'LOV SO'ROVI:</b>\nUser: ${user.firstName}\nID: ${user.userId}`);
    } else {
        await ctx.answerCbQuery(`Yana ${user.refTask - user.referralCount} ta odam qo'shing!`, { show_alert: true });
    }
});

// Admin Panel (Boshqaruv)
bot.command('admin', isAdmin, async (ctx) => {
    const total = await User.countDocuments();
    const today = await User.countDocuments({ joinedAt: { $gte: new Date().setHours(0,0,0,0) } });
    await ctx.replyWithHTML(`📊 <b>STATISTIKA:</b>\n\nJami: ${total}\nBugun: ${today}`, adminKeyboard);
});

// ID ni tasdiqlash
bot.on('text', async (ctx, next) => {
    if (ctx.session.step === 'await_id') {
        const idText = ctx.message.text;
        if (!/^\d+$/.test(idText)) return ctx.reply("❌ Faqat raqam yuboring!");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: idText, bookmaker: ctx.session.book, status: 'id_submitted' });
        ctx.session.step = null;
        await ctx.reply("⏳ <b>Tasdiqlash kutilmoqda (15-30 daqiqa).</b>");
        
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>ID:</b> <code>${idText}</code>\nPlatforma: ${ctx.session.book}`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `r_${ctx.from.id}`)]
        ]));
        return;
    }
    return next();
});

bot.action(/^v_(\d+)$/, isAdmin, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 <b>VIP RUXSAT BERILDI!</b> /start bosing.");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

// Server Launch
bot.launch().then(() => console.log('🚀 RICHI28 BOT IS LIVE'));
const app = express();
app.get('/', (req, res) => res.send('Bot Status: Active'));
app.listen(process.env.PORT || 3000);
