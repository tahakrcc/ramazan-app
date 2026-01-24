const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    barberId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    barberName: {
        type: String,
        trim: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    source: {
        type: String,
        enum: ['whatsapp', 'web'],
        default: 'whatsapp'
    }
}, {
    timestamps: true
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
