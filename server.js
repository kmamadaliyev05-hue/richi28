const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;
const CHANNEL_ID = '-1003900850005'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start(async (ctx) => {
    await ctx.replyWithHTML(
        `<b>Xush kelibsiz! 👋</b>\n\n` +
        `Siz <b>RICHI28 Predictor</b> tizimiga ulandingiz. Ushbu vosita Apple of Fortune o'yini uchun matematik algoritmlarni hisoblaydi.\n\n` +
        `👇 Davom etish uchun pastdagi tugmani bosing:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🚀 TIZIMNI TEKSHIRISH', 'check_access')]
        ])
    );
});

bot.action('check_access', async (ctx) => {
    const userId = ctx.from.id;
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
        const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

        if (isSubscribed) {
            await ctx.editMessageText(
                `✅ <b>Tizimga ruxsat berildi!</b>\n\n` +
                `<b>Foydalanuvchi:</b> <code>${ctx.from.first_name}</code>\n` +
                `<b>Status:</b> Premium Active\n\n` +
                `Signal olish uchun terminalni oching:`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([[Markup.button.webApp('🍎 TERMINALNI OCHISH', URL)]])
                }
            );
        } else {
            await ctx.answerCbQuery('⚠️ Avval kanalga ulaning!', { show_alert: true });
            await ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\n` +
                `Tizimdan foydalanish uchun rasmiy kanalimizga a'zo bo'lishingiz shart.\n\n` +
                `Obuna bo'lgach, qaytadan /start bosing!`,
                Markup.inlineKeyboard([[Markup.button.url('📢 KANALGA ULANISH', CHANNEL_LINK)]])
            );
        }
    } catch (e) {
        // Xato bo'lsa ham foydalanuvchini bloklamaslik uchun
        await ctx.reply("Tizimga ruxsat berildi!", Markup.inlineKeyboard([[Markup.button.webApp('🍎 TERMINALNI OCHISH', URL)]]));
    }
});

bot.launch();
app.get('/', (req, res) => res.send('Predictor Online'));
app.listen(process.env.PORT || 3000);
