const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. MA'LUMOTLAR BAZASI
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ MongoDB Connected');
    try {
        await mongoose.connection.db.collection('configs').dropIndexes();
    } catch (e) { console.log('ℹ️ Indekslar toza'); }
    seedApps(); 
});

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
    key: String, name: String, chatId: String, url: String
}, { autoIndex: false, validateBeforeSave: false, timestamps: true }));

async function seedApps() {
    const defaultApps = ['1XBET', 'LINEBET', 'WINWIN', '888STARZ'];
    for (const appName of defaultApps) {
        const exists = await Config.findOne({ key: 'app', name: appName });
        if (!exists) await Config.create({ key: 'app', name: appName });
    }
}

// 2. BOT SOZLAMALARI
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// --- YORDAMCHI FUNKSIYALAR ---
async function canAccess(ctx) {
    if (ctx.from.id === ADMIN_ID) return true;
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

// 3. START
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    ctx.session = {};
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true, new: true });
    if (user.joinedAt.getTime() === user.lastActive?.getTime() && refId && refId !== id) {
        await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }
    if (!(await canAccess(ctx))) {
        const channels = await Config.find({ key: 'channel' });
        const btns = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
        btns.push([Markup.button.callback('✅ Tekshirish', 'check_sub')]);
        return ctx.replyWithHTML(`Assalomu alaykum <b>${first_name}</b>! Obuna bo'ling:`, Markup.inlineKeyboard(btns));
    }
    ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!\n\n👤 Ism: <b>${first_name}</b>\n🆔 ID: <code>${id}</code>`, getMainMenu(id === ADMIN_ID, user.isVerified));
});

bot.action('check_sub', async (ctx) => {
    if (await canAccess(ctx)) {
        const user = await User.findOne({ userId: ctx.from.id });
        return ctx.editMessageText("✅ Tasdiqlandi!", getMainMenu(ctx.from.id === ADMIN_ID, user.isVerified));
    }
    await ctx.answerCbQuery("❌ Obuna topilmadi!", { show_alert: true });
});

// 4. SIGNAL & REFERRAL (BIR XIL QOLDI)
bot.action('get_signal', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    if (apps.length === 0) return ctx.answerCbQuery("Hozircha ilovalar yo'q.");
    const btns = apps.map(a => [Markup.button.callback(a.name, `select_app_${a.name}`)]);
    btns.push([Markup.button.callback('🔙 Orqaga', 'back_home')]);
    ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^select_app_(.+)$/, (ctx) => {
    ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'input_id';
    ctx.editMessageText(`🎯 PLATFORMA: ${ctx.session.selectedApp}\n\n🆔 ID yuboring:`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]));
});

bot.action('ref_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(`👥 REFERAL\n📊 Odamlar: ${user.referralCount}\n🎯 Vazifa: ${user.refTask}\n\n🔗 Link: <code>${link}</code>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('💰 Pul yechish', 'ref_withdraw')], [Markup.button.callback('🔙 Orqaga', 'back_home')]]) });
});

bot.action('ref_withdraw', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (user.referralCount >= user.refTask) {
        const nextTask = user.refTask > 1 ? user.refTask - 1 : 1;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { refTask: nextTask, referralCount: 0 });
        ctx.answerCbQuery(`✅ Vazifa bajarildi!`, { show_alert: true });
    } else ctx.answerCbQuery(`❌ Yana ${user.refTask - user.referralCount} ta odam qo'shing!`, { show_alert: true });
});

// 5. ADMIN & REKLAMA MANTIQI
bot.action('admin_main', (ctx) => {
    ctx.editMessageText("🛠 <b>ADMIN PANEL</b>", Markup.inlineKeyboard([[Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc')], [Markup.button.callback('🔗 Kanallar', 'a_ch'), Markup.button.callback('📱 Ilovalar', 'a_app_manage')], [Markup.button.callback('🔙 Chiqish', 'back_home')]]));
});

bot.action('a_bc', (ctx) => { 
    ctx.session.step = 'bc_media'; 
    ctx.reply("Xabarni yuboring (Rasm, Video yoki Matn):"); 
});

bot.action(/^confirm_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "✅ Tasdiqlandi!");
    ctx.editMessageText("Tasdiqlandi.");
});

bot.action(/^reject_(\d+)$/, async (ctx) => {
    bot.telegram.sendMessage(ctx.match[1], "❌ Rad etildi.");
    ctx.editMessageText("Rad etildi.");
});

bot.action('a_app_manage', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(app => [Markup.button.callback(`❌ ${app.name}`, `del_cfg_${app._id}`)]);
    btns.push([Markup.button.callback('➕ Qo\'shish', 'add_app'), Markup.button.callback('🔙 Orqaga', 'admin_main')]);
    ctx.editMessageText("📱 Ilovalar:", Markup.inlineKeyboard(btns));
});

bot.action('add_app', (ctx) => { ctx.session.step = 'app_name'; ctx.reply("Ilova nomi:"); });

bot.action(/^del_cfg_(.+)$/, async (ctx) => {
    await Config.findByIdAndDelete(ctx.match[1]);
    ctx.editMessageText("O'chirildi.", Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'admin_main')]]));
});

bot.action('back_home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText("Asosiy menyu:", { parse_mode: 'HTML', ...getMainMenu(ctx.from.id === ADMIN_ID, user.isVerified) });
});

// --- TOG'RILANGAN TEXT & MEDIA HANDLER ---
bot.on(['text', 'photo', 'video', 'animation'], async (ctx) => {
    const step = ctx.session.step;

    // ID Yuborish (Tasdiqlash xabarida link qo'shildi)
    if (step === 'input_id' && ctx.message.text) {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("Faqat raqam!");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.selectedApp });
        ctx.session = {};
        ctx.reply("⏳ Qabul qilindi!");
        bot.telegram.sendMessage(ADMIN_ID, 
            `🆔 ID: <code>${ctx.message.text}</code>\n` +
            `👤 Foydalanuvchi: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`, 
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash', `confirm_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `reject_${ctx.from.id}`)]]) }
        );
        return;
    }

    if (ctx.from.id !== ADMIN_ID) return;

    // Media Reklama yuborish
    if (step === 'bc_media') {
        const users = await User.find();
        let count = 0;
        ctx.reply("⏳ Tarqatish boshlandi...");
        for (let u of users) {
            try {
                await ctx.copyMessage(u.userId);
                count++;
            } catch (e) {}
        }
        ctx.session = {};
        return ctx.reply(`✅ Reklama ${count} ta foydalanuvchiga yetkazildi!`);
    }

    if (step === 'app_name') {
        await Config.create({ key: 'app', name: ctx.message.text });
        ctx.session = {};
        return ctx.reply("✅ Qo'shildi!", Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'a_app_manage')]]));
    }
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));
const app = express();
app.get('/', (req, res) => res.send('Online'));
app.listen(process.env.PORT || 3000);
