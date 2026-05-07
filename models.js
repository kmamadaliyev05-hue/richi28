const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // new, requested, id_submitted, verified
    bookmaker: String,
    gameId: String,
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String, // Kanal nomi
    chatId: String, // -100...
    url: String // https://t.me/...
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

module.exports = { User, Config };
