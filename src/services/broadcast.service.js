const whatsappService = require('./whatsapp.service');
const Appointment = require('../models/appointment.model');
const logger = require('../config/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendBroadcast = async (message, filter = 'all') => {
    logger.info(`Starting broadcast: "${message}" to filter: ${filter}`);

    let phones = [];

    if (filter === 'all') {
        const appointments = await Appointment.find().distinct('phone');
        phones = appointments;
    } else if (filter === 'today') {
        // Only customers with appointment today
        const today = new Date().toISOString().split('T')[0];
        const appointments = await Appointment.find({ date: today }).distinct('phone');
        phones = appointments;
    } else if (filter === 'future') {
        // Customers with future appointments (including today)
        const today = new Date().toISOString().split('T')[0];
        const appointments = await Appointment.find({ date: { $gte: today } }).distinct('phone');
        phones = appointments;
    }

    // Remove duplicates
    phones = [...new Set(phones)];

    logger.info(`Found ${phones.length} recipients.`);

    let successCount = 0;
    let failCount = 0;

    for (const phone of phones) {
        try {
            // ULTRA SAFE MODE: 10-25 seconds random delay
            // This mimics real human behavior (~3-4 messages per minute)
            const delay = Math.floor(Math.random() * 15000) + 10000;
            await sleep(delay);

            const chatId = `${phone.replace('+', '')}@c.us`;
            await whatsappService.sendMessage(chatId, message);
            successCount++;
        } catch (error) {
            logger.error(`Failed to send broadcast to ${phone}`, error);
            failCount++;
        }
    }

    logger.info(`Broadcast completed. Success: ${successCount}, Fail: ${failCount}`);
    return { successCount, failCount };
};

module.exports = { sendBroadcast };
