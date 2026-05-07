const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR STRUKTURASI (DATABASE)
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted
    gameId: String,
    isVerified: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: String,
    value: String
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 5474529046;
bot.use(session()); // Sessiyalarni yoqish (Reklama va sozlamalar uchun)

// 3. MIDDLEWARE: ADMIN TEKSHIRUVI
const isAdmin = (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();
    return ctx.reply("❌ Bu bo'lim faqat admin uchun.");
};

// --- FOYDALANUVCHI QISMI ---

// Zayavka (Join Request) tutish
bot.on('chat_join_request', async (ctx) => {
    try {
        const { id, first_name, username } = ctx.chatJoinRequest.from;
        await User.findOneAndUpdate(
            { userId: id },
            { firstName: first_name, username, status: 'requested' },
            { upsert: true }
        );
        console.log(`[JOIN] ${id} zayavka yubordi.`);
    } catch (e) { console.error("Join error:", e); }
});

// Start buyrug'i
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 APPLE professional signallar tizimiga xush kelibsiz.`, 
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Signal olishni boshlash', 'check_access')]])
    );
});

// Kirishni tekshirish
bot.action('check_access', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    
    if (user?.isVerified) {
        return ctx.editMessageText("<b>🍎 Signallar tizimi faol!</b>\n\nQuyidagi tugma orqali terminalni oching:", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL)]])
        });
    }

    if (user?.status === 'requested' || user?.status === 'id_submitted') {
        return ctx.editMessageText("✅ <b>Zayavka topildi!</b>\n\nSignallarni faollashtirish uchun:\n1. <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n2. O'yin ID raqamingizni pastga yozib yuboring:", { parse_mode: 'HTML' });
    }

    const channel = await Config.findOne({ key: 'channel_link' }) || { value: 'https://t.me/+9av2s696xVczMjJi' };
    await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignal olish uchun avval kanalga zayavka yuborishingiz kerak.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 ZAYAVKA YUBORISH', channel.value)],
            [Markup.button.callback('🔄 TEKSHIRISH', 'check_access')]
        ])
    });
});

// ID qabul qilish
bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next(); // Admin yozsa admin panelga o'tsin
    
    const text = ctx.message.text;
    if (/^\d+$/.test(text) && text.length >= 6) {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text, status: 'id_submitted' });
        await ctx.reply("✅ <b>ID qabul qilindi!</b>\n\nAdmin tekshiruvidan so'ng signallar ochiladi.", { parse_mode: 'HTML' });
        
        // Adminga xabar
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>Yangi ID:</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${text}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash', `verify_${ctx.from.id}`)],
                [Markup.button.callback('❌ Rad etish', `reject_${ctx.from.id}`)]
            ])
        });
    }
});

// --- ADMIN PANEL QISMI ---

bot.command('admin', isAdmin, async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    
    await ctx.replyWithHTML(`<b>🛠 Admin Panel</b>\n\nJami a'zolar: <code>${total}</code>\nTasdiqlanganlar: <code>${verified}</code>`, 
        Markup.inlineKeyboard([
            [Markup.button.callback('📢 Reklama yuborish', 'broadcast')],
            [Markup.button.callback('🔗 Kanal linkini o\'zgartirish', 'set_link')]
        ])
    );
});

// Tasdiqlash mantiqi
bot.action(/^verify_(\d+)$/, async (ctx) => {
    const uId = ctx.match[1];
    await User.findOneAndUpdate({ userId: uId }, { isVerified: true });
    await ctx.answerCbQuery("Tasdiqlandi ✅");
    await ctx.editMessageText(`✅ User ${uId} tizimga qo'shildi.`);
    bot.telegram.sendMessage(uId, "🎉 <b>Tabriklaymiz!</b>\n\nHisobingiz tasdiqlandi. Endi /start bosing va signallarni oling!", { parse_mode: 'HTML' });
});

// Reklama yuborish (Soddalashtirilgan)
bot.action('broadcast', async (ctx) => {
    ctx.session.step = 'awaiting_ad';
    await ctx.reply("Reklama xabarini yuboring (Rasm yoki matn):");
});

bot.on(['text', 'photo'], async (ctx) => {
    if (ctx.from.id === ADMIN_ID && ctx.session.step === 'awaiting_ad') {
        const users = await User.find();
        let count = 0;
        for (const u of users) {
            try {
                await ctx.copyMessage(u.userId);
                count++;
            } catch (e) {}
        }
        ctx.session.step = null;
        await ctx.reply(`✅ Reklama ${count} kishiga yuborildi.`);
    }
});

// --- SERVER SETTINGS ---
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB connected'));

bot.launch().then(() => console.log('🚀 Bot is LIVE'));

const app = express();
app.get('/', (req, res) => res.send('Professional Signal Bot is Running...'));
app.listen(process.env.PORT || 3000);
