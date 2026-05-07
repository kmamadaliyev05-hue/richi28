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

const channelSchema = new mongoose.Schema({
    name: String,
    url: String
});

const User = mongoose.model('User', userSchema);
const Channel = mongoose.model('Channel', channelSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

// Sessiyani to'g'ri ishga tushirish
bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

// 3. KEYBOARDS
const userKeyboard = (isVerified) => {
    const buttons = [
        [Markup.button.callback('🍎 SIGNAL OLISH', 'get_signal')],
        [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 REFERAL SILKA OLISH', 'get_referral')]
    ];
    if (isVerified) {
        buttons[0] = [Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)];
    }
    return Markup.inlineKeyboard(buttons);
};

const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📢 REKLAMA TARQATISH', 'admin_broadcast')],
    [Markup.button.callback('📊 STATISTIKA', 'admin_stats')],
    [Markup.button.callback('📡 KANALLARNI BOSHQARISH', 'manage_channels')]
]);

// 4. MAIN LOGIC
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    let user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true, new: true });

    await ctx.replyWithHTML(`<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 APPLE professional tizimiga xush kelibsiz.`, userKeyboard(user.isVerified));
    if (id === ADMIN_ID) await ctx.reply("🛠 <b>Admin Panel:</b>", adminKeyboard);
});

// SIGNAL OLISH SHARTLARI
bot.action('get_signal', async (ctx) => {
    const text = `⚠️ <b>RO'YXATDAN O'TISH SHARTLARI:</b>\n\nSignallarni ochish uchun <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n\n📌 <b>DIQQAT:</b> Hisobni minimal 60,000 SO'M (5$ / 400₽) to'ldiring.`;
    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('🚀 RO"YXATDAN O"TISH', 'https://t.me/apple_ilovalar')],
            [Markup.button.callback('✅ RO"YXATDAN O"TDIM', 'submit_id')]
        ])
    });
});

bot.action('submit_id', (ctx) => {
    ctx.session.step = 'await_id';
    ctx.reply("🆔 <b>O'yin ID raqamingizni yuboring:</b>", { parse_mode: 'HTML' });
});

// REFERAL
bot.action('get_referral', async (ctx) => {
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.replyWithHTML(`🔗 <b>Sizning referal silkangiz:</b>\n<code>${link}</code>\n\n💰 5 ta odam uchun 5,000 so'm.`);
});

// --- ADMIN ACTIONS ---

bot.action('admin_stats', async (ctx) => {
    const total = await User.countDocuments();
    const vip = await User.countDocuments({ isVerified: true });
    await ctx.reply(`📊 Jami: ${total}\n✅ VIP: ${vip}`);
});

bot.action('admin_broadcast', (ctx) => {
    ctx.session.step = 'broadcasting';
    ctx.reply("📢 Reklama xabarini yuboring (Matn, rasm, video yoki silka):");
});

bot.action('manage_channels', async (ctx) => {
    const channels = await Channel.find();
    let text = "📡 <b>Kanallar ro'yxati:</b>\n\n";
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.name}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ KANAL QO\'SHISH', 'add_channel')]);
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
});

bot.action('add_channel', (ctx) => {
    ctx.session.step = 'add_ch_name';
    ctx.reply("Kanal nomini yuboring:");
});

// --- MESSAGE HANDLER ---
bot.on('message', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID && ctx.session.step === 'await_id') {
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>YANGI ID:</b> <code>${ctx.message.text}</code>`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ TASDIQLASH', `verify_${ctx.from.id}`)],
            [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
        ]));
        ctx.session.step = null;
        return ctx.reply("⏳ ID yuborildi, kuting.");
    }

    if (ctx.from.id === ADMIN_ID) {
        if (ctx.session.step === 'broadcasting') {
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
            ctx.session.step = 'add_ch_url';
            return ctx.reply("Endi kanal linkini yuboring (https://t.me/...):");
        }
        if (ctx.session.step === 'add_ch_url') {
            await Channel.create({ name: ctx.session.tempName, url: ctx.message.text });
            ctx.session.step = null;
            return ctx.reply("✅ Kanal qo'shildi!");
        }
    }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    await ctx.reply("✅ Kanal o'chirildi.");
});

bot.action(/^verify_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 VIP ruxsat berildi! /start bosing.");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

// SERVER LAUNCH
bot.launch();
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
