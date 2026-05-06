const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;
const CHANNEL_ID = '-1002344791393'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const msg = await ctx.replyWithHTML('<code>[SYSTEM]: Connecting to proxy...</code>');

    setTimeout(async () => {
        try {
            const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
            const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

            if (isSubscribed) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
                    `<b>ROOT ACCESS GRANTED. 🟢</b>\n\n` +
                    `<code>USER_ID: ${userId}\nSTATUS: BYPASS_ACTIVE\nOS: TERMINAL_V3</code>\n\n` +
                    `<i>Terminal yuklandi. Exploitni ishga tushiring:</i>`,
                    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ LAUNCH CONSOLE', URL)]]) }
                );
            } else {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
                    `<b>ACCESS DENIED! 🔴</b>\n\n` +
                    `<code>FIREWALL_DETECTED: Unauthorized_User</code>\n\n` +
                    `Tizimni aldab o'tish uchun kanalga ulaning va qayta /start bosing:`,
                    { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.url('📡 GET ACCESS KEY', CHANNEL_LINK)]]) }
                );
            }
        } catch (e) { console.log(e); }
    }, 1200);
});

bot.launch();
app.get('/', (req, res) => res.send('System Live'));
app.listen(process.env.PORT || 3000);
