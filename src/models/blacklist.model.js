const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true
    },
    reason: {
        type: String,
        default: 'Admin tarafından engellendi'
    },
    blockedAt: {
        type: Date,
        default: Date.now
    }
});

const Blacklist = mongoose.model('Blacklist', blacklistSchema);

module.exports = Blacklist;
