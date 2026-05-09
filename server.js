const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE ULANISHI (Crash oldini olish uchun error handling qo'shildi)
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ DATABASE CONNECTED'))
  .catch(err => console.error('❌ DB CONNECTION ERROR:', err));

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

// Majburiy obunani tekshirish (Zayafka yuborganlarni ham inobatga oladi)
async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;
    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;

    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            // member, creator, administrator, restricted (ba'zida zayafka holatida shunday bo'ladi)
            if (!['member', 'creator', 'administrator', 'restricted'].includes(member.status)) return false;
        } catch (e) { return false; }
    }
    return true;
}

// --- ASOSIY MENYU ---
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
        user.hackerId = generateHackerId(); // Undefined xatosini tuzatish
        await user.save();
    }

    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru")]
    ]));
});

// --- CALLBACK HANDLERS (Tugmalarni ishlashini ta'minlaydi) ---
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

bot.action('guide', (ctx) => {
    const text = `<b>📚 YO'RIQNOMA (HACKER ACADEMY)</b>\n\n1. <b>Signal olish shartlari:</b>\n- RICHI28 promokodi bilan ro'yxatdan o'tgan bo'lishingiz shart.\n- Balansingizda kamida 60,000 so'm bo'lishi kerak.\n\n2. <b>Bonus qanday ishlaydi?</b>\n- Har kuni "Bonus" tugmasini bosib signal aniqligini (Accuracy) +1% dan +5% gacha oshirishingiz mumkin.\n\n3. <b>Xavfsizlik:</b>\n- Hisob xavfsizligi 25% dan past bo'lsa, tizimdan foydalanmang!`;
    ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Orqaga", 'home')]]) });
});

bot.action('settings', async (ctx) => {
    ctx.editMessageText("<b>🛠 SOZLAMALAR</b>\n\nTilni o'zgartirishingiz yoki ilovalarni boshqarishingiz mumkin:", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback("🌐 Tilni o'zgartirish", 'change_lang')],
            [Markup.button.callback("📱 Ilovalar (Multi-Wallet)", 'wallet')],
            [Markup.button.callback("🔙 Orqaga", 'home')]
        ])
    });
});

bot.action('change_lang', (ctx) => {
    ctx.editMessageText("🌐 Yangi tilni tanlang:", Markup.inlineKeyboard([
        [Markup.button.callback("🇺🇿 O'zbekcha", "lang_uz"), Markup.button.callback("🇷🇺 Русский", "lang_ru")],
        [Markup.button.callback("🔙", 'settings')]
    ]));
});

bot.action('wallet', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    let btns = u.accounts.map((a, i) => [Markup.button.callback(`❌ ${a.bookmaker}: ${a.gameId}`, `del_acc_${i}`)]);
    btns.push([Markup.button.callback("➕ Yangi ID qo'shish", 'add_acc')]);
    btns.push([Markup.button.callback("🔙 Orqaga", 'settings')]);
    ctx.editMessageText("📂 <b>ILOVADAGI IDlar:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action('support', (ctx) => {
    ctx.session.step = 'wait_support';
    ctx.editMessageText("✍️ Adminga xabaringizni yozing. Sizga admin panel orqali javob beriladi:", Markup.inlineKeyboard([[Markup.button.callback("🔙 Bekor qilish", 'home')]]));
});

// --- SUPER ADMIN PANEL (Full Control) ---
bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    ctx.editMessageText("🛰 <b>TITAN ADMIN PANEL</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('📩 Support Xabarlar', 'a_sup')],
        [Markup.button.callback('🔗 Kanallar', 'a_ch'), Markup.button.callback('📱 Ilovalar', 'a_app')],
        [Markup.button.callback('✉️ Xabar yuborish', 'a_bc')],
        [Markup.button.callback('🔙 Chiqish', 'home')]
    ]));
});

bot.action('a_stats', async (ctx) => {
    const total = await User.countDocuments();
    ctx.editMessageText(`📊 <b>STATISTIKA</b>\n\nJami foydalanuvchilar: ${total}`, Markup.inlineKeyboard([[Markup.button.callback('🔙', 'admin_main')]]));
});

bot.action('a_sup', async (ctx) => {
    const msgs = await SupportMessage.find({ status: 'new' }).limit(5);
    if (msgs.length === 0) return ctx.answerCbQuery("Yangi xabarlar yo'q!");
    for (let m of msgs) {
        await ctx.reply(`📩 <b>Xabar</b>\nID: <code>${m.userId}</code>\nAgent: ${m.hackerId}\n\n${m.text}`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback("✅ O'qildi", `read_${m._id}`)]])
        });
    }
});

// --- REPLIES & TEXTS ---
bot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    if (ctx.session.step === 'wait_support') {
        const u = await User.findOne({ userId: uid });
        await SupportMessage.create({ userId: uid, hackerId: u.hackerId, text: ctx.message.text });
        ctx.session.step = null;
        return ctx.reply("✅ Xabaringiz yuborildi.");
    }
    
    // Admin reply mantiqi (Reply qilingan xabarga javob)
    if (uid === ADMIN_ID && ctx.message.reply_to_message) {
        const match = ctx.message.reply_to_message.text.match(/ID: (\d+)/);
        if (match) {
            bot.telegram.sendMessage(match[1], `📩 <b>ADMIN JAVOBI:</b>\n\n${ctx.message.text}`, { parse_mode: 'HTML' });
            ctx.reply("Javob yuborildi.");
        }
    }
});

bot.action('home', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 SECURE</b>\n🆔 Agent ID: <code>${u.hackerId}</code>`, { parse_mode: 'HTML', ...getMainMenu(u, ctx.from.id === ADMIN_ID) });
});

bot.launch();
const app = express(); app.get('/', (req, res) => res.send('Titan Online')); app.listen(process.env.PORT || 3000);
