const mongoose = require('mongoose');

const closedDateSchema = new mongoose.Schema({
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
        unique: true,
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD']
    },
    reason: {
        type: String,
        trim: true,
        default: 'Tatil'
    }
}, {
    timestamps: true
});

const ClosedDate = mongoose.model('ClosedDate', closedDateSchema);

module.exports = ClosedDate;
