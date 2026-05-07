require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { initBot } = require('./bot');
const { User, Channel } = require('./models');

const app = express();
const bot = initBot(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; 

// Admin holatlarini saqlash uchun
let adminState = {};

// --- MONGODB ULANISHI ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB muvaffaqiyatli ulandi'))
    .catch(err => console.error('❌ MongoDB ulanishida xato:', err));

// --- ADMIN KLAVIATURASI ---
const getAdminKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('📡 Kanallarni boshqarish', 'manage_ch')],
    [Markup.button.callback('📢 Reklama yuborish', 'broadcast')],
    [Markup.button.callback('🔄 Yangilash', 'admin_panel')]
]);

// --- ADMIN COMMAND ---
bot.command('admin', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const reqs = await User.countDocuments({ isVerified: false, gameId: { $ne: null } });
    ctx.replyWithHTML(
        `<b>🏦 ADMIN PANEL</b>\n\n` +
        `👤 Jami a'zolar: ${total}\n` +
        `⏳ Tasdiqlash kutayotganlar: ${reqs}`, 
        getAdminKeyboard()
    );
});

// --- ASOSIY MENYU (MAIN MENU) ---
bot.action('main_menu', async (ctx) => {
    try {
        await ctx.answerCbQuery();
        const text = `<b>Asosiy menyu:</b>\n\nQuyidagi tugmalardan birini tanlang:`;
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')]
        ]);
        
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
    } catch (e) {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('🍎 Signal olish', 'get_signal')],
            [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')]
        ]);
        ctx.replyWithHTML(`<b>Asosiy menyu:</b>`, keyboard);
    }
});

// --- SIGNAL OLISH VA OBUNA TEKSHIRUVI ---
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        await ctx.answerCbQuery();
        
        // 1. Foydalanuvchini bazadan qidiramiz
        const dbUser = await User.findOne({ userId }).lean();
        const channels = await Channel.find().lean();
        let mustJoin = [];

        // 2. Kanallarni qat'iy tekshiramiz
        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch.channelId, userId);
                
                // Telegram statuslari
                const isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
                
                // MUHIM: Agar foydalanuvchi kanalda bo'lmasa VA bazada hali 'requested' bo'lmasa, uni to'xtatamiz
                // statusni kichik harflarda 'requested' ekanligini aniq tekshiramiz
                if (!isMember && String(dbUser?.status).toLowerCase() !== 'requested') {
                    mustJoin.push(ch);
                }
            } catch (e) {
                // Agar foydalanuvchi kanalda topilmasa, lekin zayavka yuborgan bo'lsa - o'tkazamiz
                if (String(dbUser?.status).toLowerCase() !== 'requested') {
                    mustJoin.push(ch);
                }
            }
        }

        // 3. Agar hali obuna bo'lmagan va zayavka ham yubormagan bo'lsa
        if (mustJoin.length > 0) {
            const buttons = mustJoin.map(ch => [Markup.button.url(`📢 OBUNA BO'LISH`, ch.inviteLink)]);
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            return ctx.replyWithHTML(
                `<b>⚠️ DIQQAT!</b>\n\nTerminalga kirish uchun quyidagi kanallarga obuna bo'ling. Agar kanaldan chiqib ketsangiz, signal berilmaydi!`, 
                Markup.inlineKeyboard(buttons)
            );
        }

        // 4. Agar obunadan o'tgan bo'lsa, verifikatsiyani tekshirish
        if (!dbUser?.isVerified) {
            return ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\nSignallar faqat bizning promokodimiz bilan ro'yxatdan o'tganlar uchun.\n\n` +
                `1️⃣ <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n` +
                `2️⃣ Kamida 60,000 so'm depozit qiling.\n` +
                `3️⃣ O'yin ID raqamingizni botga yozib yuboring.`,
                Markup.inlineKeyboard([[Markup.button.url('🌐 Ro\'yxatdan o\'tish', 'https://t.me/apple_ilovalar')]])
            );
        }

        // 5. Hamma narsa OK bo'lsa Terminalni ochamiz
        await ctx.replyWithHTML(`<b>Terminal tayyor! 🍎</b>`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINALNI OCHISH', process.env.WEB_APP_URL)]])
        );

    } catch (err) { 
        console.error("Signal Error:", err);
    }
});

        // 2. Verifikatsiya Tekshiruvi (Promokod va Depozit)
        if (!dbUser?.isVerified) {
            return ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\nSignallar faqat bizning promokodimiz bilan ro'yxatdan o'tganlar uchun.\n\n` +
                `1️⃣ <b>1xBet, Linebet, WinWin</b> yoki <b>888Starz</b> ilovasini oching.\n` +
                `2️⃣ <b>RICHI28</b> promokodi bilan yangi akkaunt oching.\n` +
                `3️⃣ Kamida 60,000 so'm depozit qiling.\n` +
                `4️⃣ O'yin ID raqamingizni (8-10 ta raqam) botga yozib yuboring.`,
                Markup.inlineKeyboard([[Markup.button.url('🌐 Ro\'yxatdan o\'tish', 'https://t.me/apple_ilovalar')]])
            );
        }

        // 3. Hamma narsa OK bo'lsa Web App ni ochish
        await ctx.replyWithHTML(`<b>Terminal tayyor! 🍎</b>\n\nPastdagi tugmani bosing va o'yinni boshlang.`, 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINALNI OCHISH', process.env.WEB_APP_URL)]])
        );

    } catch (err) { 
        console.error("Signal Error:", err); 
        ctx.reply("Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
    }
});

// --- ADMIN TASDIQLASH (INLINE TUGMA BILAN JAVOB) ---
bot.action(/^verify_(.+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = ctx.match[1];

    try {
        await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
        
        // FOYDALANUVCHIGA SIGNAL TUGMASI BILAN XABAR YUBORISH
        await ctx.telegram.sendMessage(targetId, 
            "<b>Tabriklaymiz! 🎉</b>\n\n" +
            "Sizning ID raqamingiz muvaffaqiyatli tasdiqlandi. Endi sizda signallar uchun to'liq ruxsat bor!", 
            { 
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🍎 Signal olish', 'get_signal')]
                ])
            }
        );

        await ctx.answerCbQuery("Tasdiqlandi!");
        await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ <b>TASDIQLANDI</b>", { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Verify Error:", e);
    }
});

bot.action(/^reject_(.+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const targetId = ctx.match[1];
    
    await ctx.telegram.sendMessage(targetId, "<b>Rad etildi! ❌</b>\n\nID raqamingiz tizimda topilmadi yoki depozit qilinmagan. Iltimos, qaytadan tekshirib ko'ring.");
    await ctx.answerCbQuery("Rad etildi!");
    await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ <b>RAD ETILDI</b>", { parse_mode: 'HTML' });
});

// --- TEXT MESSAGES (ID QABUL QILISH) ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    // Admin reklama yoki kanal qo'shish
    if (userId === ADMIN_ID) {
        if (text === '/cancel') { adminState[userId] = null; return ctx.reply("Amal bekor qilindi."); }
        
        if (adminState[userId] === 'awaiting_ad') {
            const users = await User.find();
            ctx.reply(`📢 Reklama ${users.length} ta foydalanuvchiga yuborilmoqda...`);
            for (const u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
            adminState[userId] = null;
            return ctx.reply("✅ Reklama tarqatildi.");
        }
        
        if (text.includes('|')) {
            const [id, name, link] = text.split('|').map(p => p.trim());
            await Channel.create({ channelId: id, channelName: name, inviteLink: link });
            return ctx.reply("✅ Kanal tizimga qo'shildi!");
        }
    }

    // Foydalanuvchi ID yuborsa
    if (!isNaN(text) && text.length >= 7) {
        await User.findOneAndUpdate({ userId }, { gameId: text }, { upsert: true });
        
        await ctx.telegram.sendMessage(ADMIN_ID, 
            `<b>🔔 YANGI ID TASDIQLASH</b>\n\n` +
            `👤 Foydalanuvchi: ${ctx.from.first_name}\n` +
            `🆔 ID: <code>${text}</code>`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash', `verify_${userId}`)],
                [Markup.button.callback('❌ Rad etish', `reject_${userId}`)]
            ])
        );
        return ctx.reply("📩 ID raqamingiz adminga yuborildi. Tekshiruvdan so'ng sizga xabar beramiz.");
    }
});

// --- ADMIN PANELI ACTIONLAR ---
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
    await ctx.editMessageText("<b>📡 Kanallar boshqaruvi:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('broadcast', (ctx) => { 
    adminState[ctx.from.id] = 'awaiting_ad'; 
    ctx.reply("Reklama xabarini yuboring (rasm, matn, video bo'lishi mumkin) yoki bekor qilish uchun /cancel yozing:"); 
});

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("O'chirildi!");
    ctx.reply("Kanal muvaffaqiyatli o'chirildi.");
});

// --- SERVERNI ISHGA TUSHIRISH ---
bot.launch();
app.get('/', (req, res) => res.send('Richi28 Apple Bot is running!'));
app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Server ${process.env.PORT || 3000}-portda ishga tushdi`);
});
