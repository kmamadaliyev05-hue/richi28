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
    bookmaker: String, // 1xbet, linebet, winwin, 888starz
    gameId: String,
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
});

const channelSchema = new mongoose.Schema({
    name: String,
    chatId: String, // Kanalning ID si (masalan: -100...)
    url: String
});

const User = mongoose.model('User', userSchema);
const Channel = mongoose.model('Channel', channelSchema);

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

// Obunani tekshirish (Kanalda bormi yoki Zayavka yuborganmi)
async function checkSubscription(ctx) {
    const channels = await Channel.find();
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const user = await User.findOne({ userId: ctx.from.id });
            
            // Status: member, administrator, creator bo'lsa yoki bazada 'requested' bo'lsa o'tadi
            const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
            const hasRequested = user && user.status === 'requested';

            if (!isSubscribed && !hasRequested) return false;
        } catch (e) {
            // Agar bot kanalda admin bo'lmasa, faqat bazadagi zayavka statusini tekshiramiz
            const user = await User.findOne({ userId: ctx.from.id });
            if (user && user.status !== 'requested') return false;
        }
    }
    return true;
}

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

// 4. MAIN LOGIC

bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });
    
    await ctx.replyWithHTML(`<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 APPLE tizimida eng aniq signallarni olish uchun pastdagi tugmani bosing.`, userKeyboard(false));
    
    if (id === ADMIN_ID) {
        await ctx.reply("🛠 <b>Admin Panel:</b> /admin");
    }
});

// Zayavka tutish
bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

// Signal olish qismi
bot.action('get_signal', async (ctx) => {
    const isSub = await checkSubscription(ctx);
    
    if (!isSub) {
        const channels = await Channel.find();
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
        buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
        
        return ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignal olish uchun kanalimizga a'zo bo'ling yoki zayavka yuboring:", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
    }

    // Obuna bo'lgan bo'lsa - Bukmeker tanlash
    await ctx.editMessageText("🎯 <b>Qaysi platformada ro'yxatdan o'tgansiz?</b>\n\nTanlang va ID raqamingizni yuboring:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('1XBET', 'book_1xbet'), Markup.button.callback('LINEBET', 'book_linebet')],
            [Markup.button.callback('WINWIN', 'book_winwin'), Markup.button.callback('888STARZ', 'book_888starz')]
        ])
    });
});

// Bukmeker tanlanganda
bot.action(/^book_(.+)$/, async (ctx) => {
    ctx.session.selectedBookmaker = ctx.match[1].toUpperCase();
    ctx.session.step = 'await_id';
    await ctx.editMessageText(`🆔 <b>${ctx.session.selectedBookmaker} ID raqamingizni yuboring:</b>\n\n<i>Eslatma: Faqat RICHI28 promokodi orqali ochilgan ID lar tasdiqlanadi!</i>`, { parse_mode: 'HTML' });
});

// ID qabul qilish
bot.on('text', async (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) return next();

    if (ctx.session.step === 'await_id') {
        const idText = ctx.message.text;
        if (!/^\d+$/.test(idText)) return ctx.reply("❌ Faqat raqam yuboring!");

        await User.findOneAndUpdate({ userId: ctx.from.id }, { 
            gameId: idText, 
            bookmaker: ctx.session.selectedBookmaker,
            status: 'id_submitted' 
        });

        await ctx.reply("⏳ <b>Ma'lumotlar adminga yuborildi.</b>\n15-30 daqiqa ichida tekshirib tasdiqlaymiz!");

        await bot.telegram.sendMessage(ADMIN_ID, 
            `🔔 <b>YANGI ID (TASDIQLASH):</b>\n\n` +
            `👤 User: ${ctx.from.first_name}\n` +
            `🏢 Platforma: <b>${ctx.session.selectedBookmaker}</b>\n` +
            `🆔 ID: <code>${idText}</code>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `verify_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        );
        ctx.session.step = null;
    }
});

// --- ADMIN PANEL ---
bot.command('admin', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.reply("🛠 <b>Admin Panel:</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📢 REKLAMA', 'broadcast')],
        [Markup.button.callback('📡 KANALLAR', 'manage_channels')],
        [Markup.button.callback('📊 STATISTIKA', 'stats')]
    ]));
});

bot.action('manage_channels', async (ctx) => {
    const channels = await Channel.find();
    let text = "📡 <b>Kanallar:</b>\n";
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.name}`, `delch_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ QO\'SHISH', 'add_ch')]);
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_ch', (ctx) => {
    ctx.session.step = 'add_ch_name';
    ctx.reply("Kanal nomini yuboring:");
});

bot.on('message', async (ctx) => {
    if (ctx.from.id === ADMIN_ID) {
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
            await Channel.create({ name: ctx.session.tempName, chatId: ctx.session.tempId, url: ctx.message.text });
            ctx.session.step = null;
            return ctx.reply("✅ Kanal qo'shildi!");
        }
    }
});

bot.action(/^verify_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 <b>VIP signallar ochildi!</b> /start bosing.");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.launch();
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
