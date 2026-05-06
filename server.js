const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;

bot.start((ctx) => {
    ctx.replyWithHTML(
        `<b>Assalomu alaykum, ${ctx.from.first_name}! 🍎</b>\n\n` +
        `Siz <b>RICHI28 APPLE</b> botiga kirdingiz.\n\n` +
        `Pastdagi tugmani bosing va signallarni oling!`,
        Markup.inlineKeyboard([
            [Markup.button.webApp('🚀 SIGNAL OLISH', URL)]
        ])
    );
});

bot.launch();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);
