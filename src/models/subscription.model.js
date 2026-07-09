const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    subscription: {
        type: Object,
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
