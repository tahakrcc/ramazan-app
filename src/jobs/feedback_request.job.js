const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const BotState = require('../models/botState.model');
const logger = require('../config/logger');

const dateUtils = require('../utils/date');

// Run every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    try {
        const turkeyNow = dateUtils.getTurkeyNow();
        const todayStr = dateUtils.getTurkeyTodayString();
        const currentHour = dateUtils.getTurkeyHour();

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

                const message = `Merhaba ${apt.customerName}, bugün By Ramazan'ı tercih ettiğiniz için teşekkürler! ✂️\n\nHizmetimizden memnun kaldınız mı? Puanınızı ve görüşünüzü sitemizden bize iletebilirsiniz.`;

                try {
                    // await whatsappService.sendMessage(apt.phone, message);
                    // Push notification based feedback could be implemented here

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

                    logger.info(`Feedback marked requested for ${apt.phone} (apt: ${apt.hour}, current Turkey hour: ${currentHour})`);
                } catch (err) {
                    logger.error(`Failed to mark feedback req for ${apt.phone}: ${err.message}`);
                }
            }
        }

    } catch (error) {
        logger.error('Feedback job error:', error);
    }
});

logger.info('Feedback request job scheduled (runs every 30 mins).');
