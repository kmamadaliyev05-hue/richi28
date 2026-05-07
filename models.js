const mongoose = require('mongoose');

// Foydalanuvchi sxemasi
const UserSchema = new mongoose.Schema({
  userId: { type: Number, unique: true, required: true },
  firstName: String,
  username: String,
  status: { type: String, enum: ['none', 'requested', 'member'], default: 'none' },
  createdAt: { type: Date, default: Date.now }
});

// Majburiy obuna kanallari sxemasi
const ChannelSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  channelName: { type: String, required: true },
  inviteLink: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);
const Channel = mongoose.model('Channel', ChannelSchema);

module.exports = { User, Channel };
