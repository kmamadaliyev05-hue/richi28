require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { initBot } = require('./bot');
const { User, Channel } = require('./models');

const app = express();
const bot = initBot(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; 

let adminState = {};

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ DB Error:', err));

// --- ADMIN PANEL KEYBOARD ---
const getAdminKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('📡 Kanallarni boshqarish', 'manage_ch')],
    [Markup.button.callback('📢 Reklama yuborish', 'broadcast')],
    [Markup.button.callback('🔄 Yangilash', 'admin_panel')]
]);

bot.command('admin', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const reqs = await User.countDocuments({ isVerified: false, gameId: { $ne: null } });
    ctx.replyWithHTML(`<b>🏦 ADMIN PANEL</b>\n\n👤 Jami a'zolar: ${total}\n⏳ Tasdiqlash kutayotganlar: ${reqs}`, getAdminKeyboard());
});

// --- MUHIM: BOTNI ISHGA TUSHIRISH TUGMASI (main_menu) ---
bot.action('main_menu', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const text = `<b>Asosiy menyu:</b>\n\nQuyidagi tugmalardan birini tanlang:`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')]
        ]);
        
        // Agar xabar start xabari bo'lsa, uni tahrirlaymiz
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch (e) {
        // Agar tahrirlash iloji bo'lmasa (masalan rasm bo'lsa), yangi xabar yuboramiz
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')]
        ]);
        ctx.replyWithHTML(`<b>Asosiy menyu:</b>`, keyboard);
    }
});

// --- SIGNAL OLISH (PROMOKOD TEKSHIRUVI BILAN) ---
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        await ctx.answerCbQuery();
        const dbUser = await User.findOne({ userId }).lean();
        const channels = await Channel.find().lean();
        let mustJoin = [];

        // 1. Obunani tekshirish
        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch.channelId, userId);
                const isOk = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
                if (!isOk) mustJoin.push(ch);
            } catch (e) { mustJoin.push(ch); }
        }

        if (mustJoin.length > 0) {
            const buttons = mustJoin.map(ch => [Markup.button.url(`📢 ${ch.channelName}`, ch.inviteLink)]);
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            return ctx.replyWithHTML(`<b>⚠️ DIQQAT!</b>\n\nTerminalga kirish uchun quyidagi kanallarga obuna bo'ling:`, Markup.inlineKeyboard(buttons));
        }

        // 2. Promokod va Depozit tekshiruvi (isVerified)
        if (!dbUser?.isVerified) {
            return ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\nSignallar faqat bizning promokodimiz bilan ro'yxatdan o'tganlar uchun.\n\n` +
                `1️⃣ <b>1xBet, Linebet, WinWin</b> yoki <b>888Starz</b> dan birini tanlang.\n` +
                `2️⃣ <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n` +
                `3️⃣ 60,000 so'm depozit qiling.\n` +
                `4️⃣ O'yin ID raqamingizni (8-10 ta raqam) shu yerga yozib yuboring.`,
                Markup.inlineKeyboard([[Markup.button.url('🌐 Ro\'yxatdan o\'tish', 'https://t.me/apple_ilovalar')]])
            );
        }

        // 3. Hamma narsa OK bo'lsa
        await ctx.replyWithHTML(`<b>Terminal tayyor! 🍎</b>`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINALNI OCHISH', process.env.WEB_APP_URL)]])
        );

    } catch (err) { console.error("Signal Error:", err); }
});

// --- ADMIN TASDIQLASH ---
bot.action(/^verify_(.+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = ctx.match[1];
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
    await ctx.telegram.sendMessage(targetId, "<b>Tabriklaymiz! 🎉</b>\n\nID raqamingiz tasdiqlandi. Endi Web App orqali signallarni olishingiz mumkin!", { parse_mode: 'HTML' });
    await ctx.answerCbQuery("Tasdiqlandi!");
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ <b>TASDIQLANDI</b>", { parse_mode: 'HTML' });
});

bot.action(/^reject_(.+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = ctx.match[1];
    await ctx.telegram.sendMessage(targetId, "<b>Rad etildi! ❌</b>\n\nID raqamingiz topilmadi yoki depozit qilinmagan. Iltimos qayta tekshirib yuboring.");
    await ctx.answerCbQuery("Rad etildi!");
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ <b>RAD ETILDI</b>", { parse_mode: 'HTML' });
});

// --- TEXT ISHLOVCHISI ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (userId === ADMIN_ID) {
        if (text === '/cancel') { adminState[userId] = null; return ctx.reply("Bekor qilindi."); }
        if (adminState[userId] === 'awaiting_ad') {
            const users = await User.find();
            ctx.reply(`📢 Reklama tarqatilmoqda...`);
            for (const u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
            adminState[userId] = null;
            return ctx.reply("✅ Tayyor.");
        }
        if (text.includes('|')) {
            const [id, name, link] = text.split('|').map(p => p.trim());
            await Channel.create({ channelId: id, channelName: name, inviteLink: link });
            return ctx.reply("✅ Kanal qo'shildi!");
        }
    }

    if (!isNaN(text) && text.length >= 7) {
        await User.findOneAndUpdate({ userId }, { gameId: text }, { upsert: true });
        await ctx.telegram.sendMessage(ADMIN_ID, 
            `<b>🔔 YANGI ID TASDIQLASH</b>\n\n👤 Foydalanuvchi: ${ctx.from.first_name}\n🆔 ID: <code>${text}</code>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash', `verify_${userId}`)],
                [Markup.button.callback('❌ Rad etish', `reject_${userId}`)]
            ])
        );
        return ctx.reply("📩 ID qabul qilindi! Admin tekshirib 5-15 daqiqada tasdiqlaydi. Iltimos kuting...");
    }
});

bot.action('admin_panel', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const reqs = await User.countDocuments({ isVerified: false, gameId: { $ne: null } });
    await ctx.editMessageText(`<b>🏦 ADMIN PANEL</b>\n\n👤 Jami a'zolar: ${total}\n⏳ Tasdiqlash kutayotganlar: ${reqs}`, { parse_mode: 'HTML', ...getAdminKeyboard() });
});

bot.action('manage_ch', async (ctx) => {
    const channels = await Channel.find();
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.channelName}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('⬅️ Orqaga', 'admin_panel')]);
    await ctx.editMessageText("<b>📡 Kanallar:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('broadcast', (ctx) => { adminState[ctx.from.id] = 'awaiting_ad'; ctx.reply("Reklama xabarini yuboring:"); });

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("O'chirildi!");
    ctx.reply("Kanal o'chirildi.");
});

bot.launch();
app.get('/', (req, res) => res.send('System Live!'));
app.listen(process.env.PORT || 3000);
