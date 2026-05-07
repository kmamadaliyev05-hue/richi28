const { Telegraf, Markup, session } = require('telegraf');
const { User, Config } = require('./models');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 6137845806;

bot.use(session());
bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    return next();
});

// Yordamchi funksiyalar (checkSub, getMainMenu va h.k. yuqoridagi koddan olinadi)
// Barcha bot.start, bot.action, bot.on funksiyalarini shu yerga joylang.

module.exports = bot;
