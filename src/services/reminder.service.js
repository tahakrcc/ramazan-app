const cron = require('node-cron');
const { addMinutes, format, differenceInMinutes, parseISO } = require('date-fns');
const Appointment = require('../models/appointment.model');
const whatsappService = require('./whatsapp.service');
const logger = require('../config/logger');

// Schedule: Run every minute
const startReminderJob = () => {
    logger.info('Reminder service started (Every minute)');

    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const todayStr = format(now, 'yyyy-MM-dd');

            // Get all pending confirmed appointments for today
            const appointments = await Appointment.find({
                date: todayStr,
                status: 'confirmed',
                $or: [
                    { reminderSent60: { $ne: true } },
                    { reminderSent30: { $ne: true } }
                ]
            });

            if (appointments.length === 0) return;

            for (const appt of appointments) {
                // Parse appointment time
                // appt.date is YYYY-MM-DD, appt.hour is HH:00
                const apptDateTime = new Date(`${appt.date}T${appt.hour}`);
                const diffMinutes = differenceInMinutes(apptDateTime, now);

                // 1. One Hour Reminder (Trigger between 55-65 mins)
                if (!appt.reminderSent60 && diffMinutes <= 60 && diffMinutes > 45) {
                    await sendReminder(appt, '60dk');
                    appt.reminderSent60 = true;
                    await appt.save();
                }

                // 2. 30 Minute Reminder (Trigger between 25-35 mins)
                else if (!appt.reminderSent30 && diffMinutes <= 30 && diffMinutes > 20) {
                    await sendReminder(appt, '30dk');
                    appt.reminderSent30 = true;
                    await appt.save();
                }
            }

        } catch (error) {
            logger.error('Reminder job error', error);
        }
    });
};

const sendReminder = async (appt, type) => {
    try {
        const customerName = appt.customerName || 'Değerli Müşterimiz';
        const barberName = appt.barberName ? `\n✂️ Berber: ${appt.barberName}` : '';
        const timeMsg = type === '60dk' ? '1 saat' : '30 dakika';

        const message = `Sayın ${customerName},\n\n🔔 *HATIRLATMA*\n\nRandevunuza yaklaşık *${timeMsg}* kaldı.\n📅 Tarih: ${appt.date}\n⏰ Saat: ${appt.hour}${barberName}\n\nSizi bekliyoruz!`;

        await whatsappService.sendMessage(appt.phone, message);
        logger.info(`Reminder (${type}) sent to ${appt.phone}`);
    } catch (err) {
        logger.error(`Failed to send reminder to ${appt.phone}`, err);
    }
};

module.exports = { startReminderJob };
