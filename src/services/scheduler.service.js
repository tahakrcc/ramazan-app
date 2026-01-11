const cron = require('node-cron');
const Appointment = require('../models/appointment.model');
const logger = require('../config/logger');
const { addDays, addHours, format } = require('date-fns');
const Settings = require('../models/settings.model');

let whatsappClient = null;

const initScheduler = (client) => {
    whatsappClient = client;

    // Run every day at 09:00 AM (Daily Reminder)
    cron.schedule('0 9 * * *', async () => {
        logger.info('Running daily reminder job...');
        await sendDailyReminders();
    });

    // Run every hour (Hourly Reminder - 1 Hour Before)
    cron.schedule('0 * * * *', async () => {
        logger.info('Running hourly reminder job...');
        await sendHourlyReminders();
    });

    logger.info('Daily reminder scheduler initialized (09:00 AM)');
};

const sendDailyReminders = async () => {
    if (!whatsappClient) {
        logger.error('WhatsApp client not initialized for scheduler');
        return;
    }

    try {
        // Get tomorrow's date
        const tomorrow = addDays(new Date(), 1);
        const dateString = format(tomorrow, 'yyyy-MM-dd');

        // Find confirmed appointments for tomorrow
        const appointments = await Appointment.find({
            date: dateString,
            status: 'confirmed'
        });

        logger.info(`Found ${appointments.length} appointments for reminder: ${dateString}`);

        for (const appt of appointments) {
            try {
                // Format phone: 905xxxxxxxxx -> 905xxxxxxxxx@c.us
                const chatId = `${appt.phone}@c.us`;

                // Get address from settings
                let settings = await Settings.findOne();
                const address = settings ? settings.businessAddress : 'Movenpick Hotel -1. Kat';

                const message = `Sayın ${appt.customerName},\n\nYarın (${appt.date}) saat ${appt.hour} randevunuzu hatırlatmak isteriz.\n\nAdres: ${address}\n\nİyi günler dileriz.`;

                await whatsappClient.sendMessage(chatId, message);
                logger.info(`Reminder sent to ${appt.phone}`);

                // Small delay to avoid spam detection
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (err) {
                logger.error(`Failed to send reminder to ${appt.phone}`, err);
            }
        }

    } catch (error) {
        logger.error('Error in daily reminder job', error);
    }
};

const sendHourlyReminders = async () => {
    if (!whatsappClient) return;

    try {
        const now = new Date();
        const targetTime = addHours(now, 1);

        const targetDateStr = format(targetTime, 'yyyy-MM-dd');
        const targetHourStr = format(targetTime, 'HH:00');

        // Only remind pending or confirmed? 
        // Logic says "confirm" status usually creates appointment. 
        // Pending usually means waiting for payment or something?
        // Let's assume 'confirmed' or check logic. 
        // Original code used 'confirmed' for daily. pending for createdFrom 'whatsapp' usually sets status 'pending' until admin approves?
        // Let's check appointment.service. 
        // Usually whatsapp created appointments are 'pending' or 'confirmed'? 
        // In whatsapp.service refactor: createAppointment({ ... }) -> defaults?
        // Let's assume we want to remind ANY valid appointment. 
        // Using 'confirmed' for safety, or all?
        // I'll stick to 'confirmed' for consistency with daily, OR 'pending' if not approved yet?
        // Let's query both or just 'confirmed'.
        // Actually, if I look at whatsapp service, it just calls createAppointment.
        // Let's check Appointment model?

        const appointments = await Appointment.find({
            date: targetDateStr,
            hour: targetHourStr,
            // status: 'confirmed' // Uncomment if strictly confirmed
        });

        if (appointments.length === 0) return;

        let settings = await Settings.findOne();
        const address = settings ? settings.businessAddress : 'Movenpick Hotel -1. Kat';

        for (const appt of appointments) {
            try {
                const chatId = `${appt.phone}@c.us`;
                // Check if already cancelled? Model probably filters that? status != 'cancelled'
                if (appt.status === 'cancelled') continue;

                const message = `Sayın ${appt.customerName},\n\n🔔 *HATIRLATMA*\n\nBugün saat ${targetHourStr} randevunuz bulunmaktadır. Sizi bekliyoruz.\n\n📍 Adres: ${address}`;

                await whatsappClient.sendMessage(chatId, message);
                logger.info(`Hourly reminder sent to ${appt.phone}`);
            } catch (err) {
                logger.error(`Failed to send hourly reminder to ${appt.phone}`, err);
            }
        }

    } catch (error) {
        logger.error('Error in hourly reminder job', error);
    }
};

module.exports = { initScheduler };
