const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE STRUKTURASI (Modellar)
mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ RICHI28 SYSTEM CONNECTED'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    isVerified: { type: Boolean, default: false },
    gameId: { type: String, default: 'Kiritilmagan' },
    balance: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 },
    invitedBy: Number,
    notifications: { type: Boolean, default: true },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, // 'channel', 'app', 'guide_video', 'guide_text'
    name: String,
    url: String,
    content: String
}));

// 2. BOT SOZLAMALARI
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// 3. MULTI-LANG LUG'ATI
const i18n = {
    uz: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nTizimga xush kelibsiz, Agent! Kirish muvaffaqiyatli.",
        main_menu: "💻 ASOSIY TERMINAL:",
        btn_web: "💻 KONSOLNI OCHISH",
        btn_signals: "🚀 SIGNALLAR",
        btn_network: "👥 TARMOQ",
        btn_wins: "🏆 YUTUQLAR",
        btn_guide: "📚 QO'LLANMA",
        btn_wallet: "💰 HAMYON",
        btn_settings: "🛠 SOZLAMALAR",
        btn_support: "👨‍💻 ADMIN BILAN ALOQA",
        back: "⬅️ Ortga",
        sub_req: "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo'ling:",
        verify_sub: "✅ Tasdiqlash",
        no_access: "⚠️ Ruxsat yo'q! Avval ID tasdiqlang.",
        id_prompt: "🆔 Platformadagi ID raqamingizni yuboring:",
        support_prompt: "✍️ Muammoingizni batafsil yozing, xabar adminga yuboriladi:",
        wallet_text: (bal) => `💰 <b>HAMYON</b>\n\nJami balans: ${bal.toLocaleString()} UZS\n\nKamida 50,000 UZS bo'lganda yechish mumkin.`,
        ref_text: (count, link) => `👥 <b>TARMOQ</b>\n\nSizning link: <code>${link}</code>\nChaqirilgan do'stlar: ${count} ta\n\n🎁 Mukofotlar:\n- 5 ta do'st = 5,000 UZS\n- 10 ta do'st = 13,000 UZS`
    },
    ru: {
        welcome: "⚡️ [ RICHI28 HACK PORTAL ] ⚡️\nДобро пожаловать, Агент! Вход выполнен.",
        main_menu: "💻 ГЛАВНЫЙ ТЕРМИНАЛ:",
        btn_web: "💻 ОТКРЫТЬ КОНСОЛЬ",
        btn_signals: "🚀 СИГНАЛЫ",
        btn_network: "👥 СЕТЬ",
        btn_wins: "🏆 ВЫИГРЫШИ",
        btn_guide: "📚 ИНСТРУКЦИЯ",
        btn_wallet: "💰 КОШЕЛЕК",
        btn_settings: "🛠 НАСТРОЙКИ",
        btn_support: "👨‍💻 СВЯЗЬ С АДМИНОМ",
        back: "⬅️ Назад",
        sub_req: "🔐 Подпишитесь на каналы для доступа к боту:",
        verify_sub: "✅ Проверить",
        no_access: "⚠️ Нет доступа! Сначала подтвердите ID.",
        id_prompt: "🆔 Отправьте ваш ID номер платформы:",
        support_prompt: "✍️ Опишите вашу проблему админу:"
    }
};

// 4. KLAIATURE GENERATORLARI
const getMainMenu = (lang, isAdmin) => {
    const t = i18n[lang] || i18n.uz;
    let btns = [
        [Markup.button.callback(t.btn_web, 'open_web')],
        [Markup.button.callback(t.btn_signals, 'menu_signals'), Markup.button.callback(t.btn_network, 'menu_network')],
        [Markup.button.callback(t.btn_wins, 'menu_wins'), Markup.button.callback(t.btn_guide, 'menu_guide')],
        [Markup.button.callback(t.btn_wallet, 'menu_wallet'), Markup.button.callback(t.btn_settings, 'menu_settings')],
        [Markup.button.callback(t.btn_support, 'menu_support')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('⚙️ ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// 5. MAJBURIY OBUNA FILTRI
const checkSub = async (ctx) => {
    const channels = await Config.find({ key: 'channel' });
    for (const chan of channels) {
        try {
            const res = await ctx.telegram.getChatMember(chan.chatId, ctx.from.id);
            if (['left', 'kicked'].includes(res.status)) return false;
        } catch (e) { continue; }
    }
    return true;
};

// 6. ASOSIY LOGIKA (START)
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;

    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, invitedBy: refId });
        if (refId && refId !== id) await User.findOneAndUpdate({ userId: refId }, { $inc: { referrals: 1 } });
    }

    return ctx.reply("🌐 Tilingizni tanlang / Выберите язык:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru")]
    ]));
});

bot.action(/^lang_(uz|ru)$/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ userId: ctx.from.id }, { lang });
    const isSub = await checkSub(ctx);
    if (!isSub) {
        const chans = await Config.find({ key: 'channel' });
        const btns = chans.map(c => [Markup.button.url(c.name, c.url)]);
        btns.push([Markup.button.callback(i18n[lang].verify_sub, 'verify_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[lang].welcome, getMainMenu(lang, ctx.from.id === ADMIN_ID));
});

bot.action('verify_sub', async (ctx) => {
    const isSub = await checkSub(ctx);
    const user = await User.findOne({ userId: ctx.from.id });
    if (!isSub) return ctx.answerCbQuery("❌ Obuna bo'linmagan!", { show_alert: true });
    ctx.editMessageText(i18n[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

// 7. BO'LIMLAR MANTIQLARI
bot.action('open_web', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user.isVerified) return ctx.answerCbQuery(i18n[user.lang].no_access, { show_alert: true });
    ctx.reply("🟢 KONSOLGA KIRISH RUXSAT ETILDI:", Markup.inlineKeyboard([
        [Markup.button.webApp("🚀 TERMINALNI ISHGA TUSHIRISH", `${process.env.WEB_APP_URL}?user=${ctx.from.id}`)],
        [Markup.button.callback(i18n[user.lang].back, 'home')]
    ]));
});

bot.action('menu_signals', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.url(`📥 ${a.name}`, a.url)]);
    btns.push([Markup.button.callback("🆔 ID TASDIQLASH", 'verify_id_start')]);
    btns.push([Markup.button.callback(i18n[user.lang].back, 'home')]);
    ctx.editMessageText("🚀 Platformani tanlang va ro'yxatdan o'tib ID yuboring:", Markup.inlineKeyboard(btns));
});

bot.action('verify_id_start', (ctx) => {
    ctx.session.step = 'awaiting_id';
    ctx.reply(i18n[ctx.session.lang || 'uz'].id_prompt);
});

bot.action('menu_network', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(i18n[user.lang].ref_text(user.referrals, link), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]])
    });
});

bot.action('menu_support', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.session.step = 'support_msg';
    ctx.editMessageText(i18n[user.lang].support_prompt, Markup.inlineKeyboard([[Markup.button.callback(i18n[user.lang].back, 'home')]]));
});

// 8. TEXT HANDLER (ID, SUPPORT, ADMIN REPLY)
bot.on('text', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    if (!user) return;

    if (ctx.session.step === 'awaiting_id') {
        const gameId = ctx.message.text;
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId });
        ctx.reply("⏳ Ma'lumot adminga yuborildi.");
        bot.telegram.sendMessage(ADMIN_ID, `🆔 <b>YANGI ID:</b>\n\nUser: ${ctx.from.first_name}\nID: <code>${gameId}</code>`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('✅ TASDIQLASH', `approve_${ctx.from.id}`)],
                [Markup.button.callback('❌ RAD ETISH', `reject_${ctx.from.id}`)]
            ])
        });
        ctx.session.step = null;
    } else if (ctx.session.step === 'support_msg') {
        ctx.reply("✅ Xabar Ticket bo'lib adminga yuborildi.");
        bot.telegram.sendMessage(ADMIN_ID, `📩 <b>YANGI ARIZA:</b>\n\nKimdan: ${ctx.from.first_name}\nID: ${ctx.from.id}\nXabar: ${ctx.message.text}`, {
            ...Markup.inlineKeyboard([[Markup.button.callback('✍️ Javob berish', `adm_reply_${ctx.from.id}`)]])
        });
        ctx.session.step = null;
    } else if (ctx.session.step && ctx.session.step.startsWith('adm_rep_to_')) {
        const targetId = ctx.session.step.split('_')[3];
        bot.telegram.sendMessage(targetId, `👨‍💻 <b>ADMIN JAVOBI:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
        ctx.reply("✅ Javob yuborildi.");
        ctx.session.step = null;
    }
});

// 9. ADMIN PANEL (BOSHQARUV)
bot.action('admin_main', (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("⚙️ <b>ADMIN CONTROL PANEL</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📢 KANALLAR', 'adm_chans'), Markup.button.callback('📱 ILOVALAR', 'adm_apps')],
            [Markup.button.callback('✅ ID TASDIQLASH', 'adm_id_list'), Markup.button.callback('💰 TO\'LOVLAR', 'adm_pays')],
            [Markup.button.callback('📩 ARIZALAR', 'adm_tickets'), Markup.button.callback('📊 STATISTIKA', 'adm_stats')],
            [Markup.button.callback('📢 REKLAMA', 'adm_post'), Markup.button.callback('🔙 CHIQUV', 'home')]
        ])
    });
});

bot.action(/^approve_(\d+)$/, async (ctx) => {
    const tid = ctx.match[1];
    await User.findOneAndUpdate({ userId: tid }, { isVerified: true });
    bot.telegram.sendMessage(tid, "✅ ID tasdiqlandi, Konsol ochildi!");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.action(/^adm_reply_(\d+)$/, (ctx) => {
    const tid = ctx.match[1];
    ctx.session.step = `adm_rep_to_${tid}`;
    ctx.reply(`User ${tid} uchun javob matnini yuboring:`);
});

bot.action('adm_stats', async (ctx) => {
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    const today = await User.countDocuments({ joinedAt: { $gte: new Date().setHours(0,0,0,0) } });
    ctx.editMessageText(`📊 <b>STATISTIKA:</b>\n\nJami: ${total}\nBugun: ${today}\nTasdiqlangan: ${verified}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Ortga', 'admin_main')]])
    });
});

bot.action('home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[user.lang].welcome, getMainMenu(user.lang, ctx.from.id === ADMIN_ID));
});

// 10. SERVER ISHGA TUSHURISH
const app = express();
app.get('/', (req, res) => res.send('Richi28 Hack Server is Active'));
app.listen(process.env.PORT || 3000);

bot.launch().then(() => console.log('🚀 RICHI28 PORTAL LIVE'));

// Xatoliklarni ushlash
bot.catch((err) => console.error('Bot Error:', err));
