const { Markup } = require('telegraf');
const User = require('./models');

// BU YERDA: funksiya 'bot' obyektini qabul qilishi kerak
const initBot = (bot) => {
    
    // 1. Join Request (Zayavka) tutish
    bot.on('chat_join_request', async (ctx) => {
        try {
            const { id, first_name, username } = ctx.chatJoinRequest.from;
            await User.findOneAndUpdate(
                { userId: id },
                { firstName: first_name, username, status: 'requested' },
                { upsert: true, new: true }
            );
            console.log(`[LOG] Yangi zayavka tutildi: ${id}`);
        } catch (e) {
            console.error('Join Request Xatosi:', e.message);
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

    // 3. Asosiy menyu va Tekshirish mantiqi
    bot.action('main_menu', async (ctx) => {
        try {
            const user = await User.findOne({ userId: ctx.from.id });
            
            if (user && user.isVerified) {
                return ctx.editMessageText("<b>Terminal tayyor!</b> 🍎\n\nPastdagi tugmani bosing:", {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp('⚡️ TERMINALNI OCHISH', process.env.WEB_APP_URL)]
                    ])
                });
            }

            if (user && user.status === 'requested') {
                const regText = `✅ <b>Zayavka qabul qilindi!</b>\n\nEndi terminalga kirish uchun oxirgi qadam:\n\n1. 1XBET-da <b>RICHI28</b> promokodi bilan yangi hisob oching.\n2. O'yin ID raqamingizni pastga yozib yuboring:`;
                return ctx.editMessageText(regText, { parse_mode: 'HTML' });
            }

            const subscribeText = `⚠️ <b>DIQQAT!</b>\n\nTerminalga kirish uchun kanalga obuna bo'lishingiz yoki zayavka yuborishingiz shart.`;
            await ctx.editMessageText(subscribeText, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.url('📢 ZAYAVKA YUBORISH', 'https://t.me/+9av2s696xVczMjJi')],
                    [Markup.button.callback('🔄 TEKSHIRISH', 'main_menu')]
                ])
            });

        } catch (error) {
            console.error("Menu Error:", error.message);
        }
    });

    // ID raqam yuborganda tutish
    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        if (/^\d+$/.test(text)) {
            await ctx.reply(`✅ ID qabul qilindi: <code>${text}</code>\n\nAdmin tasdiqlashini kuting. Tez orada terminal ochiladi!`);
        }
    });

    return bot;
};

module.exports = { initBot };
