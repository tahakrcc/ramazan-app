const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');

const dateUtils = require('../utils/date');

// Run every 10 minutes to check for upcoming appointments
cron.schedule('*/10 * * * *', async () => {
    try {
        const turkeyNow = dateUtils.getTurkeyNow();
        const todayStr = dateUtils.getTurkeyTodayString();

        // Time windows using Turkey time
        // --- 1 HOUR REMINDER (50-70 mins before appointment) ---
        const startWindow60 = new Date(turkeyNow.getTime() + 50 * 60000);
        const endWindow60 = new Date(turkeyNow.getTime() + 70 * 60000);

        // --- 30 MINUTE REMINDER (20-40 mins before appointment) ---
        const startWindow30 = new Date(turkeyNow.getTime() + 20 * 60000);
        const endWindow30 = new Date(turkeyNow.getTime() + 40 * 60000);

        // Find today's confirmed appointments that need reminding
        const appointments = await Appointment.find({
            status: 'confirmed',
            date: todayStr,
            $or: [
                { reminderSent60: { $ne: true } },
                { reminderSent30: { $ne: true } }
            ]
        });

        for (const apt of appointments) {
            // Parse appointment time as Turkey time (same timezone as turkeyNow)
            // We create the Date using the ISO string with the offset applied
            const aptDateTime = new Date(`${apt.date}T${apt.hour}:00.000Z`);
            // aptDateTime is now in "fake UTC" — same frame as turkeyNow

            // 1. Check 60 Minute Window
            if (apt.reminderSent60 !== true) {
                if (aptDateTime >= startWindow60 && aptDateTime <= endWindow60) {
                    const message = `Sayın ${apt.customerName},\nRandevunuza 1 saat kalmıştır. Sizi bekliyoruz.\n- By Ramazan`;
                    try {
                        await whatsappService.sendMessage(apt.phone, message);
                        apt.reminderSent60 = true;
                        await apt.save();
                        logger.info(`60-min Reminder sent to ${apt.phone} (apt: ${apt.date} ${apt.hour})`);
                    } catch (err) {
                        logger.error(`Failed to send 60-min reminder to ${apt.phone}: ${err.message}`);
                    }
                }
            }

            // 2. Check 30 Minute Window
            if (apt.reminderSent30 !== true) {
                if (aptDateTime >= startWindow30 && aptDateTime <= endWindow30) {
                    const message = `Sayın ${apt.customerName},\nRandevunuza 30 dakika kalmıştır.\n- By Ramazan`;
                    try {
                        await whatsappService.sendMessage(apt.phone, message);
                        apt.reminderSent30 = true;
                        await apt.save();
                        logger.info(`30-min Reminder sent to ${apt.phone} (apt: ${apt.date} ${apt.hour})`);
                    } catch (err) {
                        logger.error(`Failed to send 30-min reminder to ${apt.phone}: ${err.message}`);
                    }
                }
            }
        }
    } catch (error) {
        logger.error('Reminder job error:', error);
    }
});

logger.info('Reminder job scheduled (runs every 10 mins) - Checks for 60m and 30m.');
