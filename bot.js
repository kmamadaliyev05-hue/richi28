const { Markup } = require('telegraf');
const User = require('./models');

const initBot = (bot) => {
    const ADMIN_ID = 5474529046; // Sizning ID raqamingiz

    // 1. Zayavka (Join Request) tutish
    bot.on('chat_join_request', async (ctx) => {
        try {
            const { id, first_name, username } = ctx.chatJoinRequest.from;
            await User.findOneAndUpdate(
                { userId: id },
                { firstName: first_name, username, status: 'requested' },
                { upsert: true }
            );
            console.log(`[LOG] Yangi zayavka: ${id}`);
        } catch (e) { console.error('Join error:', e); }
    });

    // 2. Start buyrug'i
    bot.start(async (ctx) => {
        const { id, first_name, username } = ctx.from;
        await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });

        const text = `<b>Assalomu alaykum, ${first_name}!</b> 👋\n\nRICHI28 APPLE tizimi orqali eng aniq signallarni oling.`;
        await ctx.replyWithHTML(text, Markup.inlineKeyboard([
            [Markup.button.callback('🚀 Signal olishni boshlash', 'check_status')]
        ]));
    });

    // 3. Statusni tekshirish
    bot.action('check_status', async (ctx) => {
        const user = await User.findOne({ userId: ctx.from.id });
        
        if (user?.isVerified) {
            return ctx.editMessageText("<b>Signallar tizimi faol!</b> 🍎\n\nPastdagi tugmani bosing:", {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.webApp('⚡️ SIGNAL OLISH', process.env.WEB_APP_URL)]])
            });
        }

        if (user?.status === 'requested' || user?.status === 'pending_id') {
            return ctx.editMessageText("✅ <b>Zayavka topildi!</b>\n\nSignallarni ochish uchun:\n1. <b>RICHI28</b> promokodi bilan ro'yxatdan o'ting.\n2. O'yin ID raqamingizni pastga yozib yuboring:", { parse_mode: 'HTML' });
        }

        await ctx.editMessageText("⚠️ <b>DIQQAT!</b>\n\nSignallarga kirish uchun kanalga zayavka yuboring.", {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.url('📢 ZAYAVKA YUBORISH', 'https://t.me/+9av2s696xVczMjJi')],
                [Markup.button.callback('🔄 TEKSHIRISH', 'check_status')]
            ])
        });
    });

    // 4. ID qabul qilish va Adminga yuborish
    bot.on('text', async (ctx) => {
        const userId = ctx.from.id;
        const text = ctx.message.text;

        if (userId === ADMIN_ID) return; // Admin xabarlariga tegmaymiz

        if (/^\d+$/.test(text) && text.length >= 7) {
            await User.findOneAndUpdate({ userId }, { gameId: text, status: 'pending_id' });
            
            await ctx.reply("✅ <b>ID qabul qilindi!</b>\n\nAdmin tasdiqlashini kuting. Signallar tez orada ochiladi!", { parse_mode: 'HTML' });

            // Adminga yuborish
            await ctx.telegram.sendMessage(ADMIN_ID, 
                `🔔 <b>Yangi ID keldi!</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${text}</code>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('✅ Tasdiqlash', `verify_${userId}`), Markup.button.callback('❌ Rad etish', `reject_${userId}`)]
                    ])
                }
            );
        }
    });

    // 5. ADMIN TASDIQLASH/RAD ETISH
    bot.action(/^verify_(\d+)$/, async (ctx) => {
        const targetId = ctx.match[1];
        await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
        await ctx.answerCbQuery("Tasdiqlandi ✅");
        await ctx.editMessageText(`✅ User ${targetId} tasdiqlandi!`);
        await ctx.telegram.sendMessage(targetId, "🎉 <b>Tabriklaymiz!</b>\n\nSizning hisobingiz tasdiqlandi. Endi /start bosing va signallarni oling!", { parse_mode: 'HTML' });
    });

    bot.action(/^reject_(\d+)$/, async (ctx) => {
        const targetId = ctx.match[1];
        await ctx.answerCbQuery("Rad etildi ❌");
        await ctx.editMessageText(`❌ User ${targetId} rad etildi!`);
        await ctx.telegram.sendMessage(targetId, "⚠️ <b>Hisobingiz tasdiqlanmadi.</b>\n\nIltimos, ID raqamingizni to'g'ri yuborganingizni tekshiring.");
    });
};

module.exports = { initBot };
