const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE MODEL
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    status: { type: String, default: 'new' },
    isVerified: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// 2. BOT INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 5474529046;

// 3. ZAYAVKA TUTISH
bot.on('chat_join_request', async (ctx) => {
    try {
        const { id, first_name } = ctx.chatJoinRequest.from;
        await User.findOneAndUpdate({ userId: id }, { firstName: first_name, status: 'requested' }, { upsert: true });
        console.log(`[LOG] Zayavka: ${id}`);
    } catch (e) { console.error(e); }
});

// 4. START BUYRUG'I
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true });
    
    await ctx.replyWithHTML(`<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 tizimi orqali eng aniq signallarni oling.`, 
        Markup.inlineKeyboard([[Markup.button.callback('🚀 Signal olishni boshlash', 'check_status')]])
    );
});

// 5. STATUS TEKSHIRISH
bot.action('check_status', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    
    if (user?.isVerified) {
        return ctx.editMessageText("<b>Signallar tizimi faol!</b> 🍎", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL)]])
        });
    }

    if (user?.status === 'requested') {
        return ctx.editMessageText("✅ <b>Zayavka topildi!</b>\n\nSignallarni ochish uchun ID yuboring:", { parse_mode: 'HTML' });
    }

    await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nKanalga zayavka yuboring.", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.url('📢 ZAYAVKA YUBORISH', 'https://t.me/+9av2s696xVczMjJi')],
            [Markup.button.callback('🔄 TEKSHIRISH', 'check_status')]
        ])
    });
});

// 6. ID QABUL QILISH VA ADMIN PANEL
bot.on('text', async (ctx) => {
    if (ctx.from.id === ADMIN_ID) return;
    if (/^\d+$/.test(ctx.message.text)) {
        await ctx.reply("✅ ID qabul qilindi. Admin tasdiqlashini kuting.");
        await ctx.telegram.sendMessage(ADMIN_ID, `🔔 Yangi ID: <code>${ctx.message.text}</code>\nUser: ${ctx.from.id}`, 
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`), Markup.button.callback('❌ Rad etish', `r_${ctx.from.id}`)]
            ])
        );
    }
});

bot.action(/^v_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    ctx.editMessageText("✅ Tasdiqlandi.");
    ctx.telegram.sendMessage(ctx.match[1], "🎉 Hisobingiz tasdiqlandi! Endi /start bosing.");
});

// 7. SERVER & LAUNCH
mongoose.connect(process.env.MONGO_URI).then(() => console.log('DB ulandi'));
bot.launch().then(() => console.log('🚀 Bot ishga tushdi'));

const app = express();
app.get('/', (req, res) => res.send('Bot Live'));
app.listen(process.env.PORT || 3000);
