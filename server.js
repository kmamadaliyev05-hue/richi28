require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- CONFIGURATION ---
const ADMINS = [6137845806]; 
const WEB_APP_URL = process.env.WEB_APP_URL;

// --- DATABASE SCHEMAS ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ DB Connected"))
    .catch(e => console.log("❌ DB Error:", e));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'none' },
    joinedAt: { type: Date, default: Date.now }
}));

const Channel = mongoose.model('Channel', new mongoose.Schema({
    channelId: String,
    channelName: String,
    inviteLink: String
}));

// --- LOGIC ---

// 1. ZAYAVKANI TUTISH
bot.on('chat_join_request', async (ctx) => {
    try {
        const { id, first_name, username } = ctx.from;
        await User.findOneAndUpdate(
            { userId: id }, 
            { firstName: first_name, username, status: 'requested' }, 
            { upsert: true }
        );
    } catch (e) { console.log("Join Request Error:", e); }
});

// 2. START BUYRUG'I
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}! 👋</b>\n\n` +
        `RICHI28 tizimiga xush kelibsiz. Davom etish uchun tugmani bosing:`,
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]])
    );
});

// 3. ASOSIY MENYU
bot.action('main_menu', async (ctx) => {
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')],
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.callback('📹 Video qo\'llanma', 'get_tutorial')]
        ])
    });
});

// 4. SIGNAL OLISH (OBUNA TEKSHIRISH)
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    const channels = await Channel.find();
    
    if (channels.length === 0) {
        return ctx.replyWithHTML(`<b>Terminal yuklandi:</b>`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
    }

    let mustJoin = [];
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.channelId, userId);
            if (!['member', 'administrator', 'creator'].includes(member.status)) {
                const user = await User.findOne({ userId });
                if (user?.status !== 'requested') mustJoin.push(ch);
            }
        } catch (e) { mustJoin.push(ch); }
    }

    if (mustJoin.length === 0) {
        await ctx.replyWithHTML(`<b>Ruxsat berildi! ✅</b>`,
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
    } else {
        const buttons = mustJoin.map(ch => [Markup.button.url(ch.channelName, ch.inviteLink)]);
        buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
        await ctx.replyWithHTML(`<b>DIQQAT! ⚠️</b>\n\nTerminalga kirish uchun quyidagi kanallarga zayavka yuboring:`, Markup.inlineKeyboard(buttons));
    }
});

// --- ADMIN PANEL ---
bot.command('admin', async (ctx) => {
    if (!ADMINS.includes(ctx.from.id)) return;
    const users = await User.countDocuments();
    const adminMenu = Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama', 'broadcast')],
        [Markup.button.callback('📡 Kanallar', 'manage_ch')],
        [Markup.button.callback('📊 Statistika', 'stats')]
    ]);
    ctx.replyWithHTML(`<b>🏦 ADMIN PANEL</b>\n\nFoydalanuvchilar: ${users}`, adminMenu);
});

// Kanallarni boshqarish
bot.action('manage_ch', async (ctx) => {
    const channels = await Channel.find();
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.channelName}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('⬅️ Orqaga', 'main_menu')]);
    ctx.editMessageText("<b>📡 Kanallar:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_ch', ctx => ctx.reply("Format: <code>ID | Nomi | Link</code>", { parse_mode: 'HTML' }));

bot.on('text', async (ctx) => {
    if (!ADMINS.includes(ctx.from.id)) return;
    if (ctx.message.text.includes('|')) {
        const [id, name, link] = ctx.message.text.split('|').map(p => p.trim());
        await Channel.create({ channelId: id, channelName: name, inviteLink: link });
        ctx.reply("✅ Qo'shildi!");
    }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    ctx.answerCbQuery("O'chirildi!");
});

bot.launch();
app.get('/', (req, res) => res.send('Bot is Live!'));
app.listen(process.env.PORT || 3000);
