const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR STRUKTURASI (Loyihaga moslashtirilgan)
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, 
    gameId: String,
    isVerified: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    balance: { type: Number, default: 0 }, // Psixologik balans (bonus)
    attempts: { type: Number, default: 0 }  // Foydalanuvchi necha marta kirgani
});

const User = mongoose.model('User', userSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 5474529046;

bot.use(session());

// --- YORDAMCHI FUNKSIYALAR (Helper Functions) ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mainKeyboard = (isVerified) => {
    if (isVerified) {
        return Markup.inlineKeyboard([
            [Markup.button.webApp('🍎 SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)],
            [Markup.button.callback('📊 Shaxsiy statistika', 'my_stats')],
            [Markup.button.callback('🎁 Kunlik bonus', 'daily_bonus')]
        ]);
    }
    return Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Signallarni faollashtirish', 'check_access')],
        [Markup.button.callback('ℹ️ Qanday ishlaydi?', 'how_it_works')]
    ]);
};

// --- FOYDALANUVCHI INTERFEYSI ---

bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const user = await User.findOneAndUpdate(
        { userId: id }, 
        { firstName: first_name, username, $inc: { attempts: 1 }, lastActive: new Date() }, 
        { upsert: true, new: true }
    );

    await ctx.replyWithPhoto('https://t.me/richi28_apple/3', { // O'zingizning rasm linkini qo'ying
        caption: `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nSiz RICHI28 APPLE professional signallar algoritmi bilan bog'landingiz.\n\n` +
                 `📈 <b>Tizim holati:</b> <code>ONLINE (98% aniqlik)</code>\n` +
                 `👤 <b>Sizning holatingiz:</b> ${user.isVerified ? '✅ VIP' : '❌ Faollashtirilmagan'}`,
        parse_mode: 'HTML',
        ...mainKeyboard(user.isVerified)
    });
});

// Zayavka yuborgandagi mantiq
bot.on('chat_join_request', async (ctx) => {
    try {
        await User.findOneAndUpdate(
            { userId: ctx.chatJoinRequest.from.id },
            { status: 'requested', lastActive: new Date() },
            { upsert: true }
        );
    } catch (e) { console.error("Join error:", e); }
});

// Psixologik "Uyg'onish" - check_access
bot.action('check_access', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });

    if (user?.isVerified) {
        return ctx.editMessageText("<b>Siz allaqachon VIP a'zosiz!</b>\nTerminalga kirish ruxsati ochiq.", {
            parse_mode: 'HTML',
            ...mainKeyboard(true)
        });
    }

    if (user?.status === 'requested') {
        // Animatsiya effekti
        await ctx.editMessageText("🔄 <b>Tizim sizning zayavkangizni tekshirmoqda...</b>", { parse_mode: 'HTML' });
        await sleep(1500);
        
        return ctx.editMessageText(
            "✅ <b>Zayavka tasdiqlandi!</b>\n\nLekin signallarni ochish uchun algoritmni hisobingizga bog'lashimiz kerak:\n\n" +
            "1️⃣ 1XBET ilovasiga kiring.\n" +
            "2️⃣ <b>RICHI28</b> promokodi bilan yangi hisob oching (Bu algoritm ishlashi uchun shart!)\n" +
            "3️⃣ O'yin ID raqamingizni pastga yozib yuboring:", 
            { parse_mode: 'HTML' }
        );
    }

    await ctx.editMessageText(
        "⚠️ <b>DIQQAT!</b>\n\nSignallar algoritmi faqat bizning yopiq kanalimiz a'zolari uchun ishlaydi.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 KANALGA KIRISH', 'https://t.me/+9av2s696xVczMjJi')],
            [Markup.button.callback('🔄 TEKSHIRISH', 'check_access')]
        ])
    });
});

// Statistika (Foydalanuvchini ushlab qolish uchun)
bot.action('my_stats', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
        `📊 <b>Sizning statistikangiz:</b>\n\n` +
        `🆔 ID: <code>${user.userId}</code>\n` +
        `💰 Hisobingiz: <code>${user.balance} ball</code>\n` +
        `🔄 Botdan foydalanish: <code>${user.attempts} marta</code>\n\n` +
        `<i>Ballaringiz qancha ko'p bo'lsa, signallar aniqligi shuncha yuqori bo'ladi!</i>`
    );
});

// ID Qabul qilish (Admin xabarnomasi bilan)
bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();
    
    const text = ctx.message.text;
    if (/^\d{7,10}$/.test(text)) { // Faqat 7-10 xonali raqamlar
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: text, status: 'id_submitted' });
        
        await ctx.replyWithHTML("✅ <b>ID qabul qilindi!</b>\n\nTizim ma'lumotlarni tekshirmoqda... Bu bir necha daqiqa vaqt olishi mumkin. <b>Biz sizga xabar yuboramiz!</b>");

        await bot.telegram.sendMessage(ADMIN_ID, 
            `💰 <b>Yangi ID tasdiqlash kutilmoqda!</b>\n\n` +
            `👤 Foydalanuvchi: ${ctx.from.first_name}\n` +
            `🆔 O'yin ID: <code>${text}</code>`, 
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash (VIP berish)', `v_${ctx.from.id}`)],
                [Markup.button.callback('❌ Rad etish', `r_${ctx.from.id}`)]
            ])
        );
    } else {
        await ctx.reply("❌ Iltimos, faqat o'yin ID raqamingizni yuboring (faqat raqamlar).");
    }
});

// --- ADMIN KOMANDALARI ---

bot.action(/^v_(\d+)$/, async (ctx) => {
    const uId = ctx.match[1];
    await User.findOneAndUpdate({ userId: uId }, { isVerified: true, status: 'verified' });
    await ctx.answerCbQuery("Tasdiqlandi ✅");
    await ctx.editMessageText(`✅ Foydalanuvchi ${uId} VIP tizimiga ulandi.`);
    
    bot.telegram.sendMessage(uId, 
        "🥳 <b>TABRIKLAYMIZ!</b>\n\nHisobingiz muvaffaqiyatli tekshirildi. Signallar tizimi endi siz uchun butunlay ochiq!", 
        mainKeyboard(true)
    );
});

// REKLAMA (Barcha foydalanuvchilarga xabar yuborish)
bot.command('broadcast', isAdmin, async (ctx) => {
    ctx.session.step = 'broadcasting';
    await ctx.reply("Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yuboring (Rasm, matn, video...):");
});

bot.on('message', async (ctx) => {
    if (ctx.from.id === ADMIN_ID && ctx.session?.step === 'broadcasting') {
        const users = await User.find();
        let sent = 0;
        for (const user of users) {
            try {
                await ctx.copyMessage(user.userId);
                sent++;
            } catch (e) {}
        }
        ctx.session.step = null;
        await ctx.reply(`✅ Xabar ${sent} ta foydalanuvchiga yuborildi.`);
    }
});

// --- SERVERNI ISHGA TUSHIRISH ---
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

bot.launch().then(() => console.log('🚀 Signal Bot Online'));

const app = express();
app.get('/', (req, res) => res.send('Bot is running...'));
app.listen(process.env.PORT || 3000);
