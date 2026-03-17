const Verification = require('../models/verification.model');
const whatsappService = require('./whatsapp.baileys.service');
const logger = require('../config/logger');

/**
 * Generate a random 6-digit numeric code
 */
const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send OTP via WhatsApp
 * @param {string} phone - Target phone number
 * @returns {Promise<boolean>}
 */
const sendOTP = async (phone) => {
    try {
        const code = generateCode();
        
        // Save or update existing verification for this phone
        await Verification.findOneAndUpdate(
            { phone },
            { 
                code, 
                verified: false, 
                createdAt: new Date() 
            },
            { upsert: true, new: true }
        );

        const message = `Doğrulama kodunuz: *${code}*\n\nLütfen bu kodu randevu sayfasındaki ilgili alana giriniz. Kod 10 dakika geçerlidir.`;
        
        const sent = await whatsappService.sendMessage(phone, message);
        if (!sent) {
            throw new Error('WhatsApp mesajı gönderilemedi.');
        }

        logger.info(`OTP sent to ${phone}`);
        return true;
    } catch (error) {
        logger.error(`Error sending OTP to ${phone}:`, error);
        throw error;
    }
};

/**
 * Verify checking code
 * @param {string} phone 
 * @param {string} code 
 * @returns {Promise<boolean>}
 */
const verifyOTP = async (phone, code) => {
    try {
        const verification = await Verification.findOne({ phone, code });
        
        if (!verification) {
            return false;
        }

        verification.verified = true;
        await verification.save();
        
        logger.info(`OTP verified for ${phone}`);
        return true;
    } catch (error) {
        logger.error(`Error verifying OTP for ${phone}:`, error);
        throw error;
    }
};

/**
 * Check if a phone is strictly verified (used during final booking)
 * @param {string} phone 
 * @returns {Promise<boolean>}
 */
const isVerified = async (phone) => {
    const verification = await Verification.findOne({ phone, verified: true });
    return !!verification;
};

module.exports = {
    sendOTP,
    verifyOTP,
    isVerified
};
