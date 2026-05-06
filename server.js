const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;
const CHANNEL_ID = '-1003900850005'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start((ctx) => {
    ctx.replyWithHTML(
        `<b>Xush kelibsiz, ${ctx.from.first_name}! 👋</b>\n\n` +
        `Siz <b>RICHI28 AI v4.0</b> tahlil botiga ulandingiz.\n` +
        `Ushbu tizim Apple of Fortune o'yinidagi algoritmlarni tahlil qiladi.\n\n` +
        `👇 Ishni boshlash uchun pastdagi tugmani bosing:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🚀 TIZIMNI ISHGA TUSHIRISH', 'check_sub')]
        ])
    );
});

// Tugma bosilganda obunani tekshirish
bot.action('check_sub', async (ctx) => {
    const userId = ctx.from.id;
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
        const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

        if (isSubscribed) {
            await ctx.editMessageText(
                `✅ <b>Ruxsat berildi!</b>\n\n` +
                `Sizning ID: <code>${userId}</code>\n` +
                `Status: <b>Premium User</b>\n\n` +
                `Signal olish oynasini oching:`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([[Markup.button.webApp('🍎 SIGNAL OLISH', URL)]])
                }
            );
        } else {
            await ctx.answerCbQuery('⚠️ Avval kanalga a\'zo bo\'ling!', { show_alert: true });
            await ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\n` +
                `Signallarni ko'rish uchun rasmiy kanalimizga a'zo bo'lishingiz shart.\n\n` +
                `A'zo bo'lgach, qaytadan /start bosing!`,
                Markup.inlineKeyboard([[Markup.button.url('📢 KANALGA A\'ZO BO\'LISH', CHANNEL_LINK)]])
            );
        }
    } catch (e) {
        // Agar kanal topilmasa ham o'yinga kirishga ruxsat berish (xatolik oldini olish)
        ctx.replyWithHTML("Kirish tasdiqlandi!", Markup.inlineKeyboard([[Markup.button.webApp('🍎 SIGNAL OLISH', URL)]]));
    }
});

bot.launch();
app.get('/', (req, res) => res.send('AI Bot Live'));
app.listen(process.env.PORT || 3000);
