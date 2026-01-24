const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'resolved'],
        default: 'pending'
    },
    source: {
        type: String,
        default: 'whatsapp'
    }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', complaintSchema);
