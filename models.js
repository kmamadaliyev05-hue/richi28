const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  status: { type: String, enum: ['pending', 'requested', 'member'], default: 'pending' },
  joinedAt: { type: Date, default: Date.now }
});

const ChannelSchema = new mongoose.Schema({
  channelId: { type: String, required: true },
  name: { type: String, required: true },
  link: { type: String, required: true }
});

const User = mongoose.model('User', UserSchema);
const Channel = mongoose.model('Channel', ChannelSchema);

module.exports = { User, Channel };
