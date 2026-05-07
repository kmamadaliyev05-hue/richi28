const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODELS
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // new, registered, id_submitted, verified
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
        buttons[0] = [Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL)];
    }
    return Markup.inlineKeyboard(buttons);
};

const adminKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📢 REKLAMA YUBORISH', 'admin_broadcast')],
    [Markup.button.callback('📊 UMUMIY STATISTIKA', 'admin_stats')]
]);

// 4. LOGIC
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, username, referredBy: refId });
        if (refId && refId !== id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
            try { await bot.telegram.sendMessage(refId, `🔔 Sizda yangi referal! Jami: 5 ta bo'lsa, pul olishingiz mumkin.`); } catch(e){}
        }
    }

    await ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 professional signallar tizimiga xush kelibsiz. Quyidagilardan birini tanlang:`,
        userKeyboard(user.isVerified)
    );

    if (id === ADMIN_ID) {
        await ctx.reply("🛠 <b>Admin Panel:</b>", adminKeyboard);
    }
});

// Signal olish bosqichi
bot.action('get_signal', async (ctx) => {
    const text = `⚠️ <b>DIQQAT! RO'YXATDAN O'TISH SHARTLARI:</b>\n\n` +
                 `Signallarni ochish uchun quyidagi ilovalardan birida <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting:\n` +
                 `🔹 1XBET\n🔹 LINEBET\n🔹 WINWIN\n🔹 888STARZ\n\n` +
                 `📌 <b>MUHIM:</b> Ro'yxatdan o'tgach hisobingizni minimal miqdorda to'ldiring:\n` +
                 `💵 60,000 SO'M / 5$ / 400₽\n\n` +
                 `<i>Aks holda tizim sizni tasdiqlamaydi va bloklaydi!</i>`;

    await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('🚀 RO'YXATDAN O'TISH', 'https://t.me/apple_ilovalar')],
            [Markup.button.callback('✅ RO'YXATDAN O'TDIM', 'submit_id')]
        ])
    });
});

// ID yuborish
bot.action('submit_id', async (ctx) => {
    ctx.session.step = 'await_id';
    await ctx.editMessageText("🆔 <b>O'yin ID raqamingizni yuboring:</b>", { parse_mode: 'HTML' });
});

bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID && ctx.session?.step === 'broadcasting') return next();
    
    if (ctx.session?.step === 'await_id') {
        const idText = ctx.message.text;
        if (!/^\d+$/.test(idText)) return ctx.reply("❌ Xato! Faqat raqam yuboring.");
        
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: idText, status: 'id_submitted' });
        ctx.session.step = null;
        
        await ctx.reply("⏳ <b>Ma'lumot yuborildi!</b>\nTasdiqlash 15-30 daqiqa vaqt oladi. Iltimos kuting.\n\n⚠️ <i>Eslatma: Aldashga urinmang, tizim barcha ID'larni tekshiradi!</i>");

        await bot.telegram.sendMessage(ADMIN_ID, 
            `🔔 <b>YANGI TASDIQLASH:</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${idText}</code>\nPromokod: RICHI28`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `verify_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        );
    }
});

// Referal tizimi
bot.action('get_referral', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.replyWithHTML(
        `🔗 <b>Sizning referal silkangiz:</b>\n<code>${link}</code>\n\n` +
        `👥 Taklif qilinganlar: ${user.referralCount} ta\n` +
        `💰 <b>Haq olish:</b> 5 ta odam uchun 5,000 so'm.\n` +
        `<i>Shart bajarilgach adminga @rich28_admin yozing.</i>`
    );
});

// Admin Actions
bot.action('admin_stats', isAdmin, async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    await ctx.reply(`📊 Jami a'zolar: ${total}\n✅ VIP a'zolar: ${verified}`);
});

bot.action(/^verify_(\d+)$/, isAdmin, async (ctx) => {
    const uId = ctx.match[1];
    await User.findOneAndUpdate({ userId: uId }, { isVerified: true });
    await ctx.editMessageText(`✅ ${uId} tasdiqlandi.`);
    bot.telegram.sendMessage(uId, "🎉 <b>TABRIKLAYMIZ!</b>\nTizimga kirishga ruxsat berildi. /start bosing va VIP tugmani ishlating.");
});

bot.action(/^reject_(\d+)$/, isAdmin, async (ctx) => {
    const uId = ctx.match[1];
    await ctx.editMessageText(`❌ ${uId} rad etildi.`);
    bot.telegram.sendMessage(uId, "⚠️ <b>RAD ETILDI!</b>\nSiz shartlarni bajarmadingiz yoki noto'g'ri ID yubordingiz. Iltimos, RICHI28 promokodi bilan qayta ro'yxatdan o'ting.");
});

// Launch
bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));
const app = express();
app.get('/', (req, res) => res.send('Active'));
app.listen(process.env.PORT || 3000);
