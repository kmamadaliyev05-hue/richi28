const { Telegraf, Markup } = require('telegraf');
const { User, Channel } = require('./models');

const initBot = (token) => {
  const bot = new Telegraf(token);

  // 1. Join Request (Zayavka) tutish
  bot.on('chat_join_request', async (ctx) => {
    try {
      const { id, first_name, username } = ctx.chatJoinRequest.from;
      await User.findOneAndUpdate(
        { userId: id },
        { firstName: first_name, username, status: 'requested' },
        { upsert: true }
      );
      console.log(`[LOG] New Request: ${id}`);
    } catch (e) {
      console.error('Join Request Error:', e.message);
    }
  });

  // 2. Start buyrug'i
  bot.start(async (ctx) => {
    const { id, first_name, username } = ctx.from;
    await User.findOneAndUpdate({ userId: id }, { firstName: first_name, username }, { upsert: true });

    const text = `<b>Assalomu alaykum, ${first_name}! 👋</b>\n\nRICHI28 APPLE tizimi yordamida o'yinlarda yuqori natijaga erishing.`;
    
    await ctx.replyWithHTML(text, Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Botni ishga tushirish', 'main_menu')]
    ]));
  });

  return bot;
};

module.exports = { initBot };
