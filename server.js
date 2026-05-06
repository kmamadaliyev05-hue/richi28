require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Sizning admin ID raqamingiz va Web App havolasi
const ADMINS = [6137845806]; 
const WEB_APP_URL = process.env.WEB_APP_URL;

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ DB Connected"))
    .catch(e => console.error("❌ DB Error:", e));

// Foydalanuvchilar jadvali
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'none' }, // Zayavka tashlaganlarni aniqlash uchun
    joinedAt: { type: Date, default: Date.now }
}));

// Kanallar jadvali (Admin panel orqali boshqariladi)
const Channel = mongoose.model('Channel', new mongoose.Schema({
    channelId: String,
    channelName: String,
    inviteLink: String
}));

// Kanallar jadvali
const Channel = mongoose.model('Channel', new mongoose.Schema({
    channelId: String,
    channelName: String,
    inviteLink: String
}));

// Kanalga zayavka tashlaganlarni avtomatik bazaga saqlash
bot.on('chat_join_request', async (ctx) => {
    try {
        const { id, first_name, username } = ctx.from;
        await User.findOneAndUpdate(
            { userId: id }, 
            { firstName: first_name, username, status: 'requested' }, 
            { upsert: true, new: true }
        );
        console.log(`✅ Yangi zayavka saqlandi: ${id}`);
    } catch (e) { console.log("Join Request Error:", e); }
});

// Start buyrug'i bosilganda
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    // Foydalanuvchini bazada yangilash yoki qo'shish
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}! 👋</b>\n\n` +
        `RICHI28 tahlil botiga xush kelibsiz.`,
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]])
    );
});


bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        const channels = await Channel.find();
        const dbUser = await User.findOne({ userId });

        // Agar foydalanuvchi avvalroq zayavka tashlagan bo'lsa - O'TKAZISH
        if (dbUser && dbUser.status === 'requested') {
            return await ctx.replyWithHTML(`<b>Ruxsat berildi! ✅ (Zayavka orqali)</b>`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
        }

        let mustJoin = [];
        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch.channelId, userId);
                const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
                if (!isSubscribed) mustJoin.push(ch);
            } catch (e) { mustJoin.push(ch); }
        }

        if (mustJoin.length === 0) {
            await ctx.replyWithHTML(`<b>Ruxsat berildi! ✅</b>`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
        } else {
            const buttons = mustJoin.map(ch => [Markup.button.url(`📢 ${ch.channelName}`, ch.inviteLink)]);
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            await ctx.replyWithHTML(`<b>DIQQAT! ⚠️</b>\n\nTerminalga kirish uchun kanalga a'zo bo'ling yoki zayavka yuboring:`, Markup.inlineKeyboard(buttons));
        }
    } catch (err) { ctx.reply("Iltimos, qaytadan /start bosing."); }
});


// Admin panelni chiqarish funksiyasi
const sendAdminPanel = async (ctx) => {
    const usersCount = await User.countDocuments();
    const reqCount = await User.countDocuments({ status: 'requested' });
    const adminMenu = Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama', 'broadcast_msg')],
        [Markup.button.callback('📡 Kanallar', 'manage_ch')],
        [Markup.button.callback('📊 Yangilash', 'admin_panel')]
    ]);
    await ctx.replyWithHTML(`<b>🏦 ADMIN PANEL</b>\n\n👤 Jami: ${usersCount}\n📩 Zayavkalar: ${reqCount}`, adminMenu);
};

bot.command('admin', (ctx) => ADMINS.includes(ctx.from.id) && sendAdminPanel(ctx));

// Render serveri uchun
bot.launch();
app.get('/', (req, res) => res.send('Bot is Live!'));
app.listen(process.env.PORT || 3000);














