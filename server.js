// ======================================================
// ⚡ RICHI28 HACK PORTAL - FULL SERVER
// Developer: GPT
// Stack: NodeJS + Telegraf + MongoDB
// ======================================================

require('dotenv').config();

const { Telegraf, Markup, session } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');

// ======================================================
// DATABASE
// ======================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ DATABASE CONNECTED'))
  .catch((err) => console.log('❌ DB ERROR:', err));

const userSchema = new mongoose.Schema({
  userId: {
    type: Number,
    unique: true
  },

  firstName: String,

  lang: {
    type: String,
    default: 'uz'
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  gameId: {
    type: String,
    default: 'Kiritilmagan'
  },

  balance: {
    type: Number,
    default: 0
  },

  referrals: {
    type: Number,
    default: 0
  },

  invitedBy: Number,

  notifications: {
    type: Boolean,
    default: true
  },

  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const configSchema = new mongoose.Schema({
  key: String, // channel | app | guide
  name: String,
  url: String,
  chatId: String,
  content: String
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

// ======================================================
// BOT
// ======================================================

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = 6137845806;

bot.use(session());

bot.use((ctx, next) => {
  if (!ctx.session) ctx.session = {};
  return next();
});

// ======================================================
// LANGUAGES
// ======================================================

const i18n = {
  uz: {
    welcome:
      '⚡️ <b>[ RICHI28 HACK PORTAL ]</b> ⚡️\n\nTizimga xush kelibsiz, Agent!',

    btn_web: '💻 KONSOLNI OCHISH',
    btn_signals: '🚀 SIGNALLAR',
    btn_network: '👥 TARMOQ',
    btn_wins: '🏆 YUTUQLAR',
    btn_guide: '📚 QO‘LLANMA',
    btn_wallet: '💰 HAMYON',
    btn_settings: '🛠 SOZLAMALAR',
    btn_support: '👨‍💻 ADMIN BILAN ALOQA',

    back: '⬅️ Ortga',

    sub_req:
      '🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo‘ling:',

    verify_sub: '✅ Tasdiqlash',

    no_access: '⚠️ Ruxsat yo‘q! Avval ID tasdiqlang.',

    wallet: (balance) =>
      `💰 <b>HAMYON</b>\n\n💵 Balans: ${balance.toLocaleString()} UZS`,

    network: (count, link) =>
      `👥 <b>TARMOQ</b>\n\n` +
      `🔗 Sizning link:\n<code>${link}</code>\n\n` +
      `👤 Taklif qilinganlar: ${count}\n\n` +
      `🎁 Bonuslar:\n` +
      `• 5 ta do‘st = 5 000 so‘m\n` +
      `• 10 ta do‘st = 13 000 so‘m`,

    settings: (user) =>
      `🛠 <b>SOZLAMALAR</b>\n\n` +
      `🆔 ID: ${user.userId}\n` +
      `✅ Status: ${user.isVerified ? 'Verified' : 'Unverified'}\n` +
      `🔔 Bildirishnoma: ${
        user.notifications ? 'Yoqilgan' : 'O‘chirilgan'
      }`
  }
};

// ======================================================
// MAIN MENU
// ======================================================

const getMainMenu = (lang, isAdmin = false) => {
  const t = i18n[lang];

  const buttons = [
    [Markup.button.callback(t.btn_web, 'open_web')],

    [
      Markup.button.callback(t.btn_signals, 'signals'),
      Markup.button.callback(t.btn_network, 'network')
    ],

    [
      Markup.button.callback(t.btn_wins, 'wins'),
      Markup.button.callback(t.btn_guide, 'guide')
    ],

    [
      Markup.button.callback(t.btn_wallet, 'wallet'),
      Markup.button.callback(t.btn_settings, 'settings')
    ],

    [Markup.button.callback(t.btn_support, 'support')]
  ];

  if (isAdmin) {
    buttons.push([
      Markup.button.callback('⚙️ ADMIN PANEL', 'admin_panel')
    ]);
  }

  return Markup.inlineKeyboard(buttons);
};

// ======================================================
// CHECK SUB
// ======================================================

async function checkSubscription(ctx) {
  if (ctx.from.id === ADMIN_ID) return true;

  const channels = await Config.find({
    key: 'channel'
  });

  if (!channels.length) return true;

  for (const ch of channels) {
    try {
      const member = await ctx.telegram.getChatMember(
        ch.chatId,
        ctx.from.id
      );

      if (
        member.status === 'left' ||
        member.status === 'kicked'
      ) {
        return false;
      }
    } catch (e) {
      console.log(e.message);
    }
  }

  return true;
}

// ======================================================
// START
// ======================================================

bot.start(async (ctx) => {
  try {
    const refId = ctx.startPayload
      ? Number(ctx.startPayload)
      : null;

    let user = await User.findOne({
      userId: ctx.from.id
    });

    if (!user) {
      user = await User.create({
        userId: ctx.from.id,
        firstName: ctx.from.first_name,
        invitedBy: refId
      });

      // REF BONUS
      if (refId && refId !== ctx.from.id) {
        await User.findOneAndUpdate(
          { userId: refId },
          {
            $inc: {
              balance: 1000,
              referrals: 1
            }
          }
        );
      }
    }

    return ctx.reply(
      '🌐 Tilingizni tanlang:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🇺🇿 O'zbekcha",
            'lang_uz'
          ),

          Markup.button.callback(
            '🇷🇺 Русский',
            'lang_ru'
          ),

          Markup.button.callback(
            '🇬🇧 English',
            'lang_en'
          )
        ]
      ])
    );
  } catch (err) {
    console.log(err);
  }
});

// ======================================================
// LANGUAGE
// ======================================================

bot.action(/^lang_(uz|ru|en)$/, async (ctx) => {
  try {
    const lang = ctx.match[1];

    await User.findOneAndUpdate(
      { userId: ctx.from.id },
      { lang }
    );

    const subscribed = await checkSubscription(ctx);

    if (!subscribed) {
      const channels = await Config.find({
        key: 'channel'
      });

      const buttons = channels.map((c) => [
        Markup.button.url(c.name, c.url)
      ]);

      buttons.push([
        Markup.button.callback(
          i18n.uz.verify_sub,
          'verify_sub'
        )
      ]);

      return ctx.editMessageText(
        i18n.uz.sub_req,
        Markup.inlineKeyboard(buttons)
      );
    }

    return ctx.editMessageText(
      i18n.uz.welcome,
      {
        parse_mode: 'HTML',
        ...getMainMenu(
          lang,
          ctx.from.id === ADMIN_ID
        )
      }
    );
  } catch (err) {
    console.log(err);
  }
});

// ======================================================
// VERIFY SUB
// ======================================================

bot.action('verify_sub', async (ctx) => {
  const ok = await checkSubscription(ctx);

  if (!ok) {
    return ctx.answerCbQuery(
      '❌ Hali obuna bo‘lmagansiz',
      {
        show_alert: true
      }
    );
  }

  const user = await User.findOne({
    userId: ctx.from.id
  });

  return ctx.editMessageText(
    i18n[user.lang].welcome,
    {
      parse_mode: 'HTML',
      ...getMainMenu(
        user.lang,
        ctx.from.id === ADMIN_ID
      )
    }
  );
});

// ======================================================
// HOME
// ======================================================

bot.action('home', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  return ctx.editMessageText(
    i18n[user.lang].welcome,
    {
      parse_mode: 'HTML',
      ...getMainMenu(
        user.lang,
        ctx.from.id === ADMIN_ID
      )
    }
  );
});

// ======================================================
// WEB APP
// ======================================================

bot.action('open_web', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  if (!user.isVerified) {
    return ctx.answerCbQuery(
      i18n[user.lang].no_access,
      {
        show_alert: true
      }
    );
  }

  return ctx.reply(
    '🟢 KONSOLGA KIRISH RUXSAT ETILDI',
    Markup.inlineKeyboard([
      [
        Markup.button.webApp(
          '🚀 TERMINALNI ISHGA TUSHIRISH',
          process.env.WEB_APP_URL
        )
      ],

      [
        Markup.button.callback(
          i18n[user.lang].back,
          'home'
        )
      ]
    ])
  );
});

// ======================================================
// SIGNALS
// ======================================================

bot.action('signals', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  const apps = await Config.find({
    key: 'app'
  });

  const buttons = apps.map((app) => [
    Markup.button.url(
      `📥 ${app.name}`,
      app.url
    )
  ]);

  buttons.push([
    Markup.button.callback(
      '🆔 ID TASDIQLASH',
      'verify_id'
    )
  ]);

  buttons.push([
    Markup.button.callback(
      i18n[user.lang].back,
      'home'
    )
  ]);

  return ctx.editMessageText(
    '🚀 Platformani tanlang:',
    Markup.inlineKeyboard(buttons)
  );
});

// ======================================================
// VERIFY ID
// ======================================================

bot.action('verify_id', async (ctx) => {
  ctx.session.step = 'awaiting_id';

  return ctx.reply(
    '🆔 Platformadagi ID raqamingizni kiriting:'
  );
});

// ======================================================
// NETWORK
// ======================================================

bot.action('network', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  const link =
    `https://t.me/${ctx.botInfo.username}` +
    `?start=${ctx.from.id}`;

  return ctx.editMessageText(
    i18n[user.lang].network(
      user.referrals,
      link
    ),
    {
      parse_mode: 'HTML',

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            i18n[user.lang].back,
            'home'
          )
        ]
      ])
    }
  );
});

// ======================================================
// WALLET
// ======================================================

bot.action('wallet', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  return ctx.editMessageText(
    i18n[user.lang].wallet(user.balance),
    {
      parse_mode: 'HTML',

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '💸 Pul yechish',
            'withdraw'
          )
        ],

        [
          Markup.button.callback(
            i18n[user.lang].back,
            'home'
          )
        ]
      ])
    }
  );
});

// ======================================================
// WITHDRAW
// ======================================================

bot.action('withdraw', async (ctx) => {
  ctx.session.step = 'withdraw_card';

  return ctx.reply(
    '💳 Karta raqamingizni yuboring:'
  );
});

// ======================================================
// SETTINGS
// ======================================================

bot.action('settings', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  return ctx.editMessageText(
    i18n[user.lang].settings(user),
    {
      parse_mode: 'HTML',

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🔔 Notification',
            'toggle_notify'
          )
        ],

        [
          Markup.button.callback(
            i18n[user.lang].back,
            'home'
          )
        ]
      ])
    }
  );
});

// ======================================================
// TOGGLE NOTIFY
// ======================================================

bot.action('toggle_notify', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  user.notifications = !user.notifications;

  await user.save();

  return ctx.answerCbQuery(
    user.notifications
      ? '🔔 Yoqildi'
      : '🔕 O‘chirildi'
  );
});

// ======================================================
// GUIDE
// ======================================================

bot.action('guide', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  const guide = await Config.findOne({
    key: 'guide'
  });

  return ctx.editMessageText(
    guide?.content ||
      '📚 Qo‘llanma hozircha mavjud emas',
    {
      parse_mode: 'HTML',

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            i18n[user.lang].back,
            'home'
          )
        ]
      ])
    }
  );
});

// ======================================================
// WINS
// ======================================================

bot.action('wins', async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id
  });

  let text =
    '🏆 <b>SO‘NGGI YUTUQLAR</b>\n\n';

  for (let i = 0; i < 15; i++) {
    const amount =
      Math.floor(Math.random() * 2000000) +
      100000;

    const id =
      Math.floor(Math.random() * 9000) +
      1000;

    text += `✅ ID: ${id}** | +${amount.toLocaleString()} UZS\n`;
  }

  return ctx.editMessageText(text, {
    parse_mode: 'HTML',

    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          i18n[user.lang].back,
          'home'
        )
      ]
    ])
  });
});

// ======================================================
// SUPPORT
// ======================================================

bot.action('support', async (ctx) => {
  ctx.session.step = 'support';

  return ctx.reply(
    '✍️ Muammoingizni yozing:'
  );
});

// ======================================================
// ADMIN APPROVE
// ======================================================

bot.action(/^approve_(\d+)$/, async (ctx) => {
  const userId = Number(ctx.match[1]);

  await User.findOneAndUpdate(
    { userId },
    {
      isVerified: true
    }
  );

  await bot.telegram.sendMessage(
    userId,
    '✅ ID tasdiqlandi!'
  );

  return ctx.answerCbQuery('Tasdiqlandi');
});

// ======================================================
// TEXT HANDLER
// ======================================================

bot.on('text', async (ctx) => {
  const step = ctx.session.step;

  // ID VERIFY
  if (step === 'awaiting_id') {
    await User.findOneAndUpdate(
      {
        userId: ctx.from.id
      },
      {
        gameId: ctx.message.text
      }
    );

    await ctx.reply(
      '⏳ ID adminga yuborildi.'
    );

    await bot.telegram.sendMessage(
      ADMIN_ID,

      `🆔 YANGI ID TASDIQ\n\n` +
        `👤 User: ${ctx.from.first_name}\n` +
        `🆔 ID: ${ctx.message.text}\n` +
        `📌 Telegram ID: ${ctx.from.id}`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '✅ TASDIQLASH',
            `approve_${ctx.from.id}`
          )
        ]
      ])
    );

    ctx.session.step = null;
  }

  // SUPPORT
  else if (step === 'support') {
    await ctx.reply(
      '✅ Xabaringiz yuborildi.'
    );

    await bot.telegram.sendMessage(
      ADMIN_ID,

      `📩 YANGI TICKET\n\n` +
        `👤 ${ctx.from.first_name}\n` +
        `🆔 ${ctx.from.id}\n\n` +
        `✍️ ${ctx.message.text}`
    );

    ctx.session.step = null;
  }

  // WITHDRAW CARD
  else if (step === 'withdraw_card') {
    ctx.session.card = ctx.message.text;
    ctx.session.step = 'withdraw_amount';

    return ctx.reply(
      '💵 Summani kiriting:'
    );
  }

  // WITHDRAW AMOUNT
  else if (step === 'withdraw_amount') {
    const amount = Number(ctx.message.text);

    const user = await User.findOne({
      userId: ctx.from.id
    });

    if (amount < 50000) {
      return ctx.reply(
        '❌ Minimal yechish 50 000 UZS'
      );
    }

    if (amount > user.balance) {
      return ctx.reply(
        '❌ Balans yetarli emas'
      );
    }

    await ctx.reply(
      '✅ So‘rov yuborildi.'
    );

    await bot.telegram.sendMessage(
      ADMIN_ID,

      `💸 PUL YECHISH\n\n` +
        `👤 ${ctx.from.first_name}\n` +
        `🆔 ${ctx.from.id}\n` +
        `💳 ${ctx.session.card}\n` +
        `💵 ${amount.toLocaleString()} UZS`
    );

    ctx.session.step = null;
  }
});

// ======================================================
// ADMIN PANEL
// ======================================================

bot.action('admin_panel', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  return ctx.reply(
    '⚙️ ADMIN PANEL',
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '➕ Kanal qo‘shish',
          'add_channel'
        )
      ],

      [
        Markup.button.callback(
          '➕ App qo‘shish',
          'add_app'
        )
      ]
    ])
  );
});

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.get('/', (req, res) => {
  res.send('⚡ RICHI28 SYSTEM LIVE');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 SERVER ${PORT}`);
});

// ======================================================
// LAUNCH
// ======================================================

bot.launch().then(() => {
  console.log('🚀 BOT LIVE');
});

// ======================================================
// ERRORS
// ======================================================

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT:', err);
});

process.on('unhandledRejection', (err) => {
  console.log('REJECTION:', err);
});
