// --- SHU YERDAN BOSHLAB NUSXALANG ---

// XATOLIKLARNI OLDINI OLISH UCHUN SESSIYANI TEKSHIRUVCHI FUNKSIYA
const initSession = (ctx) => {
    if (!ctx.session) ctx.session = {};
};

// 7. SECTIONS & BACK LOGIC

// 1. KONSOL (WEB APP GATEWAY)
bot.action("open_console", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        
        // Verified tekshiruvi
        if (!user.isVerified) {
            return ctx.answerCbQuery(s.access_denied, { show_alert: true });
        }
        
        // Verified bo'lsa Web App chiqadi
        return ctx.editMessageText("🟢 TERMINAL IS ACTIVE", Markup.inlineKeyboard([
            [Markup.button.webApp("🚀 KONSOLNI OCHISH", process.env.WEB_APP_URL || "https://google.com")],
            [Markup.button.callback(s.back, "home")]
        ]));
    } catch (error) { console.error(error); }
});

// 2. SIGNALLAR (VERIFICATION CENTER)
bot.action("menu_signals", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const apps = await Config.find({ key: 'app' });
        
        const btns = [];
        
        // Baza orqali qo'shilgan ilovalar ro'yxati chiqadi
        apps.forEach(a => {
            btns.push([Markup.button.url(`📥 ${a.name} yuklash`, a.url)]);
        });

        // Baza bo'sh bo'lsa, standart tugma (ixtiyoriy)
        if(apps.length === 0) {
            btns.push([Markup.button.url("📥 Ilovani yuklash (1XBET)", "https://1xbet.com")]);
        }

        // Tasdiqlash va Ortga tugmalari
        btns.push([Markup.button.callback("🆔 ID TASDIQLASH", "verify_id_start")]);
        btns.push([Markup.button.callback(s.back, "home")]);
        
        return ctx.editMessageText(s.signals_title, Markup.inlineKeyboard(btns));
    } catch (error) { console.error(error); }
});

bot.action("verify_id_start", async (ctx) => {
    initSession(ctx); // Crashni oldini oladi
    ctx.session.step = 'await_id';
    return ctx.reply("📝 Platformadagi ID raqamingizni kiriting:\n\n(Bekor qilish uchun /start)");
});

// 3. TARMOQ
bot.action("menu_network", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
        return ctx.editMessageText(s.ref_title(user.referrals, link), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
        });
    } catch (error) { console.error(error); }
});

// 4. HAMYON
bot.action("menu_wallet", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        return ctx.editMessageText(s.wallet_title(user.balance), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("💸 Withdraw", "withdraw_start")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("withdraw_start", (ctx) => {
    initSession(ctx);
    ctx.session.step = 'withdraw_card';
    return ctx.reply("💳 Karta raqamingizni kiriting:");
});

// 5. SOZLAMALAR
bot.action("menu_settings", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        return ctx.editMessageText(s.settings_title(user.userId, user.isVerified, user.notifications), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback("🔄 Language", "start_lang_change")],
                [Markup.button.callback(s.back, "home")]
            ])
        });
    } catch (error) { console.error(error); }
});

bot.action("start_lang_change", (ctx) => {
    return ctx.reply("New Language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
        [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
        [Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

// 6. QO'LLANMA
bot.action("menu_guide", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        const guide = await Config.findOne({ key: 'guide' });
        const text = guide ? guide.content : "...";
        return ctx.editMessageText(`${s.guide_title}\n\n${text}`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
        });
    } catch (error) { console.error(error); }
});

// 7. YUTUQLAR
bot.action("menu_wins", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        let wins = `${s.wins_title}\n\n`;
        for(let i=0; i<10; i++) {
            const id = Math.floor(1000 + Math.random() * 8000);
            const amt = (Math.floor(Math.random() * 5000000) + 500000).toLocaleString();
            wins += `✅ ID: ${id}** | +${amt} UZS\n`;
        }
        return ctx.editMessageText(wins, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback(s.back, "home")]])
        });
    } catch (error) { console.error(error); }
});

// 8. ADMIN BILAN ALOQA (SUPPORT)
bot.action("menu_support", async (ctx) => {
    try {
        const user = await User.findOne({ userId: ctx.from.id });
        const s = strings[user.lang] || strings.uz;
        
        initSession(ctx); // Xotirani tekshirish
        ctx.session.step = 'support';
        
        return ctx.editMessageText(s.support_msg, Markup.inlineKeyboard([
            [Markup.button.callback(s.back, "home")]
        ]));
    } catch (error) { console.error(error); }
});

// 8.1. MATNLARNI QABUL QILISH VA QAYTA ISHLASH (ENG ASOSIY QISM)
bot.on('text', async (ctx) => {
    initSession(ctx); // Har bir xat kelganda xotirani ishga tushirish (Crashni yo'q qiladi)
    if (!ctx.session.step) return;

    try {
        const user = await User.findOne({ userId: ctx.from.id });

        // A. ID TASDIQLASH UCHUN
        if (ctx.session.step === 'await_id') {
            await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text });
            
            // Adminga so'rov boradi
            bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>YANGI ID SO'ROVI</b>\n\nFoydalanuvchi: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\nGame ID: <code>${ctx.message.text}</code>`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.callback("✅ TASDIQLASH", `approve_${ctx.from.id}`)]])
            });
            ctx.session.step = null;
            return ctx.reply("⏳ Yuborildi! Admin tasdiqlashini kuting.");
        } 
        
        // B. ADMIN BILAN ALOQA UCHUN (TICKET SYSTEM)
        if (ctx.session.step === 'support') {
            // Adminga foydalanuvchi arizasi boradi (Admin javob yozishi uchun tugma bilan)
            bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI ARIZA (SUPPORT)</b>\n\nKimdan: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\n\n📝 Xabar:\n${ctx.message.text}`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✍️ Javob yozish", `reply_to_${ctx.from.id}`)]
                ])
            });
            ctx.session.step = null;
            return ctx.reply("✅ Arizangiz admin paneliga yuborildi. Bot orqali javob olasiz.");
        }

        // C. ADMIN JAVOBINI FOYDALANUVCHIGA YETKAZISH
        if (ctx.session.step.startsWith('reply_to_')) {
            const targetUserId = ctx.session.step.split('_')[2];
            
            // Foydalanuvchiga xabar yetkaziladi
            bot.telegram.sendMessage(targetUserId, `👨‍💻 <b>ADMINDAN JAVOB KELDI:</b>\n\n${ctx.message.text}`, {
                parse_mode: 'HTML'
            });
            ctx.session.step = null;
            return ctx.reply("✅ Javobingiz foydalanuvchiga muvaffaqiyatli yetkazildi.");
        }

        // D. KARTA RAQAMI KIRTISH
        if (ctx.session.step === 'withdraw_card') {
            ctx.reply("💰 Summani kiriting:");
            ctx.session.step = 'withdraw_amount';
        }

    } catch (error) { console.error(error); }
});

// ADMINDAN JAVOB YOZISH TUGMASI (Inline callback)
bot.action(/^reply_to_(\d+)$/, (ctx) => {
    initSession(ctx);
    const targetUserId = ctx.match[1];
    ctx.session.step = `reply_to_${targetUserId}`;
    return ctx.reply(`✍️ Foydalanuvchi (ID: ${targetUserId}) uchun javobingizni yozing:`);
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    try {
        const targetId = ctx.match[1];
        await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
        bot.telegram.sendMessage(targetId, "✅ Tabriklaymiz! ID raqamingiz tasdiqlandi. KONSOL ochildi.");
        return ctx.answerCbQuery("Tasdiqlandi!");
    } catch (error) { console.error(error); }
});

// 9. EXPRESS SERVER
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('OK'));
app.listen(PORT, '0.0.0.0', () => console.log(`Run: ${PORT}`));

bot.launch().then(() => console.log('🚀 RICHI28 BOT STARTED'));
