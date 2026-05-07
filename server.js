require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { initBot } = require('./bot');
const { User, Channel } = require('./models');

const app = express();
const bot = initBot(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; 

// Reklama holatini saqlash uchun oddiy obyekt
let adminState = {};

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ DB Error:', err));

// --- ADMIN PANEL FUNKSIYASI ---
const getAdminKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('📡 Kanallarni boshqarish', 'manage_ch')],
    [Markup.button.callback('📢 Reklama yuborish', 'broadcast')],
    [Markup.button.callback('🔄 Yangilash', 'admin_panel')]
]);

bot.command('admin', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const reqs = await User.countDocuments({ status: 'requested' });
    ctx.replyWithHTML(`<b>🏦 ADMIN PANEL</b>\n\n👤 Foydalanuvchilar: ${total}\n📩 Zayavkalar: ${reqs}`, getAdminKeyboard());
});

bot.action('admin_panel', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const reqs = await User.countDocuments({ status: 'requested' });
    try {
        await ctx.editMessageText(`<b>🏦 ADMIN PANEL</b>\n\n👤 Foydalanuvchilar: ${total}\n📩 Zayavkalar: ${reqs}`, { parse_mode: 'HTML', ...getAdminKeyboard() });
    } catch (e) { ctx.replyWithHTML(`<b>🏦 ADMIN PANEL</b>`, getAdminKeyboard()); }
});

// --- REKLAMA (BROADCAST) ---
bot.action('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    adminState[ctx.from.id] = 'awaiting_ad';
    ctx.reply("📢 Reklama xabarini yuboring (Rasm, Video yoki Text). Bekor qilish uchun /cancel deb yozing.");
});

// --- OBUNA TEKSHIRUVINING ENG TO'G'RI VARIANTI ---
bot.action('get_signal', async (ctx) => {
    const userId = ctx.from.id;
    try {
        // 1. Eng yangi ma'lumotni bazadan qayta o'qiymiz (Video dagi xato shu yerda edi)
        const dbUser = await User.findOne({ userId }).lean(); 
        const channels = await Channel.find().lean();
        let mustJoin = [];

        // 2. Birinchi navbatda Zayavkani tekshiramiz
        if (dbUser && (dbUser.status === 'requested' || dbUser.status === 'member')) {
            return await ctx.replyWithHTML(`<b>Ruxsat berildi! ✅</b>\n\nSizning so'rovingiz tasdiqlangan. Terminalga kiring:`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', process.env.WEB_APP_URL)]])
            );
        }

        // 3. Kanallarni real vaqtda tekshirish
        for (const ch of channels) {
            try {
                const member = await ctx.telegram.getChatMember(ch.channelId, userId);
                const isSubscribed = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
                
                if (!isSubscribed) {
                    mustJoin.push(ch);
                }
            } catch (e) {
                // Agar bot admin bo'lmasa yoki kanal topilmasa, zayavka bo'lmagan holda majburiy obuna deb hisoblaymiz
                mustJoin.push(ch);
            }
        }

        // 4. Yakuniy mantiq
        if (mustJoin.length === 0) {
            // Agar massiv bo'sh bo'lsa - demak hamma joyga a'zo
            await ctx.replyWithHTML(`<b>Xush kelibsiz! ✅</b>\n\nTerminalga kirish uchun pastdagi tugmani bosing:`,
                Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', process.env.WEB_APP_URL)]])
            );
        } else {
            // Hali a'zo bo'lmagan kanallar bo'lsa
            const buttons = mustJoin.map(ch => [Markup.button.url(`📢 ${ch.channelName}`, ch.inviteLink)]);
            buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
            
            // Videoda ko'ringan takrorlanishni yo'qotish uchun eski xabarni o'chirib yangisini yuboramiz
            await ctx.replyWithHTML(`<b>⚠️ DIQQAT!</b>\n\nTerminalga kirish uchun quyidagi kanallarga obuna bo'ling:`, 
                Markup.inlineKeyboard(buttons)
            );
        }
    } catch (err) { 
        console.error("Signal Logic Error:", err);
        ctx.reply("Texnik uzilish. Birozdan so'ng urinib ko'ring.");
    }
});

// --- KANALLARNI BOSHQARISH ---
bot.action('manage_ch', async (ctx) => {
    const channels = await Channel.find();
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.channelName}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('⬅️ Orqaga', 'admin_panel')]);
    await ctx.editMessageText("<b>📡 Kanallar boshqaruvi:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_ch', ctx => ctx.replyWithHTML("Kanal qo'shish uchun format:\n\n<code>ID | Nomi | Link</code>"));

// --- TEXT VA REKLAMA ISHLOVCHISI ---
bot.on(['text', 'photo', 'video', 'animation'], async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    // Bekor qilish
    if (ctx.message?.text === '/cancel') {
        adminState[ctx.from.id] = null;
        return ctx.reply("Bekor qilindi.");
    }

    // Reklama yuborish
    if (adminState[ctx.from.id] === 'awaiting_ad') {
        const users = await User.find();
        let count = 0;
        ctx.reply(`📢 Reklama tarqatilmoqda... (Jami: ${users.length} foydalanuvchi)`);
        
        for (const user of users) {
            try {
                await ctx.copyMessage(user.userId);
                count++;
            } catch (e) { /* Botni bloklagan bo'lishi mumkin */ }
        }
        
        adminState[ctx.from.id] = null;
        return ctx.reply(`✅ Reklama yakunlandi. ${count} kishiga yetkazildi.`);
    }

    // Kanal qo'shish
    if (ctx.message?.text?.includes('|')) {
        const parts = ctx.message.text.split('|').map(p => p.trim());
        if (parts.length === 3) {
            await Channel.create({ channelId: parts[0], channelName: parts[1], inviteLink: parts[2] });
            return ctx.reply("✅ Kanal muvaffaqiyatli qo'shildi!");
        }
    }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("O'chirildi!");
    return ctx.reply("Kanal o'chirildi. /admin yozing.");
});

bot.action('main_menu', async (ctx) => {
    await ctx.replyWithHTML("<b>Asosiy menyu:</b>", Markup.inlineKeyboard([
        [Markup.button.callback('🍎 Signal olish', 'get_signal')],
        [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')]
    ]));
});

bot.launch();
app.get('/', (req, res) => res.send('Richi28 Bot is Running!'));
app.listen(process.env.PORT || 3000);
