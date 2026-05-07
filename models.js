const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' },
    isVerified: { type: Boolean, default: false },
    referralCount: { type: Number, default: 0 },
    refTask: { type: Number, default: 5 },
    joinedAt: { type: Date, default: Date.now }
});

const configSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    value: String,
    chatId: String,
    url: String
});

const User = mongoose.model('User', userSchema);
const Config = mongoose.model('Config', configSchema);

module.exports = { User, Config };
