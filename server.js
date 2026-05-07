const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// ==========================================
// 1. DATABASE MODELS
// ==========================================
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, 
    gameId: { type: String, default: 'Kiritilmagan' },
    isVerified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// ==========================================
// 2. INITIALIZATION
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;
bot.use(session());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ DB error:', err));

// ==========================================
// 3. HELPERS & MIDDLEWARES
// ==========================================
const isAdmin = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    return ctx.reply("❌ Faqat admin uchun.");
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getMainMenu = (isVerified) => {
    if (isVerified) {
        return Markup.inlineKeyboard([
            [Markup.button.webApp('🍎 SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)],
            [Markup.button.callback('📊 Statistika', 'my_stats'), Markup.button.callback('⚙️ Sozlamalar', 'settings')]
        ]);
    }
    return Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Signallarni faollashtirish', 'check_access')],
        [Markup.button.callback('ℹ️ Tizim haqida', 'about_bot')]
    ]);
};

// ==========================================
// 4. MAIN BOT LOGIC
// ==========================================

bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const user = await User.findOneAndUpdate(
        { userId: id }, 
        { firstName: first_name, username, $inc: { attempts: 1 }, lastActive: new Date() }, 
        { upsert: true, new: true }
    );

    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 professional signallar tizimiga xush kelibsiz.`,
        getMainMenu(user.isVerified)
    );
});

// --- STATISTIKA BO'LIMI ---
bot.action('my_stats', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const text = `📊 <b>Sizning statistikangiz:</b>\n\n` +
                 `🆔 ID: <code>${user.userId}</code>\n` +
                 `🔄 Kirishlar soni: <code>${user.attempts} marta</code>\n` +
                 `📅 Qo'shilgan vaqtingiz: <code>${user.joinedAt.toLocaleDateString()}</code>\n` +
                 `🏆 Status: <code>${user.isVerified ? 'VIP (Faol)' : 'Oddiy'}</code>`;
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'back_to_main')]])
    });
});

// --- SOZLAMALAR BO'LIMI ---
bot.action('settings', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const text = `⚙️ <b>Sozlamalar:</b>\n\n` +
                 `👤 Ism: <b>${user.firstName}</b>\n` +
                 `🎮 O'yin ID: <code>${user.gameId}</code>\n` +
                 `🔑 VIP Status: <b>${user.isVerified ? 'Aktiv ✅' : 'Noaktiv ❌'}</b>\n\n` +
                 `<i>Ma'lumotlarni o'zgartirish uchun adminga murojaat qiling.</i>`;
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'back_to_main')]])
    });
});

// --- ORQAGA QAYTISH ---
bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.answerCbQuery();
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, {
        parse_mode: 'HTML',
        ...getMainMenu(user.isVerified)
    });
});

// --- SIGNALLARNI TEKSHIRISH ---
bot.action('check_access', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.isVerified) {
        return ctx.editMessageText("✅ <b>VIP ruxsat faol!</b>", {
            parse_mode: 'HTML',
            ...getMainMenu(true)
        });
    }

    if (user.status === 'requested') {
        await ctx.editMessageText("🔄 <b>Bazadan ma'lumotlar qidirilmoqda...</b>", { parse_mode: 'HTML' });
        await sleep(1500);
        return ctx.editMessageText("✅ <b>Zayavka topildi!</b>\n\nSignallarni ochish uchun ID raqamingizni yuboring:", { parse_mode: 'HTML' });
    }

    const channel = await Config.findOne({ key: 'channel_link' }) || { value: 'https://t.me/+9av2s696xVczMjJi' };
    await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\nKanalga zayavka yuboring.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 ZAYAVKA YUBORISH', channel.value)],
            [Markup.button.callback('🔄 TEKSHIRISH', 'check_access')]
        ])
    });
});

// ID QABUL QILISH
bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();
    const text = ctx.message.text;
    if (/^\d+$/.test(text)) {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text, status: 'requested' });
        await ctx.reply("✅ ID qabul qilindi. Admin tasdiqlashini kuting.");
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 Yangi ID: <code>${text}</code>`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`)]
        ]));
    }
});

// --- ADMIN PANEL ---
bot.command('admin', isAdmin, async (ctx) => {
    const total = await User.countDocuments();
    await ctx.replyWithHTML(`🛠 <b>Admin Panel</b>\nJami: ${total}`, Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama', 'broadcast')]
    ]));
});

bot.action(/^v_(\d+)$/, isAdmin, async (ctx) => {
    const uId = ctx.match[1];
    await User.findOneAndUpdate({ userId: uId }, { isVerified: true });
    await ctx.editMessageText(`✅ ${uId} VIP qilindi.`);
    bot.telegram.sendMessage(uId, "🎉 VIP signallar ochildi! /start bosing.");
});

// ==========================================
// 5. SERVER LAUNCH
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Bot is Live'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 Bot LIVE'));
