const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;

// Rasmda ko'ringan ID asosida to'g'rilandi
const CHANNEL_ID = '-1003900850005'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const msg = await ctx.replyWithHTML('<code>[SYSTEM]: Connecting to proxy...</code>');

    try {
        const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId).catch(() => null);
        const isSubscribed = member && ['creator', 'administrator', 'member'].includes(member.status);

        setTimeout(async () => {
            if (isSubscribed) {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
                    `<b>ACCESS GRANTED. 🟢</b>\n\n` +
                    `<code>USER_ID: ${userId}\nSTATUS: BYPASS_ACTIVE</code>\n\n` +
                    `<i>Terminal yuklandi. Exploitni ishga tushiring:</i>`,
                    { 
                        parse_mode: 'HTML', 
                        ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ LAUNCH CONSOLE', URL)]]) 
                    }
                );
            } else {
                await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
                    `<b>ACCESS DENIED! 🔴</b>\n\n` +
                    `<code>ERROR: FIREWALL_BLOCK</code>\n\n` +
                    `Tizimga kirish uchun kanalga ulaning va qayta /start bosing:`,
                    { 
                        parse_mode: 'HTML', 
                        ...Markup.inlineKeyboard([[Markup.button.url('📡 GET ACCESS KEY', CHANNEL_LINK)]]) 
                    }
                );
            }
        }, 1000);

    } catch (e) {
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, 
            "<code>[SYSTEM]: Bypass protocol active.</code>", 
            Markup.inlineKeyboard([[Markup.button.webApp('⚡️ FORCE LAUNCH', URL)]])
        );
    }
});

bot.launch();
app.get('/', (req, res) => res.send('System Online'));
app.listen(process.env.PORT || 3000);
