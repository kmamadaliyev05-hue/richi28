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

// --- 1. ASOSIY MENYU (ACTION) ---
bot.action('main_menu', async (ctx) => {
  try {
    const text = `<b>Asosiy menyu:</b>`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('📱 Ilovalar', 'https://t.me/apple_ilovalar')],
      [Markup.button.callback('🍎 Signal olish', 'get_signal')],
      [Markup.button.callback('📹 Video qo\'llanma', 'get_tutorial')]
    ]);
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
  } catch (e) {
    console.error("Main Menu Error:", e);
  }
});

// --- 2. SIGNAL OLISH VA TEKSHIRUV ---
bot.action('get_signal', async (ctx) => {
  const userId = ctx.from.id;
  try {
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
      await ctx.replyWithHTML(`<b>Terminal yuklandi: ✅</b>\nPastdagi tugma orqali terminalga kiring:`,
        Markup.inlineKeyboard([[Markup.button.webApp('⚡️ TERMINAL', webAppUrl)]])
      );
    } else {
      const buttons = mustJoin.map(ch => [Markup.button.url(`📢 ${ch.channelName}`, ch.inviteLink)]);
      buttons.push([Markup.button.callback('🔄 TEKSHIRISH', 'get_signal')]);
      await ctx.replyWithHTML(`<b>⚠️ DIQQAT!</b>\n\nTerminalga kirish uchun quyidagi kanallarga obuna bo'ling yoki zayavka yuboring:`, Markup.inlineKeyboard(buttons));
    }
  } catch (err) {
    console.error("Get Signal Error:", err);
  }
});

// --- 3. ADMIN PANEL ---
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

// Kanallar boshqaruvi
bot.action('manage_ch', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    const channels = await Channel.find();
    const buttons = channels.map(ch => [Markup.button.callback(`❌ ${ch.channelName}`, `del_${ch._id}`)]);
    buttons.push([Markup.button.callback('➕ Qo\'shish', 'add_ch')], [Markup.button.callback('⬅️ Orqaga', 'admin_panel')]);
    await ctx.editMessageText("<b>📡 Kanallar:</b>", { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('add_ch', ctx => ctx.replyWithHTML("Format: <code>ID | Nomi | Link</code>"));

// Text xabarlarni tutish (Kanal qo'shish uchun)
bot.on('text', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    if (ctx.message.text.includes('|')) {
        const [id, name, link] = ctx.message.text.split('|').map(p => p.trim());
        await Channel.create({ channelId: id, channelName: name, inviteLink: link });
        return ctx.reply("✅ Kanal qo'shildi!");
    }
});

bot.action(/^del_(.+)$/, async (ctx) => {
    await Channel.findByIdAndDelete(ctx.match[1]);
    await ctx.answerCbQuery("O'chirildi!");
    ctx.reply("Kanal o'chirildi.");
});

// Botni ishga tushirish
bot.launch();

// Server (Bot o'chib qolmasligi uchun)
app.get('/', (req, res) => res.send('System Online 🚀'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

bot.catch((err) => console.error("Bot Error:", err));
