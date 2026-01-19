const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');

// Run every 10 minutes to check for upcoming appointments
cron.schedule('*/10 * * * *', async () => {
    try {
        const now = new Date();
        const startWindow = new Date(now.getTime() + 50 * 60000); // +50 mins
        const endWindow = new Date(now.getTime() + 70 * 60000);   // +70 mins

        // We want to catch appointments that are roughly 1 hour away.
        // Appointments store date as "YYYY-MM-DD" and hour as "HH:00"

        const todayStr = now.toISOString().split('T')[0];

        // Find today's confirmed appointments that haven't been reminded
        const appointments = await Appointment.find({
            status: 'confirmed',
            reminderSent: { $ne: true },
            date: todayStr
        });

        for (const apt of appointments) {
            const aptDateTime = new Date(`${apt.date}T${apt.hour}`);

            // Check if appointment is within the 1-hour window (approx)
            if (aptDateTime >= startWindow && aptDateTime <= endWindow) {

                const message = `Sayın ${apt.customerName},\nRandevunuza 1 saat kalmıştır. Sizi bekliyoruz.\n- By Ramazan`;

                try {
                    await whatsappService.sendMessage(apt.phone, message);
                    apt.reminderSent = true;
                    await apt.save();
                    logger.info(`Reminder sent to ${apt.phone}`);
                } catch (err) {
                    logger.error(`Failed to send reminder to ${apt.phone}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        logger.error('Reminder job error:', error);
    }
});

logger.info('Reminder job scheduled (runs every 10 mins)');
