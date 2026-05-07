const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true, required: true },
    firstName: String,
    username: String,
    status: { type: String, default: 'new' }, // 'new', 'requested', 'pending_id'
    gameId: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
