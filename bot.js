require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const { User, Channel } = require('./models');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const WEB_APP_URL = process.env.WEB_APP_URL;
const ADMIN_ID = Number(process.env.ADMIN_ID);

const bot = new Telegraf(BOT_TOKEN);

// MongoDB bazasiga ulanish
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB ulandi!'))
  .catch(err => console.error('Baza xatosi:', err));

// 1. ZAYAVKA TUTISH (Join Request Sync)
bot.on('chat_join_request', async (ctx) => {
  const userId = ctx.chatJoinRequest.from.id;
  
  await User.findOneAndUpdate(
    { telegramId: userId }, 
    { status: 'requested' }, 
    { upsert: true, new: true }
  );

  try {
    await ctx.telegram.sendMessage(
      userId, 
      "✅ Zayavkangiz qabul qilindi! Dasturdan foydalanishingiz mumkin.", 
      Markup.inlineKeyboard([Markup.button.webApp('🌐 Terminalga kirish', WEB_APP_URL)])
    );
  } catch (e) {
    console.log("Xabar yuborib bo'lmadi (Blok):", e.message);
  }
});

// Majburiy obunani tekshirish funksiyasi
async function checkSubscriptions(ctx, userId) {
  const channels = await Channel.find();
  if (channels.length === 0) return true; // Kanal yo'q bo'lsa to'g'ridan-to'g'ri o'tkazadi
  
  for (let channel of channels) {
    try {
      const member = await ctx.telegram.getChatMember(channel.channelId, userId);
      if (['left', 'kicked', 'restricted'].includes(member.status)) return false;
    } catch (e) { 
      return false; // Kanal topilmasa yoki bot admin bo'lmasa false qaytaradi
    }
  }
  return true;
}

// 2. GATEKEEPER MODULE (/start)
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  
  let user = await User.findOne({ telegramId: userId });
  if (!user) user = await User.create({ telegramId: userId, status: 'pending' });

  // 1-tekshiruv: Foydalanuvchi avval zayavka tashlaganmi?
  if (user.status === 'requested') {
    return ctx.reply(
      "👋 Xush kelibsiz! Terminalga kirishingiz mumkin.", 
      Markup.inlineKeyboard([Markup.button.webApp('🌐 Terminal', WEB_APP_URL)])
    );
  }

  // 2-tekshiruv: Majburiy obunalar bajarilganmi?
  const isMember = await checkSubscriptions(ctx, userId);
  
  if (isMember) {
    if (user.status !== 'member') { 
      user.status = 'member'; 
      await user.save(); 
    }
    return ctx.reply(
      "👋 Xush kelibsiz! Dasturga kirish uchun tugmani bosing.", 
      Markup.inlineKeyboard([Markup.button.webApp('🌐 Terminal', WEB_APP_URL)])
    );
  } else {
    // A'zo bo'lmasa kanallarni chiqarish
    const channels = await Channel.find();
    const buttons = channels.map(ch => [Markup.button.url(ch.name, ch.link)]);
    buttons.push([Markup.button.callback('🔄 Tekshirish', 'check_sub')]);
    
    return ctx.reply(
      "❌ Dasturdan foydalanish uchun quyidagi kanallarga obuna bo'ling yoki zayavka tashlang:", 
      Markup.inlineKeyboard(buttons)
    );
  }
});

// "Tekshirish" tugmasi hodisasi
bot.action('check_sub', async (ctx) => {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });
  
  if (user && user.status === 'requested') {
    await ctx.deleteMessage().catch(() => {});
    return ctx.reply("✅ Tasdiqlandi!", Markup.inlineKeyboard([Markup.button.webApp('🌐 Terminal', WEB_APP_URL)]));
  }
  
  const isMember = await checkSubscriptions(ctx, userId);
  if (isMember) {
    await ctx.deleteMessage().catch(() => {});
    return ctx.reply("✅ Tasdiqlandi!", Markup.inlineKeyboard([Markup.button.webApp('🌐 Terminal', WEB_APP_URL)]));
  } else {
    return ctx.answerCbQuery("Siz hali barcha kanallarga a'zo bo'lmadingiz!", { show_alert: true });
  }
});

// 3. ADMIN PANEL: Statistika
bot.command('admin_stats', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const totalUsers = await User.countDocuments();
  const requestedUsers = await User.countDocuments({ status: 'requested' });
  ctx.reply(`📊 **Statistika:**\n\n👥 Jami foydalanuvchilar: ${totalUsers}\n⏳ Zayavka tashlaganlar: ${requestedUsers}`);
});

// 4. ADMIN PANEL: Hammaga xabar tarqatish
bot.command('admin_broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  
  const messageToCopy = ctx.message.reply_to_message;
  if (!messageToCopy) return ctx.reply("❗ Iltimos, tarqatmoqchi bo'lgan xabaringizga reply qilib /admin_broadcast yozing.");

  const users = await User.find();
  let successCount = 0;

  await ctx.reply(`⏳ Xabar tarqatish boshlandi... (${users.length} ta foydalanuvchi)`);

  for (let user of users) {
    try {
      await ctx.telegram.copyMessage(user.telegramId, ctx.chat.id, messageToCopy.message_id);
      successCount++;
    } catch (e) {
      // Foydalanuvchi botni bloklagan bo'lsa xatoni e'tiborsiz qoldirish
    }
  }
  ctx.reply(`✅ Xabar muvaffaqiyatli tarqatildi!\nQabul qildi: ${successCount}/${users.length}`);
});

bot.launch().then(() => console.log('Bot ishga tushdi!'));

// Server o'chganda botni xavfsiz to'xtatish
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
