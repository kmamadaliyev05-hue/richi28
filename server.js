require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');
const { initBot } = require('./bot');
const { User, Channel } = require('./models');

const app = express();
const bot = initBot(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806; // Kamronbek ID

// DB ulanishi
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ DB Connection Error:', err));

// --- ADMIN PANEL LOGIKASI ---
bot.command('admin', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;
  const total = await User.countDocuments();
  const reqs = await User.countDocuments({ status: 'requested' });
  
  const text = `<b>🏦 ADMIN PANEL</b>\n\n👤 Foydalanuvchilar: ${total}\n📩 Zayavkalar: ${reqs}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📡 Kanallarni boshqarish', 'manage_ch')],
    [Markup.button.callback('📢 Reklama yuborish', 'broadcast')]
  ]);
  ctx.replyWithHTML(text, keyboard);
});

// --- SIGNAL OLISH VA TEKSHIRUV ---
bot.action('get_signal', async (ctx) => {
  const userId = ctx.from.id;
  const dbUser = await User.findOne({ userId });
  const channels = await Channel.find();

  let mustJoin = [];
  for (const ch of channels) {
    try {
      const member = await ctx.telegram.getChatMember(ch.channelId, userId);
      const isOk = ['member', 'administrator', 'creator'].includes(member.status);
      if (!isOk && dbUser?.status !== 'requested') mustJoin.push(ch);
    } catch (e) {
      if (dbUser?.status !== 'requested') mustJoin.push(ch);
    }
  }

  if (mustJoin.length === 0) {
    const webAppUrl = process.env.WEB_APP_URL;
    ctx.replyWithHTML(`<b>Ruxsat berildi! ✅</b>\nPastdagi tugma orqali terminalga kiring:`,
      Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', webAppUrl)]])
    );
  } else {
    const buttons = mustJoin.map(ch => [Markup.button.url(`📢 ${ch.channelName}`, ch.inviteLink)]);
    buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
    ctx.replyWithHTML(`<b>⚠️ DIQQAT!</b>\n\nDavom etish uchun kanallarga obuna bo'ling:`, Markup.inlineKeyboard(buttons));
  }
});

// Botni ishga tushirish
bot.launch();

// Render uchun Express server (Bot o'chib qolmasligi uchun)
app.get('/', (req, res) => res.send('RICHI28 System Online 🚀'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Xatoliklarni ushlash
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
