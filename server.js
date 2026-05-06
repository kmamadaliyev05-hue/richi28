const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;
const CHANNEL_ID = '-1002344791393'; // Sizning kanalingiz ID raqami
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
        const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

        if (isSubscribed) {
            ctx.replyWithHTML(
                `<b>Xush kelibsiz, ${ctx.from.first_name}! 🍎</b>\n\n` +
                `Siz barcha shartlarni bajardingiz. Pastdagi tugmani bosing va signallarni oling!`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp('🚀 SIGNAL OLISH', URL)]
                ])
            );
        } else {
            ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\n` +
                `Signallarni ko'rish uchun rasmiy kanalimizga a'zo bo'lishingiz shart.\n\n` +
                `A'zo bo'lib, keyin qaytadan <b>/start</b> bosing!`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 KANALGA OBUNA BO\'LISH', CHANNEL_LINK)]
                ])
            );
        }
    } catch (e) {
        // Agar kanal topilmasa yoki bot admin bo'lmasa, shunchaki o'yinni ko'rsatadi
        ctx.replyWithHTML(`Xush kelibsiz!`, Markup.inlineKeyboard([[Markup.button.webApp('🚀 SIGNAL OLISH', URL)]]));
    }
});

bot.launch();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);
