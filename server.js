const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE SETUP
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ DB Connected'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    isVerified: { type: Boolean, default: false },
    bookmaker: String,
    gameId: String,
    referralCount: { type: Number, default: 0 },
    referredBy: { type: Number, default: null },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, // 'force_channel' yoki 'app'
    name: String,
    chatId: String,
    url: String
}));

// 2. BOT INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// --- HELPERS ---
async function isSubscribed(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const subStatus = ['member', 'administrator', 'creator'].includes(member.status);
            const user = await User.findOne({ userId: ctx.from.id });
            if (!subStatus && user?.status !== 'requested') return false;
        } catch (e) { return false; }
    }
    return true;
}

const mainKb = (isAdmin, isVerified) => {
    let btns = [
        [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
        [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 Yo\'llanma silka', 'ref_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// 3. CORE LOGIC
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, referredBy: refId });
        if (refId && refId !== id) await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }

    if (!(await isSubscribed(ctx))) {
        const channels = await Config.find({ key: 'force_channel' });
        const btns = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
        btns.push([Markup.button.callback('✅ Tekshirish', 'start_check')]);
        return ctx.replyWithHTML(`<b>Assalomu alaykum ${first_name}!</b>\nBotdan o'tish uchun kanallarga a'zo bo'ling.`, Markup.inlineKeyboard(btns));
    }
    ctx.replyWithHTML(`<b>RICHI28 APPLE ASOSIY MENYU:</b>`, mainKb(id === ADMIN_ID, user.isVerified));
});

bot.action('start_check', (ctx) => ctx.deleteMessage() && ctx.scene?.enter('start') || ctx.reply('/start bosing.'));

// 4. SIGNAL & VERIFICATION
bot.action('get_signal', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.isVerified) return ctx.editMessageText("VIP menyu ochildi!", mainKb(isAdmin(ctx), true));

    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `set_${a.name}`)]);
    btns.push([Markup.button.callback('🔙 Orqaga', 'back_home')]);
    ctx.editMessageText("🎯 <b>Ilovani tanlang:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^set_(.+)$/, (ctx) => {
    ctx.session.book = ctx.match[1];
    ctx.session.step = 'await_id';
    ctx.editMessageText(`📌 <b>PROMO:</b> <code>RICHI28</code>\nMin depozit: 60,000 so'm\n\n🆔 <b>ID raqamingizni yuboring:</b>`, { 
        parse_mode: 'HTML', 
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]) 
    });
});

bot.on('text', async (ctx, next) => {
    if (ctx.session.step === 'await_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("❌ Faqat raqam yuboring!");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.book, status: 'id_submitted' });
        ctx.session.step = null;
        ctx.reply("⏳ 15-30 daqiqa kuting...");
        bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>YANGI ID:</b>\n${ctx.session.book}: <code>${ctx.message.text}</code>`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `verify_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `reject_${ctx.from.id}`)]
        ]));
        return;
    }
    if (ctx.from.id === ADMIN_ID && ctx.session.step === 'broadcast') {
        const users = await User.find();
        for (let u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
        ctx.session.step = null;
        return ctx.reply("✅ Yuborildi.");
    }
});

// 5. REFERAL (5-4-3-2-1)
bot.action('ref_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(`🔗 <b>Sizning linkigiz:</b>\n<code>${link}</code>\n\n👥 Odamlar: ${user.referralCount}\n🎯 Vazifa: ${user.refTask} ta`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('💰 Pul yechish', 'withdraw')], [Markup.button.callback('🔙 Orqaga', 'back_home')]])
    });
});

bot.action('withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const next = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: next, referralCount: 0 });
        ctx.answerCbQuery(`✅ Vazifa bajarildi! Endi yana ${next} ta...`, { show_alert: true });
        bot.telegram.sendMessage(ADMIN_ID, `💰 <b>VAZIFA BITDI:</b> ${user.firstName} (ID: ${user.userId})`);
    } else ctx.answerCbQuery(`Yana ${user.refTask - user.referralCount} ta odam qo'shing!`, { show_alert: true });
});

// 6. ADMIN PANEL
bot.action('admin_main', (ctx) => ctx.editMessageText("🛠 <b>Admin:</b>", Markup.inlineKeyboard([
    [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('📢 Reklama', 'a_msg')],
    [Markup.button.callback('🔗 Kanallar', 'a_ch'), Markup.button.callback('📱 Ilovalar', 'a_apps')],
    [Markup.button.callback('🔙 Chiqish', 'back_home')]
])));

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    ctx.answerCbQuery(`Jami: ${total} | VIP: ${verified}`, { show_alert: true });
});

bot.action('a_msg', (ctx) => { ctx.session.step = 'broadcast'; ctx.reply("Xabar yuboring:"); });

bot.action('back_home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText("<b>Asosiy menyu:</b>", { parse_mode: 'HTML', ...mainKb(ctx.from.id === ADMIN_ID, user.isVerified) });
});

bot.action(/^verify_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 Ruxsat berildi! /start bosing.");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

bot.launch();
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
