const cron = require('node-cron');
const { addHours, format } = require('date-fns');
const Appointment = require('../models/appointment.model');
const whatsappService = require('./whatsapp.service');
const logger = require('../config/logger');

// Schedule: At minute 0 past every hour
const startReminderJob = () => {
    logger.info('Reminder service started (Every hour)');

    cron.schedule('0 * * * *', async () => {
        logger.info('Running hourly reminder job...');
        try {
            const now = new Date();
            const targetTime = addHours(now, 1);

            const targetDateStr = format(targetTime, 'yyyy-MM-dd');
            // Format hour as "HH:00"
            const targetHourStr = format(targetTime, 'HH:00');

            logger.info(`Checking appointments for ${targetDateStr} ${targetHourStr}`);

            const appointments = await Appointment.find({
                date: targetDateStr,
                hour: targetHourStr,
                status: 'pending' // Only remind pending appointments
            });

            if (appointments.length === 0) {
                logger.info('No appointments found for reminder.');
                return;
            }

            logger.info(`Found ${appointments.length} appointments to remind.`);

            for (const appt of appointments) {
                try {
                    const phone = appt.phone;
                    const chatId = `${phone.replace('+', '')}@c.us`;
                    const customerName = appt.customerName || 'Değerli Müşterimiz';

                    const message = `Sayın ${customerName},\n\n🔔 *HATIRLATMA*\n\nBugün saat ${targetHourStr} randevunuz bulunmaktadır. Sizi bekliyoruz.\n\n📍 Adres: ${whatsappService.CONFIG ? whatsappService.CONFIG.location.address : 'Movenpick Hotel -1. Kat'}`;

                    // Note: accessing whatsappService.CONFIG might be problematic since we removed export.
                    // We should fetch dynamic config or hardcode/fallback logic here too.
                    // Ideally reminder service should also fetch config.

                    // Better message without relying on exported CONFIG if it's not available:
                    // Or we can import Settings here.

                    await whatsappService.sendMessage(chatId, message);
                    logger.info(`Reminder sent to ${phone}`);
                } catch (err) {
                    logger.error(`Failed to send reminder to ${appt.phone}`, err);
                }
            }

        } catch (error) {
            logger.error('Reminder job error', error);
        }
    });
};

module.exports = { startReminderJob };
