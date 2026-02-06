const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');

// Run every 10 minutes to check for upcoming appointments
cron.schedule('*/10 * * * *', async () => {
    try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // --- 1 HOUR REMINDER (50-70 mins) ---
        const startWindow60 = new Date(now.getTime() + 50 * 60000);
        const endWindow60 = new Date(now.getTime() + 70 * 60000);

        // --- 30 MINUTE REMINDER (20-40 mins) ---
        const startWindow30 = new Date(now.getTime() + 20 * 60000);
        const endWindow30 = new Date(now.getTime() + 40 * 60000);

        // Find today's confirmed appointments that might need reminding
        // We fetch broadly and filter in loop to avoid complex OR logic in query if schema fields are mixed
        // But better to query confirmed ones for today.
        const appointments = await Appointment.find({
            status: 'confirmed',
            date: todayStr,
            // Optimization: Only fetch if at least one reminder is NOT sent
            $or: [
                { reminderSent60: { $ne: true } },
                { reminderSent30: { $ne: true } }
            ]
        });

        for (const apt of appointments) {
            const aptDateTime = new Date(`${apt.date}T${apt.hour}`);

            // 1. Check 60 Minute Window
            if (apt.reminderSent60 !== true) {
                if (aptDateTime >= startWindow60 && aptDateTime <= endWindow60) {
                    const message = `Sayın ${apt.customerName},\nRandevunuza 1 saat kalmıştır. Sizi bekliyoruz.\n- By Ramazan`;
                    try {
                        await whatsappService.sendMessage(apt.phone, message);
                        apt.reminderSent60 = true;
                        // Determine if we should also mark 30 as skipped? No, 30 comes later.
                        await apt.save();
                        logger.info(`60-min Reminder sent to ${apt.phone}`);
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
                        logger.info(`30-min Reminder sent to ${apt.phone}`);
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
