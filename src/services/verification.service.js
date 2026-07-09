const Verification = require('../models/verification.model');
const logger = require('../config/logger');

/**
 * Generate a random 6-digit numeric code
 */
const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const notificationController = require('../controllers/notification.controller');

/**
 * Send OTP via Web Push
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
        
        // Try to send via push notification if the user is already subscribed
        const sent = await notificationController.sendNotificationToPhone(phone, { title: 'Doğrulama Kodu', body: message });
        
        // Even if not sent (e.g. not subscribed yet), we log it and allow them to proceed if they somehow know the code (or we could bypass OTP).
        // For development, we will log the code.
        logger.info(`OTP generated for ${phone}: ${code}`);
        
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

        // Check if OTP has expired (10 minutes)
        const TEN_MINUTES = 10 * 60 * 1000;
        if (Date.now() - verification.createdAt.getTime() > TEN_MINUTES) {
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
    // Only accept verifications from the last 30 minutes
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_MINUTES);
    const verification = await Verification.findOne({ 
        phone, 
        verified: true,
        createdAt: { $gte: cutoff }
    });
    return !!verification;
};

module.exports = {
    sendOTP,
    verifyOTP,
    isVerified
};
