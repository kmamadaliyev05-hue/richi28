const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
require('dotenv').config();

// 1. DATABASE
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('✅ MongoDB Connected');
    try { await mongoose.connection.db.collection('configs').dropIndexes(); } catch (e) {}
    seedApps(); 
});

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    lang: { type: String, default: 'uz' },
    status: { type: String, default: 'new' },
    isVerified: { type: Boolean, default: false },
    gameId: String,
    bookmaker: String,
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
}));

const Config = mongoose.model('Config', new mongoose.Schema({
    key: String, name: String, chatId: String, url: String
}, { autoIndex: false, validateBeforeSave: false, timestamps: true }));

// --- MULTI-LANG LUG'ATI ---
const i18n = {
    uz: {
        welcome: "tizimiga xush kelibsiz!",
        sub_req: "Botdan foydalanish uchun kanallarga a'zo bo'ling yoki so'rov yuboring:",
        check: "✅ Tekshirish",
        signal: "🚀 Signal olish",
        vip_signal: "⚡️ Signal olish (VIP)",
        apps: "📱 Ilovalar",
        ref: "👥 Yo'llanma silka",
        guide: "📖 Bot bilan tanishish",
        terms: "📜 Signal olish shartlari",
        platform: "🎯 <b>Platformani tanlang:</b>",
        input_id: "🆔 ID yuboring (faqat raqam):",
        wait_admin: "⏳ Qabul qilindi, admin tasdiqlashini kuting.",
        back: "🔙 Orqaga",
        no_sub: "❌ Obuna yoki so'rov topilmadi!",
        verified: "✅ Tasdiqlandi!",
        ref_text: (count, task, link) => `👥 <b>Referal tizimi</b>\n\n📊 Odamlar: <b>${count}</b> ta\n🎯 Vazifa: <b>${task}</b> ta\n\n🔗 Havolangiz:\n<code>${link}</code>`,
        terms_text: "<b>📜 SIGNAL OLISH SHARTLARI:</b>\n\n1. Ro'yxatdan o'tishda <b>RICHI28</b> promokodini ishlating.\n2. Balansni kamida 60,000 so'mga to'ldiring.\n3. O'yin ID raqamini botga yuboring.\n\n⚠️ Diqqat: Shartlar bajarilmasa, Hack tizimi xato ishlashi mumkin!",
        guide_text: "<b>📖 BOTDAN FOYDALANISH QO'LLANMASI:</b>\n\n1. Avval kanallarga obuna bo'ling.\n2. 'Signal olish' tugmasini bosing.\n3. O'zingiz o'ynayotgan platformani tanlang va ID yuboring.\n4. Admin tasdiqlagach, VIP tugmasi orqali Web App'ga kiring.\n5. O'yinni tanlang va 'GET SIGNAL' bosing!"
    },
    ru: {
        welcome: "Добро пожаловать в систему!",
        sub_req: "Для использования бота подпишитесь на каналы или отправьте запрос:",
        check: "✅ Проверить",
        signal: "🚀 Получить сигнал",
        vip_signal: "⚡️ Получить сигнал (VIP)",
        apps: "📱 Приложения",
        ref: "👥 Рефералка",
        guide: "📖 Инструкция",
        terms: "📜 Условия получения",
        platform: "🎯 <b>Выберите платформу:</b>",
        input_id: "🆔 Отправьте ID (только цифры):",
        wait_admin: "⏳ Принято, ожидайте подтверждения.",
        back: "🔙 Назад",
        no_sub: "❌ Подписка не найдена!",
        verified: "✅ Подтверждено!",
        ref_text: (count, task, link) => `👥 <b>Реферальная система</b>\n\n📊 Людей: <b>${count}</b>\n🎯 Задание: <b>${task}</b>\n\n🔗 Ссылка:\n<code>${link}</code>`,
        terms_text: "<b>📜 УСЛОВИЯ ПОЛУЧЕНИЯ СИГНАЛА:</b>\n\n1. Используйте промокод <b>RICHI28</b> при регистрации.\n2. Пополните баланс минимум на 500 рублей.\n3. Отправьте ваш ID боту.",
        guide_text: "<b>📖 ИНСТРУКЦИЯ:</b>\n\n1. Подпишитесь на каналы.\n2. Нажмите 'Получить сигнал'.\n3. Выберите платформу и отправьте ID.\n4. После одобрения войдите в Web App.\n5. Выберите игру и нажмите 'GET SIGNAL'!"
    },
    en: {
        welcome: "Welcome to the system!",
        sub_req: "Subscribe to the channels to use the bot:",
        check: "✅ Check",
        signal: "🚀 Get Signal",
        vip_signal: "⚡️ Get Signal (VIP)",
        apps: "📱 Apps",
        ref: "👥 Referral link",
        guide: "📖 How to use",
        terms: "📜 Terms & Conditions",
        platform: "🎯 <b>Select platform:</b>",
        input_id: "🆔 Send ID (numbers only):",
        wait_admin: "⏳ Received, wait for approval.",
        back: "🔙 Back",
        no_sub: "❌ Subscription not found!",
        verified: "✅ Verified!",
        ref_text: (count, task, link) => `👥 <b>Referral System</b>\n\n📊 People: <b>${count}</b>\n🎯 Task: <b>${task}</b>\n\n🔗 Link:\n<code>${link}</code>`,
        terms_text: "<b>📜 TERMS FOR SIGNALS:</b>\n\n1. Use promo code <b>RICHI28</b> during registration.\n2. Top up balance (min. $5).\n3. Send your ID to the bot.",
        guide_text: "<b>📖 USER GUIDE:</b>\n\n1. Subscribe to channels.\n2. Click 'Get Signal'.\n3. Choose platform and send ID.\n4. After approval, enter Web App.\n5. Select game and click 'GET SIGNAL'!"
    }
};

async function seedApps() {
    const defaultApps = ['1XBET', 'LINEBET', 'WINWIN', '888STARZ'];
    for (const appName of defaultApps) {
        const exists = await Config.findOne({ key: 'app', name: appName });
        if (!exists) await Config.create({ key: 'app', name: appName });
    }
}

// 2. BOT SOZLAMALARI
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => { if (!ctx.session) ctx.session = {}; return next(); });

// --- MUKAMMAL REAL-TIME TEKSHIRUV (CHIQIB KETGAN VIPLARNI RESET QILISH BILAN) ---
async function canAccess(ctx) {
    const uid = ctx.from.id;
    if (uid === ADMIN_ID) return true;

    const channels = await Config.find({ key: 'channel' });
    if (channels.length === 0) return true;

    let isSubscribed = false;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, uid);
            if (['member', 'administrator', 'creator'].includes(member.status)) {
                isSubscribed = true;
                break;
            }
        } catch (e) { continue; }
    }

    if (!isSubscribed) {
        const user = await User.findOne({ userId: uid });
        
        // Zayavka holatida bo'lsa o'tkazamiz
        if (user && user.status === 'requested') {
            return true;
        }

        // AGAR OBUNA BO'LMASA VA ZAYAVKASI BO'LMASA:
        // Hatto u VIP bo'lsa ham, kanaldan chiqib ketgan bo'lsa - hamma narsasini reset qilamiz!
        if (user && (user.status !== 'new' || user.isVerified === true)) {
            await User.findOneAndUpdate(
                { userId: uid }, 
                { status: 'new', isVerified: false, gameId: null, bookmaker: null }
            );
        }
        return false;
    }
    return true;
}

const getMainMenu = (u, isAdmin) => {
    const t = i18n[u.lang || 'uz'];
    let btns = [
        [u.isVerified ? Markup.button.webApp(t.vip_signal, `${process.env.WEB_APP_URL}?lang=${u.lang}`) : Markup.button.callback(t.signal, 'get_signal')],
        [Markup.button.callback(t.terms, 'show_terms'), Markup.button.callback(t.guide, 'show_guide')],
        [Markup.button.url(t.apps, 'https://t.me/apple_ilovalar'), Markup.button.callback(t.ref, 'ref_menu')]
    ];
    if (isAdmin) btns.push([Markup.button.callback('🛠 Admin Panel', 'admin_main')]);
    return Markup.inlineKeyboard(btns);
};

const getJoinMenu = async (lang) => {
    const t = i18n[lang] || i18n.uz;
    const channels = await Config.find({ key: 'channel' });
    const btns = channels.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
    btns.push([Markup.button.callback(t.check, 'check_sub')]);
    return Markup.inlineKeyboard(btns);
};

// 3. HANDLERS
bot.start(async (ctx) => {
    const { id, first_name } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOneAndUpdate({ userId: id }, { firstName: first_name }, { upsert: true, new: true });
    if (user.joinedAt.getTime() > (Date.now() - 10000) && refId && refId !== id) {
        await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }
    return ctx.reply("🇺🇿 Tilni tanlang / 🇷🇺 Выберите язык / 🇬🇧 Select language:", 
        Markup.inlineKeyboard([[Markup.button.callback("🇺🇿 O'zbekcha", "set_uz"), Markup.button.callback("🇷🇺 Русский", "set_ru"), Markup.button.callback("🇬🇧 English", "set_en")]]));
});

bot.action(/^set_(uz|ru|en)$/, async (ctx) => {
    const lang = ctx.match[1];
    const user = await User.findOneAndUpdate({ userId: ctx.from.id }, { lang }, { new: true });
    if (!(await canAccess(ctx))) {
        const chs = await Config.find({ key: 'channel' });
        const btns = chs.map(ch => [Markup.button.url(`📢 ${ch.name}`, ch.url)]);
        btns.push([Markup.button.callback(i18n[lang].check, 'check_sub')]);
        return ctx.editMessageText(i18n[lang].sub_req, Markup.inlineKeyboard(btns));
    }
    ctx.editMessageText(`<b>RICHI28 APPLE</b> ${i18n[lang].welcome}\n\n🆔 ID: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('admin_main', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    ctx.editMessageText(`🛠 <b>ADMIN PANEL</b>\n\n📊 Jami foydalanuvchilar: <b>${total}</b>`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 Statistika', 'a_stats'), Markup.button.callback('✉️ Reklama', 'a_bc_menu')],
            [Markup.button.callback('🔗 Kanallar', 'a_ch_man'), Markup.button.callback('📱 Ilovalar', 'a_app_man')],
            [Markup.button.callback('🔙 Chiqish', 'back_home')]
        ])
    });
});

bot.action('a_stats', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const total = await User.countDocuments();
    const verified = await User.countDocuments({ isVerified: true });
    const today = await User.countDocuments({ joinedAt: { $gte: new Date().setHours(0,0,0,0) } });
    const uz = await User.countDocuments({ lang: 'uz' });
    const ru = await User.countDocuments({ lang: 'ru' });
    const en = await User.countDocuments({ lang: 'en' });
    ctx.editMessageText(`📊 <b>STATISTIKA</b>\n\n👥 Jami: <b>${total}</b>\n✅ VIP: <b>${verified}</b>\n🆕 Bugun: <b>${today}</b>\n\n🇺🇿 UZ: ${uz} | 🇷🇺 RU: ${ru} | 🇬🇧 EN: ${en}`, {
        parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'admin_main')]])
    });
});

bot.action('a_bc_menu', (ctx) => {
    ctx.editMessageText("Reklama filtri:", Markup.inlineKeyboard([
        [Markup.button.callback("🌍 Hammaga", "bc_all"), Markup.button.callback("🇺🇿 O'zbeklarga", "bc_uz")],
        [Markup.button.callback("🇷🇺 Ruslarga", "bc_ru"), Markup.button.callback("🇬🇧 Inglizlarga", "bc_en")],
        [Markup.button.callback("🔙 Orqaga", "admin_main")]
    ]));
});

bot.action(/^bc_(all|uz|ru|en)$/, (ctx) => {
    ctx.session.bcTarget = ctx.match[1];
    ctx.session.step = 'bc_media';
    ctx.reply("Reklama uchun media yuboring:");
});

bot.action('a_ch_man', async (ctx) => {
    const chs = await Config.find({ key: 'channel' });
    const btns = chs.map(c => [Markup.button.callback(`❌ ${c.name}`, `del_cfg_${c._id}`)]);
    btns.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('🔙 Orqaga', 'admin_main')]);
    ctx.editMessageText("🔗 <b>KANALLAR</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action('a_app_man', async (ctx) => {
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(`❌ ${a.name}`, `del_cfg_${a._id}`)]);
    btns.push([Markup.button.callback('➕ Qo\'shish', 'add_app')], [Markup.button.callback('🔙 Orqaga', 'admin_main')]);
    ctx.editMessageText("📱 <b>ILOVALAR</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^del_cfg_(.+)$/, async (ctx) => {
    await Config.findByIdAndDelete(ctx.match[1]);
    ctx.answerCbQuery("O'chirildi");
    ctx.editMessageText("O'chirildi.", Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'admin_main')]]));
});

bot.action('add_ch', (ctx) => { ctx.session.step = 'ch_n'; ctx.reply("Nomi:"); });
bot.action('add_app', (ctx) => { ctx.session.step = 'app_n'; ctx.reply("Nomi:"); });

bot.on(['text', 'photo', 'video', 'animation', 'document'], async (ctx) => {
    const step = ctx.session.step;
    if (ctx.from.id === ADMIN_ID) {
        if (step === 'bc_media') {
            const target = ctx.session.bcTarget;
            const filter = target === 'all' ? {} : { lang: target };
            const users = await User.find(filter);
            let count = 0;
            ctx.reply("⏳ Tarqatish boshlandi...");
            for (let u of users) { try { await ctx.copyMessage(u.userId); count++; } catch (e) {} }
            ctx.session.step = null;
            return ctx.reply(`✅ Yetkazildi: ${count}`);
        }
        if (step === 'ch_n') { ctx.session.tmpN = ctx.message.text; ctx.session.step = 'ch_i'; return ctx.reply("ID (-100...):"); }
        if (step === 'ch_i') { ctx.session.tmpI = ctx.message.text; ctx.session.step = 'ch_u'; return ctx.reply("Link:"); }
        if (step === 'ch_u') {
            await Config.create({ key: 'channel', name: ctx.session.tmpN, chatId: ctx.session.tmpI, url: ctx.message.text });
            ctx.session.step = null; return ctx.reply("✅ Kanal qo'shildi!");
        }
        if (step === 'app_n') {
            await Config.create({ key: 'app', name: ctx.message.text });
            ctx.session.step = null; return ctx.reply("✅ Ilova qo'shildi!");
        }
    }

    if (step === 'input_id' && ctx.message.text) {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("Faqat raqam!");
        ctx.session.step = null;
        const user = await User.findOne({ userId: ctx.from.id });
        ctx.reply(i18n[user.lang || 'uz'].wait_admin);
        bot.telegram.sendMessage(ADMIN_ID, `🆔 ID: <code>${ctx.message.text}</code>\n👤: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`, {
            parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Confirm', `confirm_${ctx.from.id}`), Markup.button.callback('❌ Reject', `reject_${ctx.from.id}`)]])
        });
    }
});

bot.action('back_home', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(`<b>RICHI28 APPLE</b>`, { parse_mode: 'HTML', ...getMainMenu(user, ctx.from.id === ADMIN_ID) });
});

bot.action('show_terms', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].terms_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'back_home')]]) });
});

bot.action('show_guide', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.editMessageText(i18n[u.lang].guide_text, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'back_home')]]) });
});

bot.action('check_sub', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (await canAccess(ctx)) return ctx.editMessageText(i18n[u.lang].verified, getMainMenu(u, ctx.from.id === ADMIN_ID));
    await ctx.answerCbQuery(i18n[u.lang].no_sub, { show_alert: true });
});

bot.action('ref_menu', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;
    ctx.editMessageText(i18n[u.lang].ref_text(u.referralCount, u.refTask, link), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'back_home')]]) });
});

bot.action('get_signal', async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    if (!(await canAccess(ctx))) return ctx.editMessageText(i18n[u.lang].sub_req, await getJoinMenu(u.lang));
    const apps = await Config.find({ key: 'app' });
    const btns = apps.map(a => [Markup.button.callback(a.name, `select_app_${a.name}`)]);
    btns.push([Markup.button.callback(i18n[u.lang].back, 'back_home')]);
    ctx.editMessageText(i18n[u.lang].platform, { parse_mode: 'HTML', ...Markup.inlineKeyboard(btns) });
});

bot.action(/^select_app_(.+)$/, async (ctx) => {
    const u = await User.findOne({ userId: ctx.from.id });
    ctx.session.selectedApp = ctx.match[1]; ctx.session.step = 'input_id';
    ctx.editMessageText(`🎯 PLATFORM: ${ctx.session.selectedApp}\n\n${i18n[u.lang].input_id}`, Markup.inlineKeyboard([[Markup.button.callback(i18n[u.lang].back, 'get_signal')]]));
});

bot.action(/^confirm_(\d+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "✅ VIP UNLOCKED!");
    ctx.editMessageText("✅ Confirmed!");
});

bot.action(/^reject_(\d+)$/, (ctx) => ctx.editMessageText("❌ Rejected!"));

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

bot.launch().then(() => console.log('🚀 RICHI28 SYSTEM LIVE'));
const app = express(); app.get('/', (req, res) => res.send('Online')); app.listen(process.env.PORT || 3000);
