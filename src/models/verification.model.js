const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: '10m' } // Automatically delete after 10 minutes
    }
});

const Verification = mongoose.model('Verification', verificationSchema);

module.exports = Verification;
