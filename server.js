const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const { initBot } = require('./bot');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Baza ulanishi
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB ulandi'))
    .catch(err => console.error('❌ Baza xatosi:', err));

// Botni ishga tushirish
initBot(bot);

bot.launch().then(() => console.log('🚀 Bot ishga tushdi'));

// Render uchun port
app.get('/', (req, res) => res.send('Richi28 Signal Bot Online!'));
app.listen(process.env.PORT || 3000);
