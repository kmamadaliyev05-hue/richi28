const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;
const CHANNEL_ID = '-1002344791393'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
        const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

        if (isSubscribed) {
            await ctx.replyWithHTML('<code>[SYSTEM]: Connection established...</code>');
            setTimeout(async () => {
                await ctx.replyWithHTML(
                    `<b>ROOT ACCESS GRANTED. 🟢</b>\n\n` +
                    `<code>Target: Apple of Fortune\n` +
                    `Status: Exploit Ready</code>\n\n` +
                    `Terminalni ishga tushirish uchun pastdagi tugmani bosing:`,
                    Markup.inlineKeyboard([
                        [Markup.button.webApp('⚡️ EXECUTE EXPLOIT', URL)]
                    ])
                );
            }, 800);
        } else {
            await ctx.replyWithHTML(
                `<b>ACCESS DENIED! 🔴</b>\n\n` +
                `<code>Error: Subscription required to bypass firewall.</code>\n\n` +
                `Tizimga kirish uchun rasmiy kanalimizga a'zo bo'ling va qaytadan /start bosing:`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📡 BYPASS FIREWALL (OBUNA)', CHANNEL_LINK)]
                ])
            );
        }
    } catch (e) {
        ctx.replyWithHTML(`<code>[ERROR]: System failure. Try again.</code>`, Markup.inlineKeyboard([[Markup.button.webApp('EXECUTE', URL)]]));
    }
});

bot.launch();
app.get('/', (req, res) => res.send('System Online'));
app.listen(process.env.PORT || 3000);
