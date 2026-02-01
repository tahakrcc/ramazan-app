const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    appointmentStartHour: { type: Number, default: 8 },
    appointmentEndHour: { type: Number, default: 20 },
    bookingRangeDays: { type: Number, default: 14 },
    businessAddress: { type: String, default: '' },
    businessMapsLink: { type: String, default: '' },
    closedWeekDays: { type: [Number], default: [0] } // 0=Pazar, 1=Pazartesi, ... 6=Cumartesi
}, { timestamps: true });

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
