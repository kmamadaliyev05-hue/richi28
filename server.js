const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const app = express();

const bot = new Telegraf(process.env.BOT_TOKEN);
const URL = process.env.WEB_APP_URL;
const CHANNEL_ID = '-1002344791393'; 
const CHANNEL_LINK = 'https://t.me/+9av2s696xVczMjJi';

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'User';

    // Birinchi "ulanish" xabari
    const statusMsg = await ctx.replyWithHTML('<code>[SYSTEM]: Initializing exploit...</code>');

    setTimeout(async () => {
        try {
            const member = await ctx.telegram.getChatMember(CHANNEL_ID, userId);
            const isSubscribed = ['creator', 'administrator', 'member'].includes(member.status);

            if (isSubscribed) {
                // Obuna bo'lgan bo'lsa - Root Access
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                    `<b>CONNECTION ESTABLISHED. 🟢</b>\n\n` +
                    `<code>USER: ${userName}\n` +
                    `ID: ${userId}\n` +
                    `STATUS: ROOT_ACCESS_GRANTED\n` +
                    `EXPLOIT: ACTIVE_V3</code>\n\n` +
                    `<i>Tizim muvaffaqiyatli buzib o'tildi. Terminalni ishga tushiring:</i>`,
                    {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ LAUNCH TERMINAL', URL)]])
                    }
                );
            } else {
                // Obuna bo'lmagan bo'lsa - Access Denied
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                    `<b>ACCESS DENIED! 🔴</b>\n\n` +
                    `<code>ERROR_CODE: 0x403\n` +
                    `REASON: FIREWALL_BLOCK</code>\n\n` +
                    `Tizimga kirish uchun "ACCESS KEY" (obuna) kerak. Kanalga a'zo bo'ling va qayta /start bosing:`,
                    {
                        parse_mode: 'HTML',
                        ...Markup.inlineKeyboard([[Markup.button.url('📡 GET ACCESS KEY', CHANNEL_LINK)]])
                    }
                );
            }
        } catch (e) {
            await ctx.reply('System error. Reconnecting...');
        }
    }, 1500);
});

bot.launch();
app.get('/', (req, res) => res.send('Terminal Online'));
app.listen(process.env.PORT || 3000);
