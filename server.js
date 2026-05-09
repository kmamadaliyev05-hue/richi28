const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ DATABASE MUVAFFAQIYATLI ULANDI'))
  .catch(err => console.error('❌ DB ULANISHDA XATO:', err));

// 2. MODELLAR
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    hackerId: String,
    firstName: String,
    lang: { type: String, default: 'uz' },
    rank: { type: String, default: 'NEWBIE' },
    accuracy: { type: Number, default: 45 },
    referralCount: { type: Number, default: 0 },
    accounts: [{ bookmaker: String, gameId: String, status: String }],
    lastBonus: { type: Date, default: new Date(0) },
    status: { type: String, default: 'active' },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}));

const SupportMessage = mongoose.model('Support', new mongoose.Schema({
    userId: Number, hackerId: String, text: String, status: { type: String, default: 'new' }
}));

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// --- UTILS ---
const generateHackerId = () => Math.floor(10000000 + Math.random() * 90000000).toString();

async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            if (!['member', 'creator', 'administrator', 'restricted'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- MENYU GENERATORI ---
const getMainMenu = (u, isAdmin) => {
    const l = u.lang || 'uz';
    const webUrl = `${process.env.WEB_APP_URL}?id=${u.hackerId}&lang=${l}`;
    
    let btns = [
        [Markup.button.webApp(l === 'uz' ? "🚀 SIGNAL OLISH (Web App)" : "🚀 ПОЛУЧИТЬ СИГНАЛ", webUrl)],
        [Markup.button.callback(l === 'uz' ? "👤 PROFIL" : "👤 ПРОФИЛЬ", 'profile'), 
         Markup.button.callback(l === 'uz' ? "👥 YO'LLANMA SILKA" : "👥 РЕФЕРАЛКА", 'ref')],
        [Markup.button.callback(l === 'uz' ? "🎁 BONUS" : "🎁 БОНУС", 'bonus')],
        [Markup.button.callback(l === 'uz' ? "📚 YO'RIQNOMA" : "📚 ИНСТРУКЦИЯ", 'guide'), 
         Markup.button.callback(l === 'uz' ? "🛠 SOZLAMALAR" : "🛠 НАСТРОЙКИ", 'settings')],
        [Markup.button.callback(l === 'uz' ? "🆘 SUPPORT" : "🆘 ПОДДЕРЖКА", 'support')]
    ];

    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

// --- START ---
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    let user = await User.findOne({ userId: id });
    
    if (!user) {
        user = await User.create({
            userId: id,
            firstName: first_name,
            hackerId: generateHackerId()
        });
    } else if (!user.hackerId) {
        user.hackerId = generateHackerId();
        await user.save();
    }

    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru")]
    ]));
});

// --- CALLBACK ACTIONS ---

bot.action(/^lang_(uz|ru)$/, async (ctx) => {
    const l = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang: l }, { new: true });
    
    if (!(await canAccess(ctx))) {
        const channels = await Config.find({ key: 'channel' });
        const btns = channels.map(c => [Markup.button.url(c.name, c.url)]);
        btns.push([Markup.button.callback("✅ Tekshirish", 'check_sub')]);
        return ctx.editMessageText("⚠️ Botdan foydalanish uchun kanallarga obuna bo'ling:", Markup.inlineKeyboard(btns));
    }

    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${user.hackerId}</code>`, { 
        parse_mode: 'HTML', 
        ...getMainMenu(user, ctx.from.id === ADMIN_ID) 
    });
});

bot.action('check_sub', async (ctx) => {
    if (await canAccess(ctx)) {
        const u = await User.findOne({ userId: ctx.from.id });
        return ctx.editMessageText("✅ Tasdiqlandi!", getMainMenu(u, ctx.from.id === ADMIN_ID));
    }
    await ctx.answerCbQuery("❌ Obuna topilmadi!", { show_alert: true });
});

bot.action('profile', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const accList = u.accounts.length > 0 ? u.accounts.map(a => `\n└ ${a.bookmaker}: ${a.gameId}`).join('') : " Yo'q";
    const text = `👤 <b>HACKER PROFILI</b>\n\n🆔 ID: <code>${u.hackerId}</code>\n📊 DARAJA: <b>${u.rank}</b>\n📈 ANIQLIK: <b>${u.accuracy}%</b>\n👥 REFERALLAR: <b>${u.referralCount}</b>\n📂 PORTFOLIO:${accList}`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]]) });
});

bot.action('ref', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${u.userId}`;
    ctx.editMessageText(`👥 <b>YO'LLANMA TIZIMI</b>\n\nDo'stlarni chaqiring va aniqlikni oshiring!\n\nSizning silkangiz:\n<code>${link}</code>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]]) });
});

bot.action('bonus', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const now = new Date();
    if (now - u.lastBonus < 86400000) return ctx.answerCbQuery("❌ Bonus 24 soatda bir marta beriladi!", { show_alert: true });
    
    const inc = Math.floor(Math.random() * 5) + 1;
    u.accuracy += inc;
    u.lastBonus = now;
    await u.save();
    ctx.answerCbQuery(`🎁 Tabriklaymiz! +${inc}% aniqlik qo'shildi!`, { show_alert: true });
});

bot.action('guide', (ctx) => {
    const text = `<b>📚 YO'RIQNOMA (HACKER ACADEMY)</b>\n\n1. <b>Signal olish shartlari:</b>\n- RICHI28 promokodi bilan ro'yxatdan o'ting.\n- Balansingizda kamida 60,000 so'm bo'lishi kerak.\n\n2. <b>Bonus qanday ishlaydi?</b>\n- Har kuni "Bonus" tugmasini bosing.\n\n3. <b>Xavfsizlik:</b>\n- Accuracy 25% dan past bo'lsa, xavfli!`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]]) });
});

bot.action('settings', (ctx) => {
    ctx.editMessageText("🛠 <b>SOZLAMALAR</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard([
        [Markup.button.callback("🌐 Tilni o'zgartirish", 'change_lang')],
        [Markup.button.callback("📱 Ilovalarni boshqarish", 'wallet')],
        [Markup.button.callback("🔙 Orqaga", 'home')]
    ])});
});

bot.action('change_lang', (ctx) => {
    ctx.editMessageText("🌐 Yangi tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru")],
        [Markup.button.callback("🔙", 'settings')]
    ]));
});

bot.action('wallet', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    let btns = u.accounts.map((a, i) => [Markup.button.callback(`❌ O'chirish: ${a.bookmaker}`, `del_acc_${i}`)]);
    btns.push([Markup.button.callback("➕ Yangi ID qo'shish", 'add_acc')]);
    btns.push([Markup.button.callback("🔙 Orqaga", 'settings')]);
    ctx.editMessageText("📂 <b>ILOVADAGI ACCOUNTLAR:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action('add_acc', (ctx) => {
    const btns = ['1XBET', 'LINEBET', 'MELBET'].map(b => [Markup.button.callback(b, `sel_b_${b}`)]);
    btns.push([Markup.button.callback("🔙", 'wallet')]);
    ctx.editMessageText("Qaysi platformani qo'shmoqchisiz?", Markup.inlineKeyboard(btns));
});

bot.action(/^sel_b_(.+)$/, (ctx) => {
    ctx.session.tmpB = ctx.match[1];
    ctx.session.step = 'wait_game_id';
    ctx.reply(`🆔 [${ctx.match[1]}] uchun ID raqamingizni yuboring:`);
});

bot.action(/^del_acc_(\d+)$/, async (ctx) => {
    const idx = parseInt(ctx.match[1]);
    const u = await User.findOne({ userId: ctx.from.id });
    u.accounts.splice(idx, 1);
    await u.save();
    ctx.answerCbQuery("O'chirildi!");
    return ctx.editMessageText("Account o'chirildi.", Markup.inlineKeyboard([[Markup.button.callback("🔙", 'wallet')]]));
});

bot.action('support', (ctx) => {
    ctx.session.step = 'wait_support';
    ctx.editMessageText("✍️ Adminga xabaringizni yozing:", Markup.inlineKeyboard([[Markup.button.callback("🔙 Bekor qilish", 'home')]]));
});

// --- ADMIN PANEL ---
bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("🛰 <b>ADMIN TERMINAL</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('📩 Xabarlar', 'a_sup')],
        [Markup.button.callback('✉️ Reklama', 'a_bc'), Markup.button.callback('🔙 Chiqish', 'home')]
    ]));
});

bot.action('a_bc', (ctx) => {
    ctx.session.step = 'wait_bc';
    ctx.reply("Yubormoqchi bo'lgan reklama matnini (yoki rasm bilan matn) yuboring:");
});

bot.action('a_sup', async (ctx) => {
    const m = await SupportMessage.find({ status: 'new' }).limit(1);
    if (m.length === 0) return ctx.answerCbQuery("Yangi xabarlar yo'q!");
    ctx.reply(`📩 <b>SUPPORT</b>\nID: <code>${m[0].userId}</code>\n\n${m[0].text}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback("✅ O'qildi", `read_s_${m[0]._id}`)]])
    });
});

bot.action(/^read_s_(.+)$/, async (ctx) => {
    await SupportMessage.findByIdAndUpdate(ctx.match[1], { status: 'read' });
    ctx.editMessageText("✅ Xabar arxivlandi.");
});

// --- TEXT HANDLERS ---
bot.on(['text', 'photo'], async (ctx) => {
    const uid = ctx.from.id;
    const step = ctx.session.step;

    if (step === 'wait_support') {
        const u = await User.findOne({ userId: uid });
        await SupportMessage.create({ userId: uid, hackerId: u.hackerId, text: ctx.message.text });
        ctx.session.step = null;
        return ctx.reply("✅ Xabaringiz yuborildi.");
    }

    if (step === 'wait_game_id') {
        const id = ctx.message.text;
        if (!/^\d+$/.test(id)) return ctx.reply("❌ Faqat raqam yuboring!");
        const u = await User.findOne({ userId: uid });
        u.accounts.push({ bookmaker: ctx.session.tmpB, gameId: id, status: 'active' });
        await u.save();
        ctx.session.step = null;
        return ctx.reply("✅ Account qo'shildi!", getMainMenu(u, uid === ADMIN_ID));
    }

    if (uid === ADMIN_ID && step === 'wait_bc') {
        const users = await User.find();
        ctx.reply(`🚀 Reklama ${users.length} kishiga yuborilmoqda...`);
        users.forEach(u => {
            ctx.telegram.copyMessage(u.userId, ctx.chat.id, ctx.message.message_id).catch(() => {});
        });
        ctx.session.step = null;
        return;
    }

    // Admin Reply
    if (uid === ADMIN_ID && ctx.message.reply_to_message) {
        const match = ctx.message.reply_to_message.text.match(/ID: (\d+)/);
        if (match) {
            ctx.telegram.sendMessage(match[1], `📩 <b>ADMIN JAVOBI:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
            ctx.reply("Javob yuborildi.");
        }
    }
});

bot.action('home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${u.hackerId}</code>`, { 
        parse_mode: 'HTML', 
        ...getMainMenu(u, ctx.from.id === ADMIN_ID) 
    });
});

bot.launch();
const app = express(); app.get('/', (req, res) => res.send('Richi Titan Online')); app.listen(process.env.PORT || 3000);
