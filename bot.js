const { Markup } = require('telegraf');
const User = require('./models');

const initBot = (bot) => {
    // 1. Zayavka (Join Request) tutish
    bot.on('chat_join_request', async (ctx) => {
        try {
            const { id, first_name, username } = ctx.chatJoinRequest.from;
            await User.findOneAndUpdate(
                { userId: id },
                { firstName: first_name, username, status: 'requested' },
                { upsert: true, new: true }
            );
            console.log(`[LOG] Yangi zayavka: ${id}`);
        } catch (e) {
            console.error('Join Request Error:', e.message);
        }
    });

    // 2. Start buyrug'i
    bot.start(async (ctx) => {
        const { id, first_name, username } = ctx.from;
        await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });

        const text = `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 APPLE tizimi yordamida o'yinlarda yuqori natijaga erishing.`;
        await ctx.replyWithHTML(text, Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]
        ]));
    });

    // 3. Menyu va Zayavka tekshirish
    bot.action('main_menu', async (ctx) => {
        const user = await User.findOne({ userId: ctx.from.id });
        
        if (user && user.isVerified) {
            return ctx.editMessageText("<b>Terminal tayyor!</b> 🍎", {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINALNI OCHISH', process.env.WEB_APP_URL)]])
            });
        }

        if (user && user.status === 'requested') {
            return ctx.editMessageText("✅ <b>Zayavka topildi!</b>\n\nEndi ID raqamingizni yozib yuboring:", { parse_mode: 'HTML' });
        }

        await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nTerminal uchun kanalga zayavka yuboring.", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url('📢 ZAYAVKA YUBORISH', 'https://t.me/+9av2s696xVczMjJi')],
                [Markup.button.callback('🔄 TEKSHIRISH', 'main_menu')]
            ])
        });
    });

    // 4. ID qabul qilish (Faqat raqam bo'lsa)
    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        if (/^\d+$/.test(text)) {
            await ctx.reply(`✅ ID qabul qilindi: <code>${text}</code>\n\nAdmin tasdiqlashini kuting.`);
        }
    });

    return bot;
};

module.exports = { initBot };
