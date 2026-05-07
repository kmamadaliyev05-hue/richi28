require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const bot = require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ DB Error:', err));

// Bot Launch
bot.launch().then(() => console.log('🚀 RICHI28 BOT LIVE'));

// Express Server (Render o'chib qolmasligi uchun)
app.get('/', (req, res) => res.send('Bot Status: Active'));
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
