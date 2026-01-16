const axios = require('axios');
const logger = require('../config/logger');

const WP_SERVICE_URL = process.env.VITE_WP_SERVICE_URL || 'https://ramazan-whatsapp.onrender.com';
const API_KEY = process.env.VITE_WP_API_KEY || '852cb0d2df807a0d3313117d'; // Fallback to provided key

// Configuration for services (kept for reference if needed, but logic is primarily in microservice)
const CONFIG = {
    businessName: 'By Ramazan',
    workingHours: { start: 8, end: 20 },
    location: {
        address: 'Movenpick Hotel -1 Kat - Malatya',
        mapsLink: 'https://www.google.com/maps?q=38.351147,38.285103'
    }
};

const sendMessage = async (phone, message) => {
    try {
        await axios.post(`${WP_SERVICE_URL}/send-message`, {
            phone,
            message,
            apiKey: API_KEY
        });
        logger.info(`Message sent to ${phone} via microservice`);
        return true;
    } catch (error) {
        logger.error(`Failed to send WhatsApp message via microservice: ${error.message}`);
        // Don't throw, just log. We don't want to break the app if notification fails.
        return false;
    }
};

// No-op for compatibility if something calls it
const initialize = () => {
    logger.info('WhatsApp Service is now handled by external microservice.');
};

const getQR = () => {
    return null; // Handle via redirect in server.js
};

module.exports = {
    sendMessage,
    initialize,
    getQR,
    CONFIG
};
