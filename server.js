const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// ==========================================
// 1. DATABASE MODELS (Ma'lumotlar strukturasi)
// ==========================================
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    gameId: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    balance: { type: Number, default: 0 },
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
// 2. INITIALIZATION (Botni sozlash)
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; // Sizning ID raqamingiz
bot.use(session());

// MongoDB ulanishi
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Muvaffaqiyatli ulandi'))
    .catch(err => console.error('❌ Baza ulanishida xato:', err));

// ==========================================
// 3. MIDDLEWARES & HELPERS (Yordamchi mantiq)
// ==========================================
const isAdmin = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
    return ctx.reply("❌ Kechirasiz, bu bo'lim faqat bosh admin uchun.");
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getUserStatus = (user) => {
    if (user.isBanned) return '🚫 Bloklangan';
    if (user.isVerified) return '✅ VIP Foydalanuvchi';
    if (user.status === 'id_submitted') return '⏳ Tekshiruvda';
    if (user.status === 'requested') return '📩 Zayavka yuborilgan';
    return '🆕 Yangi';
};

// ==========================================
// 4. FOYDALANUVCHI INTERFEYSI (Main Logic)
// ==========================================

// Start buyrug'i
bot.start(async (ctx) => {
    try {
        const { id, first_name, username } = ctx.from;
        const user = await User.findOneAndUpdate(
            { userId: id }, 
            { firstName: first_name, username, $inc: { attempts: 1 }, lastActive: new Date() }, 
            { upsert: true, new: true }
        );

        if (user.isBanned) return ctx.reply("Siz botdan chetlatilgansiz.");

        const menu = user.isVerified 
            ? Markup.inlineKeyboard([
                [Markup.button.webApp('🍎 SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)],
                [Markup.button.callback('📊 Statistika', 'my_stats'), Markup.button.callback('⚙️ Sozlamalar', 'settings')]
              ])
            : Markup.inlineKeyboard([
                [Markup.button.callback('🚀 Signallarni faollashtirish', 'check_access')],
                [Markup.button.callback('ℹ️ Tizim haqida', 'about_bot')]
              ]);

        await ctx.replyWithHTML(
            `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\n` +
            `Siz <b>RICHI28 APPLE</b> professional signallar algoritmi tarmog'iga ulandingiz.\n\n` +
            `👤 <b>Status:</b> ${getUserStatus(user)}\n` +
            `📈 <b>Algoritm aniqligi:</b> 98%`,
            menu
        );
    } catch (e) { console.error(e); }
});

// Kanalga zayavka yuborilganda
bot.on('chat_join_request', async (ctx) => {
    try {
        const uId = ctx.chatJoinRequest.from.id;
        await User.findOneAndUpdate({ userId: uId }, { status: 'requested' }, { upsert: true });
        console.log(`[JOIN REQUEST] User ${uId} zayavka yubordi.`);
    } catch (e) { console.error(e); }
});

// Kirishni tekshirish (Psixologik animatsiya bilan)
bot.action('check_access', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.isBanned) return;

    if (user.isVerified) {
        return ctx.editMessageText("✅ <b>Sizning VIP ruxsatingiz faol!</b>", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL)]])
        });
    }

    if (user.status === 'requested' || user.status === 'id_submitted') {
        await ctx.editMessageText("🔄 <b>Algoritm bazadan ma'lumotlarni qidirmoqda...</b>", { parse_mode: 'HTML' });
        await sleep(2000);
        return ctx.editMessageText(
            "✅ <b>Zayavka tasdiqlandi!</b>\n\nSignallarni ochish uchun oxirgi bosqich:\n" +
            "1️⃣ <b>RICHI28</b> promokodi bilan 1XBET'da yangi hisob oching.\n" +
            "2️⃣ O'yin ID raqamingizni pastga yozib yuboring (Faqat raqam):", 
            { parse_mode: 'HTML' }
        );
    }

    const link = await Config.findOne({ key: 'channel_link' }) || { value: 'https://t.me/+9av2s696xVczMjJi' };
    await ctx.editMessageText(
        "⚠️ <b>DIQQAT: Ruxsat yo'q!</b>\n\nSignallar algoritmidan foydalanish uchun kanalga zayavka yuboring.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 ZAYAVKA YUBORISH', link.value)],
            [Markup.button.callback('🔄 TASDIQLASH', 'check_access')]
        ])
    });
});

// ID Qabul qilish
bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();
    
    const text = ctx.message.text;
    if (/^\d{6,12}$/.test(text)) {
        const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text, status: 'id_submitted' }, { new: true });
        
        await ctx.replyWithHTML("✅ <b>ID muvaffaqiyatli yuborildi!</b>\n\nTizim admini 5-10 daqiqa ichida tekshiruv o'tkazadi va sizga VIP ruxsat beradi. Iltimos, kuting!");

        // Adminga xabar
        await bot.telegram.sendMessage(ADMIN_ID, 
            `💰 <b>TASDIQLASH KUTILYAPTI!</b>\n\n` +
            `👤 Foydalanuvchi: ${ctx.from.first_name}\n` +
            `🆔 O'yin ID: <code>${text}</code>\n` +
            `🌐 Username: @${ctx.from.username || 'yoq'}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH (VIP)', `verify_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        );
    }
});

// ==========================================
// 5. ADMIN PANEL (FULL CONTROL)
// ==========================================

bot.command('admin', isAdmin, async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    
    await ctx.replyWithHTML(
        `🛠 <b>BOSS PANEL</b>\n\n` +
        `📊 Jami a'zolar: <code>${total}</code>\n` +
        `✅ VIP a'zolar: <code>${verified}</code>\n` +
        `🔄 Status: <code>Live</code>`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📢 Reklama tarqatish', 'broadcast')],
            [Markup.button.callback('🔗 Kanal linkini o\'zgartirish', 'edit_config')],
            [Markup.button.callback('🔎 Foydalanuvchini qidirish', 'find_user')]
        ])
    );
});

// Tasdiqlash tugmasi
bot.action(/^verify_(\d+)$/, isAdmin, async (ctx) => {
    const targetId = ctx.match[1];
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true, status: 'verified' });
    await ctx.answerCbQuery("Tasdiqlandi! ✅");
    await ctx.editMessageText(`✅ User ${targetId} VIP qilindi.`);
    
    bot.telegram.sendMessage(targetId, 
        "🥳 <b>TABRIKLAYMIZ!</b>\n\nHisobingiz tasdiqlandi. Signallar tizimi endi siz uchun butunlay ochiq!", 
        mainKeyboard(true)
    );
});

// Reklama tarqatish (Sessiya bilan)
bot.action('broadcast', isAdmin, async (ctx) => {
    ctx.session.step = 'broadcasting';
    await ctx.reply("📢 Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yuboring (Matn, rasm, video):");
});

bot.on('message', async (ctx) => {
    if (ctx.from.id === ADMIN_ID && ctx.session?.step === 'broadcasting') {
        const users = await User.find();
        let success = 0;
        for (const u of users) {
            try { await ctx.copyMessage(u.userId); success++; } catch (e) {}
        }
        ctx.session.step = null;
        await ctx.reply(`✅ Xabar ${success} kishiga yetkazildi.`);
    }
});

// ==========================================
// 6. SERVER & ERROR HANDLING
// ==========================================
bot.catch((err) => console.error('🔴 CRITICAL BOT ERROR:', err));

const app = express();
app.get('/', (req, res) => res.send('Richi28 Apple Bot is Active!'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🚀 Server port 3000 da ishga tushdi');
});

bot.launch().then(() => console.log('🚀 Bot Telegramda Online!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
