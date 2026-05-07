require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { initBot } = require('./bot');
const { User, Channel } = require('./models');

// --- INITIALIZATION ---
const app = express();
const bot = initBot(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; 

// Admin holatlarini vaqtinchalik saqlash (Cache)
let adminState = new Map();

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ [DB] MongoDB muvaffaqiyatli ulandi'))
.catch(err => console.error('❌ [DB] Ulanishda xato:', err));

// --- HELPER FUNCTIONS (Professional mantiq) ---
const getAdminKeyboard = (total, reqs) => Markup.inlineKeyboard([
    [Markup.button.callback('📡 Kanallarni boshqarish', 'manage_ch')],
    [Markup.button.callback('📢 Reklama yuborish', 'broadcast')],
    [Markup.button.callback(`🔄 Yangilash (Kutilmoqda: ${reqs})`, 'admin_panel')]
]);

// --- ADMIN COMMAND ---
bot.command('admin', async (ctx) => {
    try {
        if (ctx.from.id !== ADMIN_ID) return;
        const total = await User.countDocuments();
        const reqs = await User.countDocuments({ isVerified: false, gameId: { $ne: null } });
        
        await ctx.replyWithHTML(
            `<b>🏦 ADMIN PANEL</b>\n\n👤 Jami a'zolar: ${total}\n⏳ Tasdiqlash kutayotganlar: ${reqs}`, 
            getAdminKeyboard(total, reqs)
        );
    } catch (e) { console.error('Admin Command Error:', e); }
});

// --- ASOSIY MENYU (MAIN MENU) ---
bot.action('main_menu', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')]
        ]);
        
        const text = `<b>Asosiy menyu:</b>\n\nQuyidagi tugmalardan birini tanlang:`;
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard }).catch(() => ctx.replyWithHTML(text, keyboard));
    } catch (e) { console.error('Main Menu Error:', e); }
});

// --- SIGNAL OLISH VA OBUNA TEKSHIRUVI (MUKAMMAL FILTR) ---
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        await ctx.answerCbQuery();
        const [dbUser, channels] = await Promise.all([
            User.findOne({ userId }).lean(),
            Channel.find().lean()
        ]);

        let mustJoin = [];
        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch.channelId, userId);
                const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
                const isRequested = dbUser?.status === 'requested';

                if (!isMember && !isRequested) mustJoin.push(ch);
                if (member.status === 'left' || member.status === 'kicked') mustJoin.push(ch);
            } catch (e) {
                if (dbUser?.status !== 'requested') mustJoin.push(ch);
            }
        }

        // To'xtatish: Obuna bo'lmaganlar uchun
        if (mustJoin.length > 0) {
            const buttons = mustJoin.map(ch => [Markup.button.url(`📢 OBUNA BO'LISH`, ch.inviteLink)]);
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            return ctx.replyWithHTML(
                `<b>⚠️ DIQQAT!</b>\n\nTerminalga kirish uchun quyidagi kanallarga obuna bo'ling.`, 
                Markup.inlineKeyboard(buttons)
            );
        }

        // To'xtatish: Tasdiqlanmaganlar uchun
        if (!dbUser?.isVerified) {
            return ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\nSignallar faqat bizning promokodimiz bilan ro'yxatdan o'tganlar uchun.\n\n` +
                `1️⃣ <b>RICHI28</b> promokodi bilan akkaunt oching.\n` +
                `2️⃣ Kamida 60,000 so'm depozit qiling.\n` +
                `3️⃣ O'yin ID raqamingizni botga yozib yuboring.`,
                Markup.inlineKeyboard([[Markup.button.url('🌐 Ro\'yxatdan o\'tish', 'https://t.me/apple_ilovalar')]])
            );
        }

        // Ruxsat berish: Terminalni ochish
        await ctx.replyWithHTML(`<b>Terminal tayyor! 🍎</b>\n\nPastdagi tugmani bosing:`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINALNI OCHISH', process.env.WEB_APP_URL)]])
        );

    } catch (err) { console.error("Signal Error:", err); }
});

// --- ADMIN TASDIQLASH TIZIMI ---
bot.action(/^verify_(.+)$/, async (ctx) => {
    try {
        if (ctx.from.id !== ADMIN_ID) return;
        const targetId = ctx.match[1];
        await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
        
        await ctx.telegram.sendMessage(targetId, 
            "<b>Tabriklaymiz! 🎉</b>\n\nID raqamingiz tasdiqlandi. Endi signallarni olishingiz mumkin!", 
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🍎 Signal olish', 'get_signal')]]) }
        );

        await ctx.answerCbQuery("Tasdiqlandi!");
        await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ <b>TASDIQLANDI</b>", { parse_mode: 'HTML' });
    } catch (e) { console.error("Verify Error:", e); }
});

bot.action(/^reject_(.+)$/, async (ctx) => {
    try {
        if (ctx.from.id !== ADMIN_ID) return;
        const targetId = ctx.match[1];
        await ctx.telegram.sendMessage(targetId, "<b>Rad etildi! ❌</b>\n\nID raqamingiz topilmadi yoki depozit qilinmagan.");
        await ctx.answerCbQuery("Rad etildi!");
        await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ <b>RAD ETILDI</b>", { parse_mode: 'HTML' });
    } catch (e) { console.error("Reject Error:", e); }
});

// --- TEXT MESSAGES & ID PROCESSING ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userId === ADMIN_ID) {
        if (text === '/cancel') { adminState.delete(userId); return ctx.reply("Amal bekor qilindi."); }
        if (adminState.get(userId) === 'awaiting_ad') {
            const users = await User.find().lean();
            ctx.reply(`📢 ${users.length} ta foydalanuvchiga yuborilmoqda...`);
            for (const u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
            adminState.delete(userId);
            return ctx.reply("✅ Tayyor.");
        }
        if (text.includes('|')) {
            const [id, name, link] = text.split('|').map(p => p.trim());
            await Channel.create({ channelId: id, channelName: name, inviteLink: link });
            return ctx.reply("✅ Kanal qo'shildi!");
        }
    }

    if (!isNaN(text) && text.length >= 7 && text.length <= 11) {
        await User.findOneAndUpdate({ userId }, { gameId: text }, { upsert: true });
        await ctx.telegram.sendMessage(ADMIN_ID, 
            `<b>🔔 YANGI ID TASDIQLASH</b>\n\n👤: ${ctx.from.first_name}\n🆔: <code>${text}</code>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash', `verify_${userId}`)],
                [Markup.button.callback('❌ Rad etish', `reject_${userId}`)]
            ])
        );
        return ctx.reply("📩 ID qabul qilindi. 5-15 daqiqada tasdiqlanadi.");
    }
});

// --- CHANNEL MANAGEMENT ---
bot.action('admin_panel', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const [total, reqs] = await Promise.all([User.countDocuments(), User.countDocuments({ isVerified: false, gameId: { $ne: null } })]);
    await ctx.editMessageText(`<b>🏦 ADMIN PANEL</b>\n\n👤 A'zolar: ${total}\n⏳ Kutilmoqda: ${reqs}`, { parse_mode: 'HTML', ...getAdminKeyboard(total, reqs) });
});

bot.action('manage_ch', async (ctx) => {
    const channels = await Channel.find().lean();
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.channelName}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ Kanal qo\'shish', 'add_info')], [Markup.button.callback('⬅️ Orqaga', 'admin_panel')]);
    await ctx.editMessageText("<b>📡 Kanallar:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_info', (ctx) => ctx.reply("Kanalni qo'shish uchun: ID | Nomi | Link formatida yuboring."));

bot.action('broadcast', (ctx) => { adminState.set(ctx.from.id, 'awaiting_ad'); ctx.reply("Reklama xabarini yuboring yoki /cancel"); });

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    ctx.reply("Kanal o'chirildi.");
});

// --- ERROR HANDLING & LAUNCH ---
bot.catch((err) => console.error('CRITICAL BOT ERROR:', err));

bot.launch().then(() => console.log('🚀 [BOT] Telegram bot ishga tushdi'));

app.get('/', (req, res) => res.send('Richi28 Apple Bot is running!'));
app.listen(process.env.PORT || 3000, () => console.log('📡 [SERVER] Node.js server online'));

// Graceful Shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
