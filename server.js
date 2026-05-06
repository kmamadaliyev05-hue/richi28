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
            await ctx.replyWithHTML(
                `<b>Xush kelibsiz, ${ctx.from.first_name}! 🍎</b>\n\n` +
                `Ushbu bot <b>1XBET, LINEBET, WINWIN</b> va <b>888STARZ</b> ilovalari uchun maxsus signallarni taqdim etadi.\n\n` +
                `❗️ <b>MUHIM:</b> Signallar aniq ishlashi uchun <b>RICHI28</b> promo-kodi bilan ro'yxatdan o'tgan bo'lishingiz shart.\n\n` +
                `Tayyor bo'lsangiz, pastdagi tugmani bosing:`,
                Markup.inlineKeyboard([
                    [Markup.button.webApp('🚀 SIGNAL OLISH', URL)]
                ])
            );
        } else {
            await ctx.replyWithHTML(
                `<b>DIQQAT! ⚠️</b>\n\n` +
                `Botdan foydalanish uchun rasmiy kanalimizga a'zo bo'lishingiz shart.\n\n` +
                `A'zo bo'lgach, qaytadan <b>/start</b> bosing!`,
                Markup.inlineKeyboard([
                    [Markup.button.url('📢 KANALGA OBUNA BO\'LISH', CHANNEL_LINK)]
                ])
            );
        }
    } catch (e) {
        ctx.replyWithHTML(`Xush kelibsiz!`, Markup.inlineKeyboard([[Markup.button.webApp('🚀 SIGNAL OLISH', URL)]]));
    }
});

// Admin panel uchun buyruq (faqat siz uchun)
bot.command('stat', (ctx) => {
    if (ctx.from.id.toString() === 'Sizning_Telegram_ID_Raqamingiz') { // Ixtiyoriy: o'z IDingizni qo'ysangiz bo'ladi
        ctx.reply("Bot hozirda barqaror ishlamoqda ✅");
    }
});

bot.launch();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);
