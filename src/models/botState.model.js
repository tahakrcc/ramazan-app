const mongoose = require('mongoose');

// State Machine for WhatsApp Bot
// IDLE -> SELECT_DATE -> SELECT_HOUR -> CONFIRMED (Loop)
const botStateSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true, // One state per user
        index: true
    },
    state: {
        type: String,
        enum: ['IDLE', 'SELECT_DATE', 'SELECT_HOUR', 'SELECT_SERVICE', 'CONFIRMED'],
        default: 'IDLE'
    },
    tempData: {
        date: String, // Temporarily store date while selecting hour
        hour: String
    },
    updatedAt: {
        type: Date,
        default: Date.now,
        expires: 300 // TTL Index: Auto-delete/reset state after 5 minutes of inactivity to prevent "stuck" states
    }
}, { timestamps: true });

const BotState = mongoose.model('BotState', botStateSchema);

module.exports = BotState;
