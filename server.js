const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
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

// --- YORDAMCHI FUNKSIYALAR ---
const isAdmin = (ctx) => ctx.from.id === ADMIN_ID;

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

// SIGNAL OLISH TUGMASI VA OBUNA TEKSHIRUVI
bot.action('get_signal', async (ctx) => {
    const isSub = await checkSub(ctx);
    if (!isSub) {
        const channels = await Config.find({ key: 'force_channel' });
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.url)]);
        buttons.push([Markup.button.callback('✅ Tekshirish', 'get_signal')]);
        
        return ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignal olish uchun kanalimizga a'zo bo'ling yoki zayavka yuboring:", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
    }

    await ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('1XBET', 'book_1'), Markup.button.callback('LINEBET', 'book_2')],
            [Markup.button.callback('WINWIN', 'book_3'), Markup.button.callback('888STARZ', 'book_4')],
            [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
        ])
    });
});

// REFERAL SILKA TUGMASI
bot.action('referral_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.editMessageText(
        `🔗 <b>Sizning referal silkangiz:</b>\n<code>${link}</code>\n\n👥 Taklif qilinganlar: ${user.referralCount} ta\n💰 5 ta odam uchun 5,000 so'm.`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'back_to_main')]]) }
    );
});

// ORQAGA TUGMASI
bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, { parse_mode: 'HTML', ...getMainMenu(ctx, user.isVerified) });
});

// --- ADMIN PANEL ---
bot.action('admin_main', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.editMessageText("🛠 <b>Admin Boshqaruv Paneli:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 XABAR YUBORISH', 'admin_broadcast')],
            [Markup.button.callback('📡 KANALLARNI BOSHQARISH', 'manage_channels')],
            [Markup.button.callback('📊 STATISTIKA', 'admin_stats')],
            [Markup.button.callback('🔙 ORQAGA', 'back_to_main')]
        ])
    });
});

bot.action('admin_stats', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const total = await User.countDocuments();
    const vip = await User.countDocuments({ isVerified: true });
    await ctx.reply(`📊 Jami: ${total}\n✅ VIP: ${vip}`);
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

// Server Launch
bot.launch().then(() => console.log('🚀 BOT IS WORKING'));
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
