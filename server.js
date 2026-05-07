const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, 
    gameId: String,
    isVerified: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
});
const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String
});
const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; // Rasmda ko'rsatilgan yangi Admin ID
bot.use(session());

// 3. MIDDLEWARES
const isAdmin = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    return ctx.reply("❌ Bu bo'lim faqat admin uchun.");
};
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- FOYDALANUVCHI QISMI ---

bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const user = await User.findOneAndUpdate(
        { userId: id }, 
        { firstName: first_name, username }, 
        { upsert: true, new: true }
    );

    const text = `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 professional signallar tizimiga xush kelibsiz.`;
    const keyboard = user.isVerified 
        ? Markup.inlineKeyboard([[Markup.button.webApp('🍎 SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)]])
        : Markup.inlineKeyboard([[Markup.button.callback('🚀 Signallarni faollashtirish', 'check_access')]]);

    await ctx.replyWithHTML(text, keyboard);
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
        return ctx.editMessageText("<b>🍎 Signallar tizimi faol!</b>", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL)]])
        });
    }

    if (user?.status === 'requested' || user?.status === 'id_submitted') {
        return ctx.editMessageText("✅ <b>Zayavka topildi!</b>\n\nSignallarni faollashtirish uchun:\n1. <b>RICHI28</b> promokodi bilan yangi hisob oching.\n2. O'yin ID raqamingizni pastga yozib yuboring:", { parse_mode: 'HTML' });
    }

    const channel = await Config.findOne({ key: 'channel_link' }) || { value: 'https://t.me/+9av2s696xVczMjJi' };
    await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignallar uchun kanalga zayavka yuboring.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 ZAYAVKA YUBORISH', channel.value)],
            [Markup.button.callback('🔄 TEKSHIRISH', 'check_access')]
        ])
    });
});

bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();
    const text = ctx.message.text;
    if (/^\d{6,15}$/.test(text)) {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text, status: 'id_submitted' });
        await ctx.reply("✅ ID qabul qilindi. Admin tasdiqlashini kuting.");
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>Yangi ID keldi:</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${text}</code>`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`)],
            [Markup.button.callback('❌ Rad etish', `r_${ctx.from.id}`)]
        ]));
    }
});

// --- ADMIN PANEL (FAQAT SIZ UCHUN) ---

bot.command('admin', isAdmin, async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    await ctx.replyWithHTML(`🛠 <b>Admin Panel</b>\n\nJami: ${total}\nVIP: ${verified}`, Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama tarqatish', 'broadcast')],
        [Markup.button.callback('🔗 Kanal linkini o\'zgartirish', 'edit_link')]
    ]));
});

bot.action('broadcast', isAdmin, async (ctx) => {
    ctx.session.step = 'ad';
    await ctx.reply("Reklama xabarini yuboring:");
});

bot.action('edit_link', isAdmin, async (ctx) => {
    ctx.session.step = 'link';
    await ctx.reply("Yangi kanal linkini yuboring (https://t.me/...):");
});

bot.on('message', isAdmin, async (ctx) => {
    if (ctx.session?.step === 'ad') {
        const users = await User.find();
        let count = 0;
        for (const u of users) {
            try { await ctx.copyMessage(u.userId); count++; } catch(e){}
        }
        ctx.session.step = null;
        return ctx.reply(`✅ ${count} kishiga yuborildi.`);
    }
    if (ctx.session?.step === 'link') {
        await Config.findOneAndUpdate({ key: 'channel_link' }, { value: ctx.message.text }, { upsert: true });
        ctx.session.step = null;
        return ctx.reply("✅ Kanal linki yangilandi!");
    }
});

bot.action(/^v_(\d+)$/, isAdmin, async (ctx) => {
    const uId = ctx.match[1];
    await User.findOneAndUpdate({ userId: uId }, { isVerified: true });
    await ctx.editMessageText(`✅ ${uId} tasdiqlandi.`);
    bot.telegram.sendMessage(uId, "🎉 <b>Tabriklaymiz! VIP signallar ochildi!</b>\nBotga qayta kirish uchun /start bosing.", { parse_mode: 'HTML' });
});

// --- SERVER ---
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ MongoDB connected'));
bot.launch().then(() => console.log('🚀 Bot LIVE'));
const app = express();
app.get('/', (req, res) => res.send('Bot is running...'));
app.listen(process.env.PORT || 3000);
