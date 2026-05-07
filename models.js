const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    userId: { type: Number, unique: true, required: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'none' }, // 'requested', 'member'
    
    // Verifikatsiya uchun yangi qismlar:
    gameId: { type: String, default: null }, 
    isVerified: { type: Boolean, default: false }, 
    platform: { type: String, default: 'none' }, 
    
    joinedAt: { type: Date, default: Date.now }
});

const ChannelSchema = new mongoose.Schema({
    channelId: String,
    channelName: String,
    inviteLink: String
});

const User = mongoose.model('User', UserSchema);
const Channel = mongoose.model('Channel', ChannelSchema);

module.exports = { User, Channel };
