require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- CONFIGURATION ---
const ADMINS = [6137845806]; // O'z ID raqamingizni tekshiring
const CHANNEL_ID = '-1003900850005'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';
const APPS_CHANNEL = 'https://t.me/apple_ilovalar'; 
const WEB_APP_URL = process.env.WEB_APP_URL;

// --- DATABASE SCHEMA ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ DB Connected"))
    .catch(e => console.log("❌ DB Error:", e));

const UserSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'none' }, // 'member', 'requested', 'none'
    joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// --- LOGIC ---

// 1. ZAYAVKANI TUTISH (Join Request Handler)
bot.on('chat_join_request', async (ctx) => {
    try {
        const { id, first_name, username } = ctx.from;
        await User.findOneAndUpdate(
            { userId: id }, 
            { firstName: first_name, username, status: 'requested' }, 
            { upsert: true }
        );
        console.log(`✅ Zayavka keldi: ${id}`);
    } catch (e) { console.log(e); }
});

// 2. START BUYRUG'I
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}! 👋</b>\n\n` +
        `Tizimdan foydalanish uchun botni ishga tushirish tugmasini bosing:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]
        ])
    );
});

// 3. ASOSIY MENYU
bot.action('main_menu', async (ctx) => {
    await ctx.editMessageText(`<b>Asosiy menyu:</b>\n\nKerakli bo'limni tanlang 👇`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📱 Ilovalar', APPS_CHANNEL)],
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.callback('📹 Video qo\'llanma', 'get_tutorial')]
        ])
    });
});

// 4. SIGNAL OLISH (Zayavka va Obunani tekshirish)
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        // Avval bazadagi statusini tekshiramiz (zayavka tashlaganmi?)
        const user = await User.findOne({ userId });
        
        // Telegram API orqali kanaldagi holatini tekshiramiz
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId).catch(() => ({ status: 'left' }));
        const isMember = ['member', 'administrator', 'creator'].includes(member.status);
        const hasRequested = user && user.status === 'requested';

        if (isMember || hasRequested) {
            await ctx.replyWithHTML(
                `<b>Ruxsat berildi! ✅</b>\n\nTerminal yuklandi:`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]])
            );
        } else {
            await ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\nSiz hali kanalga obuna bo'lmagansiz yoki zayavka yubormagansiz.\n\n` +
                `Iltimos, pastdagi kanalga zayavka yuboring va qayta tekshiring:`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 ZAYAVKA YUBORISH', CHANNEL_LINK)],
                    [Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]
                ])
            );
        }
    } catch (e) {
        console.log(e);
        ctx.reply("Texnik xatolik, qaytadan urinib ko'ring.");
    }
});

// 5. VIDEO QO'LLANMA
bot.action('get_tutorial', async (ctx) => {
    await ctx.reply("📹 Video qo'llanma yuklanmoqda... (File ID qo'shilishi kerak)");
});

// --- ADMIN PANEL ---
bot.command('admin', async (ctx) => {
    if (!ADMINS.includes(ctx.from.id)) return;
    const count = await User.countDocuments();
    const requests = await User.countDocuments({ status: 'requested' });

    await ctx.replyWithHTML(
        `<b>📊 ADMIN PANEL</b>\n\n` +
        `👤 Jami foydalanuvchilar: <b>${count}</b>\n` +
        `📩 Zayavka tashlaganlar: <b>${requests}</b>`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📢 Xabar yuborish', 'start_broadcast')],
            [Markup.button.callback('📈 Batafsil statistika', 'stats')]
        ])
    );
});

// Xabar yuborish logikasi
bot.action('start_broadcast', async (ctx) => {
    await ctx.reply("Yubormoqchi bo'lgan xabaringizni (matn, rasm yoki video) menga yuboring:");
    bot.on('message', async (newCtx) => {
        if (!ADMINS.includes(newCtx.from.id)) return;
        const users = await User.find();
        let count = 0;
        for (let u of users) {
            try {
                await newCtx.copyMessage(u.userId);
                count++;
            } catch (e) {}
        }
        await newCtx.reply(`Xabar ${count} kishiga yuborildi! ✅`);
    });
});

// --- SERVER ---
bot.launch();
app.get('/', (req, res) => res.send('Bot is Live!'));
app.listen(process.env.PORT || 3000);
