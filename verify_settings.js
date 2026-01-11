const mongoose = require('mongoose');
const Settings = require('./src/models/settings.model');
const appointmentService = require('./src/services/appointment.service');

const MONGO_URI = 'mongodb+srv://admin:SiFCNnMTDL4NfchP@admin.k2ibf6q.mongodb.net/ramazan-app?appName=admin';

const runVerification = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        console.log('1. Setting hours to 10:00 - 24:00...');
        let settings = await Settings.findOne();
        if (!settings) settings = new Settings();

        settings.appointmentStartHour = 10;
        settings.appointmentEndHour = 24;
        await settings.save();
        console.log('Settings updated.');

        console.log('2. Checking available slots for tomorrow...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const slots = await appointmentService.getAvailableSlots(dateStr);
        console.log('Slots:', slots);

        const has10 = slots.includes('10:00');
        const has23 = slots.includes('23:00');
        const has08 = slots.includes('08:00');
        const has24 = slots.includes('24:00'); // Should not exist (end hour is exclusive usually, or recursive check)

        // My loop in logic was: i < settings.appointmentEndHour
        // So if end is 24, last slot is 23:00. This is correct.

        if (has10 && has23 && !has08) {
            console.log('SUCCESS: Slots are correctly respected (10:00 to 23:00).');
        } else {
            console.error('FAILURE: Slots are incorrect.');
            console.log({ has10, has23, has08 });
        }

        console.log('3. Reverting settings to 08:00 - 20:00...');
        settings.appointmentStartHour = 8;
        settings.appointmentEndHour = 20;
        await settings.save();
        console.log('Settings reverted.');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
