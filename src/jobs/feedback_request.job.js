const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const BotState = require('../models/botState.model');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../config/logger');

// Run every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    try {
        const now = new Date();
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        // Find appointments that ended approx 2-3 hours ago
        // And haven't been asked for feedback
        // Note: We need a flag 'feedbackRequested' in appointment or assume via BotState
        // For simplicity, let's query appointments of 'today' where hour < currentHour - 2

        const todayStr = now.toISOString().split('T')[0];

        const appointments = await Appointment.find({
            date: todayStr,
            status: 'confirmed',
            reminderSent: true, // Likely attended
            feedbackRequested: { $ne: true } // New field needed
        });

        for (const apt of appointments) {
            const aptHour = parseInt(apt.hour.split(':')[0]);
            const currentHour = now.getHours();

            // If 2 hours passed since appointment
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

                    logger.info(`Feedback request sent to ${apt.phone}`);
                } catch (err) {
                    logger.error(`Failed to send feedback req to ${apt.phone}: ${err.message}`);
                }
            }
        }

    } catch (error) {
        logger.error('Feedback job error:', error);
    }
});
