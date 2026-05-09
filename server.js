const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

const app = express();
const ADMIN_ID = 6137845806; // Sizning ID raqamingiz

// 1. DATABASE MODELS
const UserSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: "uz" },
    isVerified: { type: Boolean, default: false },
    gameId: { type: String, default: "Kiritilmagan" },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    notifications: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now }
});

const ConfigSchema = new mongoose.Schema({
    key: String, // channel, app, guide
    name: String,
    url: String,
    chatId: String,
    content: String
});

const User = mongoose.model('User', UserSchema);
const Config = mongoose.model('Config', ConfigSchema);

// 2. BOT INITIALIZATION
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🛡️ RICHI28 DATABASE CONNECTED'))
    .catch(err => console.error('❌ DB Error:', err));

// 3. I18N (MULTI-LANGUAGE)
const strings = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli.",
        sub_req: "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:",
        verify_sub: "✅ Tasdiqlash",
        main_menu: "Asosiy menyu tanlang:",
        access_denied: "⚠️ Ruxsat yo'q! Avval ID tasdiqlang.",
        signals_title: "🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:",
        wallet_title: (bal) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\n\nKamida 50,000 UZS bo'lganda yechish mumkin.`,
        ref_title: (count, link) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta\n\n🎁 Mukofotlar:\n- 5 do'st = 5,000 UZS\n- 10 do'st = 13,000 UZS`,
        settings_title: (id, status, notify) => `🛠 <b>SOZLAMALAR</b>\n\n👤 ID: ${id}\n✅ Status: ${status ? 'Tasdiqlangan' : 'Noma\'lum'}\n🔔 Bildirishnoma: ${notify ? 'ON' : 'OFF'}`,
        back: "⬅️ Ortga"
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nДобро пожаловать в систему, Агент!",
        sub_req: "🔐 Сначала подпишитесь на каналы:",
        verify_sub: "✅ Проверить",
        main_menu: "Выберите раздел:",
        access_denied: "⚠️ Доступ запрещен! Сначала подтвердите ID.",
        signals_title: "🚀 Выберите платформу и отправьте свой ID:",
        wallet_title: (bal) => `💰 <b>КОШЕЛЕК</b>\n\nБаланс: ${bal.toLocaleString()} UZS`,
        back: "⬅️ Назад"
    },
    en: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\n\nWelcome to the system, Agent!",
        sub_req: "🔐 Subscribe to channels to continue:",
        verify_sub: "✅ Verify",
        main_menu: "Choose main menu:",
        access_denied: "⚠️ Access denied! Verify your ID first.",
        signals_title: "🚀 Choose platform and send your ID:",
        wallet_title: (bal) => `💰 <b>WALLET</b>\n\nTotal Balance: ${bal.toLocaleString()} UZS`,
        back: "⬅️ Back"
    }
};

// 4. KEYBOARD GENERATORS
const getMainMenu = (lang, isAdmin) => {
    const btns = [
        [Markup.button.callback("💻 OPEN CONSOLE", "open_console")],
        [Markup.button.callback("🚀 SIGNALS", "menu_signals"), Markup.button.callback("👥 NETWORK", "menu_network")],
        [Markup.button.callback("🏆 WINS", "menu_wins"), Markup.button.callback("📚 GUIDE", "menu_guide")],
        [Markup.button.callback("💰 WALLET", "menu_wallet"), Markup.button.callback("🛠 SETTINGS", "menu_settings")],
        [Markup.button.callback("👨‍💻 CONTACT ADMIN", "menu_support")]
    ];
    if (isAdmin) btns.push([Markup.button.callback("⚙️ ADMIN PANEL", "admin_panel")]);
    return Markup.inlineKeyboard(btns);
};

// 5. SUBSCRIPTION CHECKER
const checkSubscription = async (ctx) => {
    if (ctx.from.id === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;
    for (const chan of channels) {
        try {
            const member = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(member.status)) return false;
        } catch (e) { continue; }
    }
    return true;
};

// 6. BOT FLOW
bot.start(async (ctx) => {
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOne({ userId: ctx.from.id });

    if (!user) {
        user = await User.create({ 
            userId: ctx.from.id, 
            firstName: ctx.from.first_name, 
            invitedBy: refId 
        });
        if (refId && refId !== ctx.from.id) {
            await User.findOneAndUpdate({ userId: refId }, { $inc: { balance: 1000, referrals: 1 } });
        }
    }

    return ctx.reply("🌐 Select Language / Tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
        [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
        [Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

bot.action(/^setlang_(.+)$/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ userId: ctx.from.id }, { lang });
    
    if (!(await checkSubscription(ctx))) {
        const chans = await Config.find({ key: 'channel' });
        const buttons = chans.map(c => [Markup.button.url(c.name, c.url)]);
        buttons.push([Markup.button.callback(strings[lang].verify_sub, "check_sub")]);
        return ctx.editMessageText(strings[lang].sub_req, Markup.inlineKeyboard(buttons));
    }
    return ctx.editMessageText(strings[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
});

bot.action("check_sub", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (await checkSubscription(ctx)) {
        return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
    }
    return ctx.answerCbQuery("❌ Obuna bo'ling!", { show_alert: true });
});

bot.action("home", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    return ctx.editMessageText(strings[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

// 7. SECTIONS
bot.action("open_console", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user.isVerified) return ctx.answerCbQuery(strings[user.lang].access_denied, { show_alert: true });
    
    return ctx.editMessageText("🟢 TERMINAL IS ACTIVE", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 OPEN TERMINAL", process.env.WEB_APP_URL)],
        [Markup.button.callback(strings[user.lang].back, "home")]
    ]));
});

bot.action("menu_signals", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 Download ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 VERIFY ID", "verify_id_start")]);
    btns.push([Markup.button.callback(strings[user.lang].back, "home")]);
    return ctx.editMessageText(strings[user.lang].signals_title, Markup.inlineKeyboard(btns));
});

bot.action("verify_id_start", (ctx) => {
    ctx.session.step = 'await_id';
    return ctx.reply("📝 Platformadagi ID raqamingizni kiriting:");
});

bot.action("menu_network", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    return ctx.editMessageText(strings[user.lang].ref_title(user.referrals, link), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]])
    });
});

bot.action("menu_wallet", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    return ctx.editMessageText(strings[user.lang].wallet_title(user.balance), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("💸 Withdraw", "withdraw_start")],
            [Markup.button.callback(strings[user.lang].back, "home")]
        ])
    });
});

bot.action("menu_wins", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    let wins = "🏆 <b>LATEST WINS:</b>\n\n";
    for(let i=0; i<12; i++) {
        const id = Math.floor(1000 + Math.random() * 8000);
        const amt = (Math.floor(Math.random() * 2000000) + 100000).toLocaleString();
        wins += `✅ ID: ${id}** | +${amt} UZS\n`;
    }
    return ctx.editMessageText(wins, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(strings[user.lang].back, "home")]])
    });
});

bot.action("menu_support", async (ctx) => {
    ctx.session.step = 'support';
    return ctx.reply("✍️ Admin uchun xabaringizni yozing:");
});

bot.action("menu_settings", async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    return ctx.editMessageText(strings[user.lang].settings_title(user.userId, user.isVerified, user.notifications), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🔄 Change Language", "start_lang_change")],
            [Markup.button.callback(strings[user.lang].back, "home")]
        ])
    });
});

bot.action("start_lang_change", (ctx) => {
    return ctx.reply("Select Language:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "setlang_uz")],
        [Markup.button.callback("🇷🇺 Русский", "setlang_ru")],
        [Markup.button.callback("🇬🇧 English", "setlang_en")]
    ]));
});

// 8. TEXT HANDLER (Logic for ID, Support, etc.)
bot.on('text', async (ctx) => {
    if (!ctx.session.step) return;

    if (ctx.session.step === 'await_id') {
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text });
        bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>NEW VERIFICATION REQ</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\nGame ID: <code>${ctx.message.text}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback("✅ APPROVE", `approve_${ctx.from.id}`)]])
        });
        ctx.session.step = null;
        return ctx.reply("⏳ Ma'lumot adminga yuborildi. Tasdiqlashni kuting.");
    } else if (ctx.session.step === 'support') {
        bot.telegram.sendMessage(ADMIN_ID, `👨‍💻 <b>SUPPORT TICKET</b>\n\nFrom: ${ctx.from.first_name}\nID: <code>${ctx.from.id}</code>\nMessage: ${ctx.message.text}`);
        ctx.session.step = null;
        return ctx.reply("✅ Xabaringiz yuborildi.");
    }
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    const targetId = ctx.match[1];
    await User.findOneAndUpdate({ userId: targetId }, { isVerified: true });
    bot.telegram.sendMessage(targetId, "✅ Tabriklaymiz! ID tasdiqlandi va barcha funksiyalar ochildi.");
    return ctx.answerCbQuery("Tasdiqlandi!");
});

// 9. EXPRESS SERVER & DEPLOY
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Richi28 Hack Live'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server port: ${PORT}`));

bot.launch().then(() => console.log('🚀 RICHI28 HACK PORTAL STARTED'));
