const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR BAZASI
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ MongoDB Connected'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    status: { type: String, default: 'new' }, 
    isVerified: { type: Boolean, default: false },
    gameId: String,
    bookmaker: String,
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 }, 
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, 
    name: String,
    chatId: String,
    url: String
}));

// 2. BOTNI SOZLASH
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// --- YORDAMCHI FUNKSIYALAR ---
async function canAccess(ctx) {
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    
    const user = await User.findOne({ userId: ctx.from.id });
    if (user?.status === 'requested') return true; 

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            if (['member', 'administrator', 'creator'].includes(member.status)) return true;
        } catch (e) { continue; }
    }
    return false;
}

const getMainMenu = (isAdmin, isVerified) => {
    let btns = [
        [isVerified ? Markup.button.webApp('⚡️ Signal olish (VIP)', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
        [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 Yo\'llanma silka', 'ref_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// 3. ASOSIY MANTIQ (START)
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOneAndUpdate(
        { userId: id }, 
        { firstName: first_name }, 
        { upsert: true, new: true }
    );

    if (user.joinedAt.getTime() === user.lastActive?.getTime() && refId && refId !== id) {
        await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }

    if (!(await canAccess(ctx))) {
        const channels = await Config.find({ key: 'channel' });
        const btns = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
        btns.push([Markup.button.callback('✅ Tekshirish', 'check_sub')]);
        return ctx.replyWithHTML(`Assalomu alaykum <b>${first_name}</b>! Botdan foydalanish uchun kanallarga a'zo bo'ling yoki so'rov yuboring.`, Markup.inlineKeyboard(btns));
    }

    ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!`, getMainMenu(id === ADMIN_ID, user.isVerified));
});

bot.action('check_sub', async (ctx) => {
    if (await canAccess(ctx)) {
        const user = await User.findOne({ userId: ctx.from.id });
        return ctx.editMessageText("✅ Tasdiqlandi! Asosiy menyu:", getMainMenu(ctx.from.id === ADMIN_ID, user.isVerified));
    }
    await ctx.answerCbQuery("❌ Obuna topilmadi yoki so'rov yuborilmagan!", { show_alert: true });
});

// 4. SIGNAL BO'LIMI
bot.action('get_signal', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    if (apps.length === 0) return ctx.answerCbQuery("Hozircha ilovalar yo'q.");
    
    const btns = apps.map(a => [Markup.button.callback(a.name, `select_app_${a.name}`)]);
    btns.push([Markup.button.callback('🔙 Orqaga', 'back_home')]);
    ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^select_app_(.+)$/, (ctx) => {
    ctx.session.selectedApp = ctx.match[1];
    ctx.session.step = 'input_id';
    ctx.editMessageText(
        `🎯 <b>PLATFORMA: ${ctx.session.selectedApp}</b>\n\n` +
        `1️⃣ <code>RICHI28</code> promokodi bilan ro'yxatdan o'ting.\n` +
        `2️⃣ Depozit: 60,000 so'm / 5$ / 400R.\n\n` +
        `🆔 <b>ID raqamingizni yuboring:</b>`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]) }
    );
});

// 5. REFERAL TIZIMI
bot.action('ref_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(
        `👥 <b>REFERAL TIZIMI</b>\n\n` +
        `📊 Odamlaringiz: <b>${user.referralCount} ta</b>\n` +
        `🎯 Joriy vazifa: <b>${user.refTask} ta</b>\n\n` +
        `🔗 Link: <code>${link}</code>`,
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([
            [Markup.button.callback('💰 Pul yechish', 'ref_withdraw')],
            [Markup.button.callback('🔙 Orqaga', 'back_home')]
        ])}
    );
});

bot.action('ref_withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const nextTask = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: nextTask, referralCount: 0 });
        ctx.answerCbQuery(`✅ Vazifa bajarildi! Endi yana ${nextTask} ta odam qo'shing.`, { show_alert: true });
    } else {
        ctx.answerCbQuery(`❌ Yana ${user.refTask - user.referralCount} ta odam qo'shishingiz kerak!`, { show_alert: true });
    }
});

// 6. ADMIN PANEL VA BOSHQARUV
bot.action('admin_main', (ctx) => {
    ctx.editMessageText("🛠 <b>ADMIN PANEL</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc')],
        [Markup.button.callback('🔗 Kanallar', 'a_ch'), Markup.button.callback('📱 Ilovalar', 'a_app_manage')],
        [Markup.button.callback('🔙 Chiqish', 'back_home')]
    ]));
});

bot.action('a_ch', async (ctx) => {
    const channels = await Config.find({ key: 'channel' });
    const btns = channels.map(ch => [Markup.button.callback(`❌ ${ch.name}`, `del_cfg_${ch._id}`)]);
    btns.push([Markup.button.callback('➕ Kanal qo\'shish', 'add_ch')]);
    btns.push([Markup.button.callback('🔙 Orqaga', 'admin_main')]);
    ctx.editMessageText("📡 <b>Majburiy obuna kanallari:</b>", Markup.inlineKeyboard(btns));
});

bot.action('add_ch', (ctx) => {
    ctx.session.step = 'ch_name';
    ctx.reply("Kanal nomini yuboring:");
});

bot.action('a_app_manage', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(app => [Markup.button.callback(`❌ ${app.name}`, `del_cfg_${app._id}`)]);
    btns.push([Markup.button.callback('➕ Ilova qo\'shish', 'add_app')]);
    btns.push([Markup.button.callback('🔙 Orqaga', 'admin_main')]);
    ctx.editMessageText("📱 <b>Ilovalar ro'yxati:</b>", Markup.inlineKeyboard(btns));
});

bot.action('add_app', (ctx) => {
    ctx.session.step = 'app_name';
    ctx.reply("Ilova nomini yuboring:");
});

bot.action(/^del_cfg_(.+)$/, async (ctx) => {
    await Config.findByIdAndDelete(ctx.match[1]);
    ctx.answerCbQuery("✅ O'chirildi!");
    ctx.editMessageText("Muvaffaqiyatli o'chirildi.", Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'admin_main')]]));
});

bot.action(/^confirm_(\d+)$/, async (ctx) => {
    const uid = ctx.match[1];
    await User.findOneAndUpdate({ userId: uid }, { isVerified: true });
    bot.telegram.sendMessage(uid, "✅ <b>Ruxsat berildi!</b>\nVIP Signallardan foydalanishingiz mumkin.", getMainMenu(false, true));
    ctx.editMessageText("✅ Tasdiqlandi!");
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "❌ <b>Rad etildi!</b>\nShartlar to'liq bajarilmagan.");
    ctx.editMessageText("❌ Rad etildi!");
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    const today = await User.countDocuments({ joinedAt: { $gte: new Date().setHours(0,0,0,0) } });
    const vip = await User.countDocuments({ isVerified: true });
    ctx.reply(`📊 <b>STATISTIKA:</b>\n\nJami: ${total}\nBugun: ${today}\nVIP: ${vip}`, { parse_mode: 'HTML' });
});

bot.action('a_bc', (ctx) => { ctx.session.step = 'bc'; ctx.reply("Reklama xabarini yuboring:"); });

bot.action('back_home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText("<b>Asosiy menyu:</b>", { parse_mode: 'HTML', ...getMainMenu(ctx.from.id === ADMIN_ID, user.isVerified) });
});

// --- TO'G'RILANGAN TEXT HANDLER ---
bot.on('text', async (ctx, next) => {
    const step = ctx.session.step;

    if (step === 'input_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("❌ Xato! Faqat raqam yuboring.");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.selectedApp });
        ctx.session = {}; // Tozalash
        ctx.reply("⏳ <b>ID qabul qilindi!</b>\nTasdiqlash kutilmoqda.");
        bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>YANGI SO'ROV:</b>\n\n👤: ${ctx.from.first_name}\n🆔: <code>${ctx.message.text}</code>`, Markup.inlineKeyboard([
            [Markup.button.callback('✅ Tasdiqlash', `confirm_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `reject_${ctx.from.id}`)]
        ]));
        return;
    }

    if (ctx.from.id !== ADMIN_ID) return next();

    if (step === 'ch_name') {
        ctx.session.tmpName = ctx.message.text;
        ctx.session.step = 'ch_id';
        return ctx.reply("Kanal Chat ID sini yuboring (-100...):");
    }
    if (step === 'ch_id') {
        ctx.session.tmpId = ctx.message.text;
        ctx.session.step = 'ch_url';
        return ctx.reply("Kanal linkini yuboring:");
    }
    if (step === 'ch_url') {
        await Config.create({ key: 'channel', name: ctx.session.tmpName, chatId: ctx.session.tmpId, url: ctx.message.text });
        ctx.session = {}; // Sessiyani to'liq tozalash!
        return ctx.reply("✅ Kanal qo'shildi!", Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'a_ch')]]));
    }

    if (step === 'app_name') {
        await Config.create({ key: 'app', name: ctx.message.text });
        ctx.session = {}; // Sessiyani to'liq tozalash!
        return ctx.reply("✅ Ilova qo'shildi!", Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'a_app_manage')]]));
    }

    if (step === 'bc') {
        const users = await User.find();
        for (let u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
        ctx.session = {};
        return ctx.reply("✅ Reklama tarqatildi!");
    }
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));

const app = express();
app.get('/', (req, res) => res.send('Active'));
app.listen(process.env.PORT || 3000);
