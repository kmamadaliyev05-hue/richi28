/*
========================================================
⚡ RICHI28 HACK PORTAL
FULL WORKING SERVER.JS
STACK:
- NODEJS
- TELEGRAF
- MONGODB
========================================================
*/

require("dotenv").config();

const { Telegraf, Markup, session } = require("telegraf");
const mongoose = require("mongoose");
const express = require("express");

// ======================================================
// EXPRESS
// ======================================================

const app = express();

app.get("/", (req, res) => {
  res.send("⚡ RICHI28 SYSTEM LIVE");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 SERVER RUNNING ${PORT}`);
});

// ======================================================
// DATABASE
// ======================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ DATABASE CONNECTED");
  })
  .catch((err) => {
    console.log("❌ DATABASE ERROR", err);
  });

// ======================================================
// MODELS
// ======================================================

const UserSchema = new mongoose.Schema({
  userId: {
    type: Number,
    unique: true,
  },

  firstName: String,

  lang: {
    type: String,
    default: "uz",
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  gameId: {
    type: String,
    default: "Kiritilmagan",
  },

  balance: {
    type: Number,
    default: 0,
  },

  referrals: {
    type: Number,
    default: 0,
  },

  invitedBy: Number,

  notifications: {
    type: Boolean,
    default: true,
  },

  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const ConfigSchema = new mongoose.Schema({
  key: String,
  name: String,
  url: String,
  chatId: String,
  content: String,
});

const User = mongoose.model("User", UserSchema);
const Config = mongoose.model("Config", ConfigSchema);

// ======================================================
// BOT
// ======================================================

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = 6137845806;

bot.use(session());

// ======================================================
// LANG
// ======================================================

const texts = {
  uz: {
    welcome:
      "⚡️ <b>[ RICHI28 HACK PORTAL ]</b> ⚡️\n\nTizimga xush kelibsiz Agent!",

    back: "⬅️ Ortga",

    subText:
      "🔐 Botdan foydalanish uchun quyidagi kanallarga obuna bo‘ling:",

    verify: "✅ Tasdiqlash",

    noAccess:
      "⚠️ Ruxsat yo‘q!\n\nAvval ID tasdiqlang.",

    menu: {
      web: "💻 KONSOLNI OCHISH",
      signals: "🚀 SIGNALLAR",
      network: "👥 TARMOQ",
      wins: "🏆 YUTUQLAR",
      guide: "📚 QO‘LLANMA",
      wallet: "💰 HAMYON",
      settings: "🛠 SOZLAMALAR",
      support: "👨‍💻 ADMIN BILAN ALOQA",
    },
  },
};

// ======================================================
// MENU
// ======================================================

function mainMenu(lang, isAdmin = false) {
  const t = texts[lang];

  const buttons = [
    [Markup.button.callback(t.menu.web, "open_web")],

    [
      Markup.button.callback(
        t.menu.signals,
        "signals"
      ),

      Markup.button.callback(
        t.menu.network,
        "network"
      ),
    ],

    [
      Markup.button.callback(
        t.menu.wins,
        "wins"
      ),

      Markup.button.callback(
        t.menu.guide,
        "guide"
      ),
    ],

    [
      Markup.button.callback(
        t.menu.wallet,
        "wallet"
      ),

      Markup.button.callback(
        t.menu.settings,
        "settings"
      ),
    ],

    [
      Markup.button.callback(
        t.menu.support,
        "support"
      ),
    ],
  ];

  if (isAdmin) {
    buttons.push([
      Markup.button.callback(
        "⚙️ ADMIN PANEL",
        "admin"
      ),
    ]);
  }

  return Markup.inlineKeyboard(buttons);
}

// ======================================================
// CHECK SUB
// ======================================================

async function checkSub(ctx) {
  if (ctx.from.id === ADMIN_ID) return true;

  const channels = await Config.find({
    key: "channel",
  });

  if (!channels.length) return true;

  for (const channel of channels) {
    try {
      const member =
        await ctx.telegram.getChatMember(
          channel.chatId,
          ctx.from.id
        );

      if (
        member.status === "left" ||
               member.status === "kicked"
      ) {
        return false;
      }
    } catch (err) {
      console.log(err.message);
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
      userId: ctx.from.id,
    });

    if (!user) {
      user = await User.create({
        userId: ctx.from.id,
        firstName: ctx.from.first_name,
        invitedBy: refId,
      });

      if (
        refId &&
        refId !== ctx.from.id
      ) {
        await User.findOneAndUpdate(
          {
            userId: refId,
          },
          {
            $inc: {
              balance: 1000,
              referrals: 1,
            },
          }
        );
      }
    }

    return ctx.reply(
      "🌐 Tilingizni tanlang:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🇺🇿 O'zbekcha",
            "lang_uz"
          ),

          Markup.button.callback(
            "🇷🇺 Русский",
            "lang_ru"
          ),

          Markup.button.callback(
            "🇬🇧 English",
            "lang_en"
          ),
        ],
      ])
    );
  } catch (err) {
    console.log(err);
  }
});

// ======================================================
// LANG SELECT
// ======================================================

bot.action(
  /^lang_(uz|ru|en)$/,
  async (ctx) => {
    try {
      const lang = ctx.match[1];

      await User.findOneAndUpdate(
        {
          userId: ctx.from.id,
        },
        {
          lang,
        }
      );

      const subscribed =
        await checkSub(ctx);

      if (!subscribed) {
        const channels =
          await Config.find({
            key: "channel",
          });

        const buttons = [];

        channels.forEach((ch) => {
          buttons.push([
            Markup.button.url(
              ch.name,
              ch.url
            ),
          ]);
        });

        buttons.push([
          Markup.button.callback(
            texts.uz.verify,
            "verify_sub"
          ),
        ]);

        return ctx.editMessageText(
          texts.uz.subText,
          {
            reply_markup:
              Markup.inlineKeyboard(
                buttons
              ).reply_markup,
          }
        );
      }

      return ctx.editMessageText(
        texts[lang].welcome,
        {
          parse_mode: "HTML",

          reply_markup: mainMenu(
            lang,
            ctx.from.id === ADMIN_ID
          ).reply_markup,
        }
      );
    } catch (err) {
      console.log(err);
    }
  }
);

// ======================================================
// VERIFY SUB
// ======================================================

bot.action(
  "verify_sub",
  async (ctx) => {
    const ok = await checkSub(ctx);

    if (!ok) {
      return ctx.answerCbQuery(
        "❌ Obuna topilmadi",
        {
          show_alert: true,
        }
      );
    }

    const user = await User.findOne({
      userId: ctx.from.id,
    });

    return ctx.editMessageText(
      texts[user.lang].welcome,
      {
        parse_mode: "HTML",

        reply_markup: mainMenu(
          user.lang,
          ctx.from.id === ADMIN_ID
        ).reply_markup,
      }
    );
  }
);

// ======================================================
// HOME
// ======================================================

bot.action("home", async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id,
  });

  return ctx.editMessageText(
    texts[user.lang].welcome,
    {
      parse_mode: "HTML",

      reply_markup: mainMenu(
        user.lang,
        ctx.from.id === ADMIN_ID
      ).reply_markup,
    }
  );
});

// ======================================================
// WEB APP
// ======================================================

bot.action(
  "open_web",
  async (ctx) => {
    const user = await User.findOne({
      userId: ctx.from.id,
    });

    if (!user.isVerified) {
      return ctx.answerCbQuery(
        texts[user.lang].noAccess,
        {
          show_alert: true,
        }
      );
    }

    return ctx.reply(
      "🟢 KONSOLGA KIRISH RUXSAT BERILDI",
      {
        reply_markup:
          Markup.inlineKeyboard([
            [
              Markup.button.webApp(
                "🚀 TERMINALNI OCHISH",
                process.env.WEB_APP_URL
              ),
            ],

            [
              Markup.button.callback(
                texts[user.lang].back,
                "home"
              ),
            ],
          ]).reply_markup,
      }
    );
  }
);

// ======================================================
// SIGNALS
// ======================================================

bot.action("signals", async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id,
  });

  const apps = await Config.find({
    key: "app",
  });

  const buttons = [];

  apps.forEach((app) => {
    buttons.push([
      Markup.button.url(
        `📥 ${app.name}`,
        app.url
      ),
    ]);
  });

  buttons.push([
    Markup.button.callback(
      "🆔 ID TASDIQLASH",
      "verify_id"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      texts[user.lang].back,
      "home"
    ),
  ]);

  return ctx.editMessageText(
    "🚀 Platformani tanlang:",
    {
      reply_markup:
        Markup.inlineKeyboard(
          buttons
        ).reply_markup,
    }
  );
});

// ======================================================
// VERIFY ID
// ======================================================

bot.action(
  "verify_id",
  async (ctx) => {
    ctx.session.step = "verify_id";

    return ctx.reply(
      "🆔 Platformadagi ID ni yuboring:"
    );
  }
);

// ======================================================
// NETWORK
// ======================================================

bot.action("network", async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id,
  });

  const link = `https://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`;

  const text =
    `👥 <b>TARMOQ</b>\n\n` +
    `🔗 Sizning referal linkingiz:\n` +
    `<code>${link}</code>\n\n` +
    `👤 Taklif qilganlar: ${user.referrals}\n\n` +
    `🎁 5 ta do‘st = 5 000 so‘m\n` +
    `🎁 10 ta do‘st = 13 000 so‘m`;

  return ctx.editMessageText(text, {
    parse_mode: "HTML",

    reply_markup:
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            texts[user.lang].back,
            "home"
          ),
        ],
      ]).reply_markup,
  });
});

// ======================================================
// WALLET
// ======================================================

bot.action("wallet", async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id,
  });

  const text =
    `💰 <b>HAMYON</b>\n\n` +
    `💵 Balans: ${user.balance.toLocaleString()} UZS`;

  return ctx.editMessageText(text, {
    parse_mode: "HTML",

    reply_markup:
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "💸 Pul yechish",
            "withdraw"
          ),
        ],

        [
          Markup.button.callback(
            texts[user.lang].back,
            "home"
          ),
        ],
      ]).reply_markup,
  });
});

// ======================================================
// WITHDRAW
// ======================================================

bot.action(
  "withdraw",
  async (ctx) => {
    ctx.session.step =
      "withdraw_card";

    return ctx.reply(
      "💳 Karta raqamingizni yuboring:"
    );
  }
);

// ======================================================
// SETTINGS
// ======================================================

bot.action(
  "settings",
  async (ctx) => {
    const user = await User.findOne({
      userId: ctx.from.id,
    });

    const text =
      `🛠 <b>SOZLAMALAR</b>\n\n` +
      `🆔 ID: ${user.userId}\n` +
      `✅ Status: ${
        user.isVerified
          ? "Verified"
          : "Unverified"
      }\n` +
      `🔔 Notification: ${
        user.notifications
          ? "Yoqilgan"
          : "O‘chirilgan"
      }`;

    return ctx.editMessageText(
      text,
      {
        parse_mode: "HTML",

        reply_markup:
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🔔 Notification",
                "toggle_notify"
              ),
            ],

            [
              Markup.button.callback(
                texts[user.lang].back,
                "home"
              ),
            ],
          ]).reply_markup,
      }
    );
  }
);

// ======================================================
// TOGGLE NOTIFY
// ======================================================

bot.action(
  "toggle_notify",
  async (ctx) => {
    const user = await User.findOne({
      userId: ctx.from.id,
    });

    user.notifications =
      !user.notifications;

    await user.save();

    return ctx.answerCbQuery(
      user.notifications
        ? "🔔 Yoqildi"
        : "🔕 O‘chirildi"
    );
  }
);

// ======================================================
// GUIDE
// ======================================================

bot.action("guide", async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id,
  });

  const guide =
    await Config.findOne({
      key: "guide",
    });

  return ctx.editMessageText(
    guide?.content ||
      "📚 Qo‘llanma mavjud emas",
    {
      parse_mode: "HTML",

      reply_markup:
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              texts[user.lang].back,
              "home"
            ),
          ],
        ]).reply_markup,
    }
  );
});

// ======================================================
// WINS
// ======================================================

bot.action("wins", async (ctx) => {
  const user = await User.findOne({
    userId: ctx.from.id,
  });

  let text =
    "🏆 <b>SO‘NGGI YUTUQLAR</b>\n\n";

  for (let i = 0; i < 15; i++) {
    const amount =
      Math.floor(
        Math.random() * 2000000
      ) + 100000;

    const id =
      Math.floor(
        Math.random() * 9000
      ) + 1000;

    text += `✅ ID: ${id} | +${amount.toLocaleString()} UZS\n`;
  }

  return ctx.editMessageText(text, {
    parse_mode: "HTML",

    reply_markup:
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            texts[user.lang].back,
            "home"
          ),
        ],
      ]).reply_markup,
  });
});

// ======================================================
// SUPPORT
// ======================================================

bot.action(
  "support",
  async (ctx) => {
    ctx.session.step = "support";

    return ctx.reply(
      "✍️ Muammoingizni yozing:"
    );
  }
);

// ======================================================
// ADMIN APPROVE
// ======================================================

bot.action(
  /^approve_(\d+)$/,
  async (ctx) => {
    const userId = Number(
      ctx.match[1]
    );

    await User.findOneAndUpdate(
      {
        userId,
      },
      {
        isVerified: true,
      }
    );

    await bot.telegram.sendMessage(
      userId,
      "✅ ID tasdiqlandi!"
    );

    return ctx.answerCbQuery(
      "Tasdiqlandi"
    );
  }
);

// ======================================================
// TEXT HANDLER
// ======================================================

bot.on("text", async (ctx) => {
  const step = ctx.session.step;

  // VERIFY ID
  if (step === "verify_id") {
    await User.findOneAndUpdate(
      {
        userId: ctx.from.id,
      },
      {
        gameId: ctx.message.text,
      }
    );

    await ctx.reply(
      "⏳ ID adminga yuborildi."
    );

    await bot.telegram.sendMessage(
      ADMIN_ID,

      `🆔 YANGI ID\n\n` +
        `👤 ${ctx.from.first_name}\n` +
        `🆔 ${ctx.message.text}\n` +
        `📌 ${ctx.from.id}`,

      {
        reply_markup:
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "✅ TASDIQLASH",
                `approve_${ctx.from.id}`
              ),
            ],
          ]).reply_markup,
      }
    );

    ctx.session.step = null;
  }

  // SUPPORT
  else if (step === "support") {
    await ctx.reply(
      "✅ Xabaringiz yuborildi."
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
  else if (
    step === "withdraw_card"
  ) {
    ctx.session.card =
      ctx.message.text;

    ctx.session.step =
      "withdraw_amount";

    return ctx.reply(
      "💵 Summani yuboring:"
    );
  }

  // WITHDRAW AMOUNT
  else if (
    step === "withdraw_amount"
  ) {
    const amount = Number(
      ctx.message.text
    );

    const user = await User.findOne({
      userId: ctx.from.id,
    });

    if (amount < 50000) {
      return ctx.reply(
        "❌ Minimal summa 50 000"
      );
    }

    if (amount > user.balance) {
      return ctx.reply(
        "❌ Balans yetarli emas"
      );
    }

    await ctx.reply(
      "✅ So‘rov yuborildi."
    );

    await bot.telegram.sendMessage(
      ADMIN_ID,

      `💸 YECHISH SO‘ROVI\n\n` +
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

bot.action("admin", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID)
    return;

  return ctx.reply(
    "⚙️ ADMIN PANEL",
    {
      reply_markup:
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "➕ Kanal qo‘shish",
              "add_channel"
            ),
          ],

          [
            Markup.button.callback(
              "➕ App qo‘shish",
              "add_app"
            ),
          ],
        ]).reply_markup,
    }
  );
});

// ======================================================
// START BOT
// ======================================================

bot.launch().then(() => {
  console.log("🚀 BOT STARTED");
});

// ======================================================
// ERRORS
// ======================================================

process.on(
  "unhandledRejection",
  (err) => {
    console.log(err);
  }
);

process.on(
  "uncaughtException",
  (err) => {
    console.log(err);
  }
);
