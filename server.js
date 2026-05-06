require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- CONFIGURATION ---
const ADMINS = [6137845806]; // O'zingizni ID raqamingizni kiriting
const CHANNEL_ID = '-1003900850005'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';
const APPS_CHANNEL = 'https://t.me/your_apps_channel'; // Ilovalar kanali linki
const TUTORIAL_VIDEO = 'https://t.me/richi28_bet/4'; // Video fayl ID yoki linki
const WEB_APP_URL = process.env.WEB_APP_URL;

// --- DATABASE SCHEMA ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/richi_bot')
    .then(() => console.log("DB Connected"))
    .catch(err => console.log("DB Error:", err));

const UserSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    isJoined: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

// --- MIDDLEWARES ---
bot.use(session());

// --- CORE LOGIC ---

// 1. START
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}! 🍎</b>\n\n` +
        `Ushbu bot Apple of Fortune o'yinida algoritmlarni tahlil qilishga yordam beradi.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]
        ])
    );
});

// 2. MAIN MENU
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

// 3. SIGNAL LOGIC (Subscription & Request Check)
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
        // member.status: 'member', 'administrator', 'creator', 'left', 'kicked', 'restricted'
        // 'join_request' (zayavka) holati odatda API orqali 'left' qaytarishi mumkin, 
        // lekin bot kanalda admin bo'lsa chat_join_request orqali tutib qolamiz.
        
        const hasAccess = ['member', 'administrator', 'creator'].includes(member.status);

        if (hasAccess) {
            await ctx.replyWithHTML(
                `<b>Kirish tasdiqlandi! ✅</b>\n\nTerminalni ishga tushirishingiz mumkin:`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ OPEN TERMINAL', WEB_APP_URL)]])
            );
        } else {
            await ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\n` +
                `Siz hali kanalga a'zo emassiz yoki zayavka yubormagansiz.\n` +
                `Signallarni ko'rish uchun kanalga obuna bo'lishingiz shart:`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 KANALGA ULANISH', CHANNEL_LINK)],
                    [Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]
                ])
            );
        }
    } catch (e) {
        // Zayavka yuborganlar ba'zan xato berishi mumkin, ularni force-allow qilamiz
        ctx.replyWithHTML(`<b>Tizimga ulanish...</b>`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
    }
});

// 4. TUTORIAL
bot.action('get_tutorial', async (ctx) => {
    await ctx.replyWithVideo(TUTORIAL_VIDEO, {
        caption: `<b>📹 Video qo'llanma</b>\n\nBotdan qanday foydalanish haqida to'liq ma'lumot.`
    });
});

// --- ADMIN PANEL ---
bot.command('admin', async (ctx) => {
    if (!ADMINS.includes(ctx.from.id)) return;
    
    const count = await User.countDocuments();
    await ctx.replyWithHTML(
        `<b>📊 ADMIN PANEL</b>\n\n` +
        `Umumiy obunachilar: <code>${count}</code>`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📢 Xabar yuborish', 'broadcast')],
            [Markup.button.callback('⚙️ Kanallar', 'manage_channels')],
            [Markup.button.callback('📈 Statistika', 'stats')]
        ])
    );
});

// Xabar yuborish (Soddalashtirilgan)
bot.action('broadcast', async (ctx) => {
    await ctx.reply("Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yuboring (Text, Photo yoki Video):");
    bot.on('message', async (newCtx) => {
        if (!ADMINS.includes(newCtx.from.id)) return;
        const users = await User.find();
        let success = 0;
        for (let u of users) {
            try {
                await newCtx.copyMessage(u.userId);
                success++;
            } catch (e) {}
        }
        await newCtx.reply(`Xabar ${success} kishiga yuborildi! ✅`);
    });
});

// --- SERVER START ---
bot.launch();
app.get('/', (req, res) => res.send('System Live'));
app.listen(process.env.PORT || 3000);
