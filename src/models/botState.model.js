const mongoose = require('mongoose');

const botStateSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true
    },
    state: {
        type: String,
        enum: ['IDLE', 'AWAITING_FEEDBACK'],
        default: 'IDLE'
    },
    context: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const BotState = mongoose.model('BotState', botStateSchema);

module.exports = BotState;
