require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- CONFIGURATION ---
const ADMINS = [6137845806]; // Kamronbek ID
const WEB_APP_URL = process.env.WEB_APP_URL;

// --- DATABASE CONNECT ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ DB Connected"))
    .catch(e => console.error("❌ DB Error:", e));

// --- SCHEMAS ---
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

// 1. Zayavkani tutish
bot.on('chat_join_request', async (ctx) => {
    try {
        const { id, first_name, username } = ctx.from;
        await User.findOneAndUpdate(
            { userId: id }, 
            { firstName: first_name, username, status: 'requested' }, 
            { upsert: true, new: true }
        );
        console.log(`✅ Zayavka bazaga yozildi: ${id}`);
    } catch (e) { console.error("Join Request Error:", e); }
});

// 2. Start buyrug'i
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}! 👋</b>\n\nRICHI28 tizimiga xush kelibsiz.`,
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]])
    );
});

// 3. Asosiy menyu
bot.action('main_menu', async (ctx) => {
    try {
        await ctx.editMessageText(`<b>Asosiy menyu:</b>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')],
                [Markup.button.callback('🍎 Signal olish', 'get_signal')],
                [Markup.button.callback('📹 Video qo\'llanma', 'get_tutorial')]
            ])
        });
    } catch (e) { ctx.reply("Xatolik, /start bosing."); }
});

// 4. Signal olish (Zayavka va Obuna tekshiruvi)
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        const channels = await Channel.find();
        if (channels.length === 0) {
            return await ctx.replyWithHTML(`<b>Terminal yuklandi:</b>`, 
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
        }

        const dbUser = await User.findOne({ userId });
        let mustJoin = [];

        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch.channelId, userId);
                const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
                
                if (isSubscribed || (dbUser && dbUser.status === 'requested')) {
                    continue;
                }
                mustJoin.push(ch);
            } catch (e) {
                if (!dbUser || dbUser.status !== 'requested') mustJoin.push(ch);
            }
        }

        if (mustJoin.length === 0) {
            await ctx.replyWithHTML(`<b>Ruxsat berildi! ✅</b>`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', WEB_APP_URL)]]));
        } else {
            const buttons = mustJoin.map(ch => [Markup.button.url(`📢 ${ch.channelName}`, ch.inviteLink)]);
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            await ctx.replyWithHTML(`<b>DIQQAT! ⚠️</b>\n\nTerminalga kirish uchun quyidagi kanalga obuna bo'ling yoki zayavka yuboring:`, Markup.inlineKeyboard(buttons));
        }
    } catch (err) { ctx.reply("Texnik xatolik."); }
});

// --- ADMIN PANEL ---
const sendAdminPanel = async (ctx) => {
    const total = await User.countDocuments();
    const reqs = await User.countDocuments({ status: 'requested' });
    const menu = Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama', 'broadcast')],
        [Markup.button.callback('📡 Kanallar', 'manage_ch')],
        [Markup.button.callback('🔄 Yangilash', 'admin_panel')]
    ]);
    const text = `<b>🏦 ADMIN PANEL</b>\n\n👤 Jami: <b>${total}</b>\n📩 Zayavkalar: <b>${reqs}</b>`;
    if (ctx.callbackQuery) await ctx.editMessageText(text, { parse_mode: 'HTML', ...menu });
    else await ctx.replyWithHTML(text, menu);
};

bot.command('admin', (ctx) => ADMINS.includes(ctx.from.id) && sendAdminPanel(ctx));
bot.action('admin_panel', (ctx) => sendAdminPanel(ctx));

// Kanallar boshqaruvi
bot.action('manage_ch', async (ctx) => {
    const channels = await Channel.find();
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.channelName}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('⬅️ Orqaga', 'admin_panel')]);
    await ctx.editMessageText("<b>📡 Kanallar:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_ch', ctx => ctx.replyWithHTML("Format: <code>ID | Nomi | Link</code>"));

// Text xabarlarni tutish (Kanal qo'shish va Reklama uchun)
bot.on('text', async (ctx) => {
    if (!ADMINS.includes(ctx.from.id)) return;
    
    // Kanal qo'shish
    if (ctx.message.text.includes('|')) {
        const [id, name, link] = ctx.message.text.split('|').map(p => p.trim());
        await Channel.create({ channelId: id, channelName: name, inviteLink: link });
        return ctx.reply("✅ Kanal qo'shildi!");
    }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("O'chirildi!");
    return sendAdminPanel(ctx);
});

// --- SERVER ---
bot.launch();
app.get('/', (req, res) => res.send('Bot Live!'));
app.listen(process.env.PORT || 3000);
