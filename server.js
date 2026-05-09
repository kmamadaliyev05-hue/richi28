const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ DATABASE CONNECTED'))
  .catch(err => console.error('❌ DB ERROR:', err));

// 2. FOYDALANUVCHI MODELI
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    hackerId: String,
    firstName: String,
    lang: { type: String, default: 'uz' },
    accuracy: { type: Number, default: 45 },
    referralCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
}));

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());

// --- YORDAMCHI FUNKSIYALAR ---
const generateHackerId = () => Math.floor(10000000 + Math.random() * 90000000).toString();

const getMainMenu = (u) => {
    const l = u.lang || 'uz';
    return Markup.inlineKeyboard([
        [Markup.button.webApp(l === 'uz' ? "🚀 SIGNAL OLISH" : "🚀 ПОЛУЧИТЬ СИГНАЛ", process.env.WEB_APP_URL)],
        [Markup.button.callback("👤 PROFIL", 'profile'), Markup.button.callback("👥 REFERAL", 'ref')],
        [Markup.button.callback("📚 ACADEMY", 'guide'), Markup.button.callback("🛠 SOZLAMALAR", 'settings')],
        [Markup.button.callback("🆘 SUPPORT", 'support')]
    ]);
};

// --- START ---
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    let user = await User.findOne({ userId: id });
    
    if (!user) {
        user = await User.create({
            userId: id,
            firstName: first_name,
            hackerId: generateHackerId()
        });
    }

    return ctx.reply(`<b>RICHI28 HACK</b> tizimiga xush kelibsiz!\n\nID: <code>${user.hackerId}</code>`, {
        parse_mode: 'HTML',
        ...getMainMenu(user)
    });
});

// --- ASOSIY TUGMALAR ---
bot.action('profile', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const text = `👤 <b>HACKER PROFILI</b>\n\n🆔 ID: <code>${u.hackerId}</code>\n📈 ANIQLIK: <b>${u.accuracy}%</b>\n👥 REFERALLAR: <b>${u.referralCount}</b>`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]]) });
});

bot.action('guide', (ctx) => {
    ctx.editMessageText("<b>📚 HACKER ACADEMY</b>\n\nBu yerda botdan foydalanish bo'yicha yo'riqnomalar bo'ladi.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]])
    });
});

bot.action('settings', (ctx) => {
    ctx.editMessageText("🛠 <b>SOZLAMALAR</b>\n\nBu yerda til va ilovalarni sozlash mumkin.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]])
    });
});

bot.action('home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 HACK</b>\n🆔 ID: <code>${u.hackerId}</code>`, {
        parse_mode: 'HTML',
        ...getMainMenu(u)
    });
});

// --- BOTNI ISHGA TUSHIRISH ---
bot.launch();
const app = express(); app.get('/', (req, res) => res.send('Bot is running...')); app.listen(process.env.PORT || 3000);
