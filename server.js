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
    gameId: String,
    isVerified: { type: Boolean, default: false },
    referredBy: { type: Number, default: null },
    referralCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// 2. INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;
bot.use(session());

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

// 3. KEYBOARDS
const userKeyboard = (isVerified) => {
    const buttons = [
        [Markup.button.callback('🍎 SIGNAL OLISH', 'get_signal')],
        [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 REFERAL SILKA OLISH', 'get_referral')]
    ];
    if (isVerified) {
        buttons[0] = [Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL || 'https://google.com')];
    }
    return Markup.inlineKeyboard(buttons);
};

const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📢 REKLAMA YUBORISH', 'admin_broadcast')],
    [Markup.button.callback('📊 STATISTIKA', 'admin_stats')]
]);

// 4. MAIN LOGIC
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, username, referredBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
            try { await bot.telegram.sendMessage(refId, `🔔 Sizda yangi referal!`); } catch(e){}
        }
    }

    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 APPLE professional tizimiga xush kelibsiz.`,
        userKeyboard(user.isVerified)
    );

    if (id === ADMIN_ID) {
        await ctx.reply("🛠 <b>Admin menyu:</b>", adminKeyboard);
    }
});

// Signal olish shartlari
bot.action('get_signal', async (ctx) => {
    const text = `⚠️ <b>RO'YXATDAN O'TISH SHARTLARI:</b>\n\n` +
                 `Signallarni ochish uchun quyidagi ilovalardan birida <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting:\n` +
                 `🔹 1XBET | LINEBET | WINWIN | 888STARZ\n\n` +
                 `📌 <b>DIQQAT:</b> Hisobni minimal 60,000 SO'M (5$ / 400₽) to'ldiring.\n` +
                 `<i>Aks holda tizim sizni tasdiqlamaydi!</i>`;

    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('🚀 RO"YXATDAN O"TISH', 'https://t.me/apple_ilovalar')],
            [Markup.button.callback('✅ RO"YXATDAN O"TDIM', 'submit_id')]
        ])
    });
});

// ID yuborish
bot.action('submit_id', async (ctx) => {
    ctx.session.step = 'await_id';
    await ctx.editMessageText("🆔 <b>O'yin ID raqamingizni yuboring:</b>", { parse_mode: 'HTML' });
});

bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID && ctx.session?.step === 'broadcasting') {
        const users = await User.find();
        let count = 0;
        for (const u of users) {
            try { await ctx.copyMessage(u.userId); count++; } catch(e){}
        }
        ctx.session.step = null;
        return ctx.reply(`✅ Xabar ${count} kishiga yuborildi.`);
    }

    if (ctx.session?.step === 'await_id') {
        const idText = ctx.message.text;
        if (!/^\d+$/.test(idText)) return ctx.reply("❌ Faqat raqam yuboring!");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: idText, status: 'id_submitted' });
        ctx.session.step = null;
        
        await ctx.reply("⏳ <b>ID yuborildi!</b>\nTasdiqlash 15-30 daqiqa oladi. Iltimos kuting.");

        await bot.telegram.sendMessage(ADMIN_ID, 
            `🔔 <b>ID TASDIQLASH:</b>\nUser: ${ctx.from.first_name}\nID: <code>${idText}</code>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `verify_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        );
        return;
    }
    return next();
});

// Referal
bot.action('get_referral', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.replyWithHTML(
        `🔗 <b>Sizning referal silkangiz:</b>\n<code>${link}</code>\n\n` +
        `👥 Taklif qilinganlar: ${user.referralCount} ta\n` +
        `💰 5 ta odam uchun 5,000 so'm.`
    );
});

// Admin
bot.action('admin_broadcast', async (ctx) => {
    ctx.session.step = 'broadcasting';
    await ctx.reply("📢 Reklama xabarini yuboring:");
});

bot.action('admin_stats', async (ctx) => {
    const total = await User.countDocuments();
    const vip = await User.countDocuments({ isVerified: true });
    await ctx.reply(`📊 Jami: ${total}\n✅ VIP: ${vip}`);
});

bot.action(/^verify_(\d+)$/, async (ctx) => {
    const uId = ctx.match[1];
    await User.findOneAndUpdate({ userId: uId }, { isVerified: true });
    await ctx.editMessageText(`✅ User ${uId} tasdiqlandi.`);
    bot.telegram.sendMessage(uId, "🎉 <b>VIP signallar ochildi!</b> /start bosing.");
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    const uId = ctx.match[1];
    await ctx.editMessageText(`❌ User ${uId} rad etildi.`);
    bot.telegram.sendMessage(uId, "⚠️ <b>Rad etildi!</b> Shartlarni qayta bajaring.");
});

bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
