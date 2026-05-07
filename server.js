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
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, // Kanal nomi/linki
    chatId: String // Kanal ID si
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
const isAdmin = (ctx) => ctx.from.id === ADMIN_ID;

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

const adminMenu = Markup.inlineKeyboard([
    [Markup.button.callback('📢 XABAR YUBORISH', 'admin_broadcast')],
    [Markup.button.callback('📡 KANALLARNI BOSHQARISH', 'manage_channels')],
    [Markup.button.callback('📊 STATISTIKA', 'admin_stats')],
    [Markup.button.callback('🔙 ORQAGA', 'back_to_main')]
]);

// 3. MAIN LOGIC
bot.start(async (ctx) => {
    const user = await User.findOneAndUpdate(
        { userId: ctx.from.id }, 
        { firstName: ctx.from.first_name, username: ctx.from.username }, 
        { upsert: true, new: true }
    );
    await ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!`, getMainMenu(ctx, user.isVerified));
});

// --- ADMIN PANEL FUNKSIYALARI ---
bot.action('admin_main', async (ctx) => {
    if (!isAdmin(ctx)) return;
    await ctx.editMessageText("🛠 <b>Boshqaruv paneli:</b>", { parse_mode: 'HTML', ...adminMenu });
});

bot.action('admin_stats', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const total = await User.countDocuments();
    const vip = await User.countDocuments({ isVerified: true });
    const today = await User.countDocuments({ joinedAt: { $gte: new Date().setHours(0,0,0,0) } });
    
    await ctx.editMessageText(
        `📊 <b>STATISTIKA:</b>\n\nJami a'zolar: <code>${total}</code>\nVIP a'zolar: <code>${vip}</code>\nBugun qo'shilgan: <code>${today}</code>`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'admin_main')]]) }
    );
});

bot.action('admin_broadcast', (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.session.step = 'broadcast';
    ctx.reply("📢 Reklama xabarini yuboring (Rasm, matn, video):");
});

bot.action('manage_channels', async (ctx) => {
    if (!isAdmin(ctx)) return;
    const channels = await Config.find({ key: 'force_channel' });
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.value}`, `delch_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ QO\'SHISH', 'add_ch_name')]);
    buttons.push([Markup.button.callback('🔙 Orqaga', 'admin_main')]);
    await ctx.editMessageText("📡 <b>Majburiy obuna kanallari:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

// --- MESSAGE HANDLER (Admin Steps) ---
bot.on('message', async (ctx) => {
    if (!isAdmin(ctx)) return;

    if (ctx.session.step === 'broadcast') {
        const users = await User.find();
        let count = 0;
        for (const u of users) {
            try { await ctx.copyMessage(u.userId); count++; } catch (e) {}
        }
        ctx.session.step = null;
        return ctx.reply(`✅ Xabar ${count} kishiga yuborildi.`);
    }

    if (ctx.session.step === 'add_ch_name') {
        ctx.session.tempName = ctx.message.text;
        ctx.session.step = 'add_ch_id';
        return ctx.reply("Kanal Chat ID sini yuboring (Masalan: -100...):");
    }

    if (ctx.session.step === 'add_ch_id') {
        ctx.session.tempId = ctx.message.text;
        ctx.session.step = 'add_ch_url';
        return ctx.reply("Kanal linkini yuboring (https://t.me/...):");
    }

    if (ctx.session.step === 'add_ch_url') {
        await Config.create({ key: 'force_channel', value: ctx.session.tempName, chatId: ctx.session.tempId, url: ctx.message.text });
        ctx.session.step = null;
        return ctx.reply("✅ Kanal muvaffaqiyatli qo'shildi!");
    }
});

// --- BACK & VERIFY ACTIONS ---
bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.editMessageText(`<b>Asosiy menyu:</b>`, { parse_mode: 'HTML', ...getMainMenu(ctx, user.isVerified) });
});

bot.action('add_ch_name', (ctx) => {
    ctx.session.step = 'add_ch_name';
    ctx.reply("Kanal nomini yuboring:");
});

bot.action(/^delch_(.+)$/, async (ctx) => {
    await Config.findByIdAndDelete(ctx.match[1]);
    ctx.answerCbQuery("Kanal o'chirildi.");
    ctx.deleteMessage();
});

// Server Launch
bot.launch().then(() => console.log('🚀 BOT ONLINE'));
const app = express();
app.get('/', (req, res) => res.send('Active'));
app.listen(process.env.PORT || 3000);
