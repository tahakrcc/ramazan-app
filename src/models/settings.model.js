const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    appointmentStartHour: {
        type: Number,
        required: true,
        default: 8 // Varsayılan 08:00
    },
    appointmentEndHour: {
        type: Number,
        required: true,
        default: 20 // Varsayılan 20:00
    },
    bookingRangeDays: {
        type: Number,
        required: true,
        default: 14 // Varsayılan 14 gün
    },
    businessAddress: {
        type: String,
        default: 'Movenpick Hotel -1 Kat - Malatya'
    },
    businessMapsLink: {
        type: String,
        default: 'https://www.google.com/maps?daddr=%C4%B0n%C3%B6n%C3%BC,+%C4%B0n%C3%B6n%C3%BC+Cd.+No:174,+44090+Ye%C5%9Filyurt/Malatya'
    }
}, {
    timestamps: true
});

// Tek bir ayar dökümanı olmasını garanti etmek için (Singleton Pattern benzeri)
// Genellikle ID'si sabit bir kayıt kullanabiliriz veya sadece ilk kaydı çekeriz.
const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
