const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB ulandi'))
    .catch(err => console.error('❌ Baza xatosi:', err));

// 2. MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, 
    gameId: String,
    isVerified: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 3. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 5474529046;
bot.use(session());

// 4. MIDDLEWARES (Xatoni oldini olish uchun tepaga qo'yildi)
const isAdmin = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    return ctx.reply("❌ Bu bo'lim faqat admin uchun.");
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- FOYDALANUVCHI INTERFEYSI ---

bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const user = await User.findOneAndUpdate(
        { userId: id }, 
        { firstName: first_name, username, lastActive: new Date() }, 
        { upsert: true, new: true }
    );

    const menu = user.isVerified 
        ? Markup.inlineKeyboard([[Markup.button.webApp('🍎 SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)]])
        : Markup.inlineKeyboard([[Markup.button.callback('🚀 Signallarni faollashtirish', 'check_access')]]);

    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 professional signallar tizimiga xush kelibsiz.`,
        menu
    );
});

bot.on('chat_join_request', async (ctx) => {
    try {
        await User.findOneAndUpdate(
            { userId: ctx.chatJoinRequest.from.id },
            { status: 'requested' },
            { upsert: true }
        );
    } catch (e) { console.error(e); }
});

bot.action('check_access', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });

    if (user?.isVerified) {
        return ctx.editMessageText("<b>Signallar tizimi faol!</b>", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL)]])
        });
    }

    if (user?.status === 'requested') {
        await ctx.editMessageText("🔄 <b>Zayavka tekshirilmoqda...</b>", { parse_mode: 'HTML' });
        await sleep(1500);
        return ctx.editMessageText("✅ <b>Zayavka tasdiqlandi!</b>\n\nSignallarni ochish uchun ID raqamingizni yuboring:", { parse_mode: 'HTML' });
    }

    await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nKanalga zayavka yuboring.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 ZAYAVKA YUBORISH', 'https://t.me/+9av2s696xVczMjJi')],
            [Markup.button.callback('🔄 TEKSHIRISH', 'check_access')]
        ])
    });
});

bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();
    const text = ctx.message.text;
    if (/^\d+$/.test(text)) {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text, status: 'id_submitted' });
        await ctx.reply("✅ ID qabul qilindi. Admin tasdiqlashini kuting.");
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 Yangi ID: <code>${text}</code>`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `r_${ctx.from.id}`)]
        ]));
    }
});

// --- ADMIN PANEL ---

bot.command('admin', isAdmin, async (ctx) => {
    const count = await User.countDocuments();
    await ctx.replyWithHTML(`🛠 <b>Admin Panel</b>\nA'zolar: ${count}`, Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama', 'broadcast')]
    ]));
});

bot.action('broadcast', isAdmin, async (ctx) => {
    ctx.session.step = 'broadcasting';
    await ctx.reply("Xabarni yuboring:");
});

bot.action(/^v_(\d+)$/, isAdmin, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    await ctx.editMessageText("✅ Tasdiqlandi.");
    bot.telegram.sendMessage(ctx.match[1], "🎉 Signallar ochildi! /start bosing.");
});

// --- LAUNCH ---
bot.launch().then(() => console.log('🚀 Bot LIVE'));

const app = express();
app.get('/', (req, res) => res.send('Bot Online'));
app.listen(process.env.PORT || 3000);
