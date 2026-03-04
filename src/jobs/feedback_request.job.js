const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const BotState = require('../models/botState.model');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');

// Helper: Get current time in Turkey (UTC+3)
const getTurkeyNow = () => {
    const now = new Date();
    // Offset to Turkey Time (UTC+3) = add 3 hours in ms
    const turkeyOffset = 3 * 60 * 60 * 1000;
    const turkeyTime = new Date(now.getTime() + turkeyOffset);
    return turkeyTime;
};

// Run every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    try {
        const turkeyNow = getTurkeyNow();
        const todayStr = turkeyNow.toISOString().split('T')[0];
        const currentHour = turkeyNow.getUTCHours(); // Use getUTCHours since we already offset

        logger.info(`Feedback job running. Turkey time: ${todayStr} ${currentHour}:xx`);

        // Find today's confirmed appointments that haven't been asked for feedback
        const appointments = await Appointment.find({
            date: todayStr,
            status: 'confirmed',
            feedbackRequested: { $ne: true }
        });

        for (const apt of appointments) {
            const aptHour = parseInt(apt.hour.split(':')[0]);

            // If 2 hours passed since appointment (using Turkey local time)
            if (currentHour >= aptHour + 2) {

                const message = `Merhaba ${apt.customerName}, bugün By Ramazan'ı tercih ettiğiniz için teşekkürler! ✂️\n\nHizmetimizden memnun kaldınız mı? Puanınızı ve görüşünüzü bu mesaja cevap olarak yazabilirsiniz.\n\nÖrnek: "5 Saç kesimi harikaydı"`;

                try {
                    await whatsappService.sendMessage(apt.phone, message);

                    // Update Appointment
                    apt.feedbackRequested = true;
                    await apt.save();

                    // Set Bot State to expect feedback
                    await BotState.findOneAndUpdate(
                        { phone: apt.phone },
                        {
                            state: 'AWAITING_FEEDBACK',
                            context: { appointmentId: apt._id },
                            updatedAt: new Date()
                        },
                        { upsert: true, new: true }
                    );

                    logger.info(`Feedback request sent to ${apt.phone} (apt: ${apt.hour}, current Turkey hour: ${currentHour})`);
                } catch (err) {
                    logger.error(`Failed to send feedback req to ${apt.phone}: ${err.message}`);
                }
            }
        }

    } catch (error) {
        logger.error('Feedback job error:', error);
    }
});

logger.info('Feedback request job scheduled (runs every 30 mins).');
