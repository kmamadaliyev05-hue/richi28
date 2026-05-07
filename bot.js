const { Telegraf, Markup, session } = require('telegraf');
const { User, Config } = require('./models');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// --- YORDAMCHI FUNKSIYALAR ---
const isAdmin = (ctx) => ctx.from && ctx.from.id === ADMIN_ID;

async function checkSub(ctx) {
    const channels = await Config.find({ key: 'force_channel' });
    if (channels.length === 0) return true;
    for (const ch of channels) {
        try {
            const member = await ctx.telegram.getChatMember(ch.chatId, ctx.from.id);
            const isSub = ['member', 'administrator', 'creator'].includes(member.status);
            if (isSub) return true;
        } catch (e) {
            const user = await User.findOne({ userId: ctx.from.id });
            if (user?.status === 'requested') return true;
        }
    }
    return false;
}

const getMainMenu = (ctx, isVerified) => {
    const buttons = [
        [isVerified ? Markup.button.webApp('⚡️ SIGNAL OLISH (VIP)', process.env.WEB_APP_URL) : Markup.button.callback('🚀 Signal olish', 'get_signal')],
        [Markup.button.url('📱 ILOVALAR', 'https://t.me/apple_ilovalar')],
        [Markup.button.callback('👥 REFERAL SILKA', 'referral_menu')]
    ];
    if (isAdmin(ctx)) buttons.push([Markup.button.callback('🛠 ADMIN PANEL', 'admin_main')]);
    return Markup.inlineKeyboard(buttons);
};

// --- LOGIKA ---
bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    const refId = ctx.startPayload ? parseInt(ctx.startPayload) : null;
    let user = await User.findOne({ userId: id });
    if (!user) {
        user = await User.create({ userId: id, firstName: first_name, username, referredBy: refId });
        if (refId && refId !== id) await User.findOneAndUpdate({ userId: refId }, { $inc: { referralCount: 1 } });
    }
    await ctx.replyWithHTML(`<b>RICHI28 APPLE</b> tizimiga xush kelibsiz!`, getMainMenu(ctx, user.isVerified));
});

bot.action('get_signal', async (ctx) => {
    if (!(await checkSub(ctx))) {
        const channels = await Config.find({ key: 'force_channel' });
        const buttons = channels.map(ch => [Markup.button.url(`📢 ${ch.value}`, ch.url)]);
        buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
        return ctx.editMessageText("⚠️ <b>Obuna bo'ling:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    }
    await ctx.editMessageText("🎯 <b>Platformani tanlang:</b>", {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('1XBET', 'setup_1xbet'), Markup.button.callback('LINEBET', 'setup_linebet')],
            [Markup.button.callback('WINWIN', 'setup_winwin'), Markup.button.callback('888STARZ', 'setup_888starz')],
            [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
        ])
    });
});

bot.action(/^setup_(.+)$/, async (ctx) => {
    ctx.session.book = ctx.match[1].toUpperCase();
    ctx.session.step = 'await_id';
    await ctx.editMessageText(`🆔 <b>${ctx.session.book} ID yuboring:</b>`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Orqaga', 'get_signal')]]) });
});

bot.on('text', async (ctx, next) => {
    if (ctx.session.step === 'await_id') {
        if (!/^\d+$/.test(ctx.message.text)) return ctx.reply("❌ Faqat raqam!");
        await User.findOneAndUpdate({ userId: ctx.from.id }, { gameId: ctx.message.text, bookmaker: ctx.session.book, status: 'id_submitted' });
        ctx.session.step = null;
        await ctx.reply("⏳ <b>ID yuborildi!</b>");
        await bot.telegram.sendMessage(ADMIN_ID, `🔔 <b>YANGI ID:</b> <code>${ctx.message.text}</code>`, Markup.inlineKeyboard([[Markup.button.callback('✅ Tasdiqlash', `v_${ctx.from.id}`)]]));
        return;
    }
    if (isAdmin(ctx)) {
        if (ctx.session.step === 'broadcast') {
            const users = await User.find();
            for (let u of users) { try { await ctx.copyMessage(u.userId); } catch (e) {} }
            ctx.session.step = null;
            return ctx.reply("✅ Reklama yuborildi.");
        }
    }
});

bot.action('referral_menu', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    const link = `https://t.me/${bot.botInfo.username}?start=${ctx.from.id}`;
    await ctx.editMessageText(`🔗 Link: <code>${link}</code>\n👥 Do'stlar: ${user.referralCount}\n🎯 Vazifa: ${user.refTask} ta`, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('💰 Pul yechish', 'withdraw')], [Markup.button.callback('🔙 Orqaga', 'back_to_main')]]) });
});

bot.action('admin_main', (ctx) => {
    if (!isAdmin(ctx)) return;
    ctx.editMessageText("🛠 <b>Admin Panel:</b>", Markup.inlineKeyboard([
        [Markup.button.callback('📢 Reklama', 'broadcast_start')],
        [Markup.button.callback('📊 Statistika', 'a_stats')],
        [Markup.button.callback('🔙 Orqaga', 'back_to_main')]
    ]));
});

bot.action('broadcast_start', (ctx) => { ctx.session.step = 'broadcast'; ctx.reply("Reklama yuboring:"); });

bot.action('back_to_main', async (ctx) => {
    const user = await User.findOne({ userId: ctx.from.id });
    await ctx.editMessageText(`<b>Menyu:</b>`, { parse_mode: 'HTML', ...getMainMenu(ctx, user.isVerified) });
});

bot.action(/^v_(\d+)$/, async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.match[1] }, { isVerified: true });
    bot.telegram.sendMessage(ctx.match[1], "🎉 VIP signallar ochildi!");
    ctx.editMessageText("✅ Tasdiqlandi.");
});

bot.on('chat_join_request', async (ctx) => {
    await User.findOneAndUpdate({ userId: ctx.chatJoinRequest.from.id }, { status: 'requested' }, { upsert: true });
});

module.exports = bot;
