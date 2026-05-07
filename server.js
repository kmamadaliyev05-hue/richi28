require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const bot = require('./bot');

const app = express();

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ DB Error:', err));

bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));

app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);
