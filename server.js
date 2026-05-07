const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, 
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});
const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, 
    chatId: String 
});
const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

// --- HELPERS ---
const isAdmin = (ctx) => ctx.from && ctx.from.id === ADMIN_ID;

async function checkSub(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const isSub = ['member', 'administrator', 'creator'].includes(member.status);
            if (isSub) return true;
        } catch (e) {
            const user = await User.findOne({ userId: ctx.from.id });
            if (user?.status === 'requested') return true;
        }
    }
    return false;
}

const getMainMenu = (ctx, isVerified) => {
    const buttons = [
        [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
        [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 REFERAL SILKA', 'referral_menu')]
    ];
    if (isAdmin(ctx)) {
        buttons.push([Markup.button.callback('🛠 ADMIN PANEL', 'admin_main')]);
    }
    return Markup.inlineKeyboard(buttons);
};

// 3. MAIN LOGIC
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, username, referredBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
        }
    }

    await ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!`, getMainMenu(ctx, user.isVerified));
});

// SIGNAL OLISH VA OBUNA TEKSHIRUVI (XATO TUZATILDI)
bot.action('get_signal', async (ctx) => {
    try {
        const isSub = await checkSub(ctx);
        if (!isSub) {
            const channels = await Config.find({ key: 'force_channel' });
            
            // Xatolik shu yerda edi: Har bir tugmada URL bo'lishi shart!
            const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.value.startsWith('http') ? ch.value : `https://t.me/${ch.value.replace('@','')}`)]);
            
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            
            return ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignal olish uchun kanalimizga a'zo bo'ling yoki zayavka yuboring:", {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(buttons)
            });
        }

        // Agar obuna bo'lgan bo'lsa - Bukmekerlar
        await ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('1XBET', 'book_1'), Markup.button.callback('LINEBET', 'book_2')],
                [Markup.button.callback('WINWIN', 'book_3'), Markup.button.callback('888STARZ', 'book_4')],
                [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
            ])
        });
    } catch (e) { console.error("Signal Action Error:", e); }
});

bot.action('referral_menu', async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
        await ctx.editMessageText(
            `🔗 <b>Sizning referal silkangiz:</b>\n<code>${link}</code>\n\n👥 Taklif qilinganlar: ${user.referralCount} ta\n💰 5 ta odam uchun 5,000 so'm.`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'back_to_main')]]) }
        );
    } catch (e) { console.error(e); }
});

bot.action('back_to_main', async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        await ctx.editMessageText(`<b>Asosiy menyu:</b>`, { parse_mode: 'HTML', ...getMainMenu(ctx, user.isVerified) });
    } catch (e) { console.error(e); }
});

bot.action('admin_main', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.editMessageText("🛠 <b>Admin Panel:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 REKLAMA', 'admin_broadcast')],
            [Markup.button.callback('📡 KANALLAR', 'manage_channels')],
            [Markup.button.callback('📊 STATISTIKA', 'admin_stats')],
            [Markup.button.callback('🔙 ORQAGA', 'back_to_main')]
        ])
    });
});

bot.on('chat_join_request', async (ctx) => {
    try {
        await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
    } catch (e) { console.error(e); }
});

// Server Launch
bot.launch().then(() => console.log('🚀 BOT ONLINE'));
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
