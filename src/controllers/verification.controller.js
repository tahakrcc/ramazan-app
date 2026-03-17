const verificationService = require('../services/verification.service');

const sendOTP = async (req, res, next) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Telefon numarası gereklidir.' });
        }

        // Clean phone number
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            return res.status(400).json({ error: 'Geçersiz telefon numarası.' });
        }

        await verificationService.sendOTP(cleanPhone);
        res.json({ message: 'Doğrulama kodu WhatsApp üzerinden gönderildi.' });
    } catch (error) {
        next(error);
    }
};

const verifyOTP = async (req, res, next) => {
    try {
        const { phone, code } = req.body;
        if (!phone || !code) {
            return res.status(400).json({ error: 'Telefon numarası ve kod gereklidir.' });
        }

        const cleanPhone = phone.replace(/\D/g, '');
        const isValid = await verificationService.verifyOTP(cleanPhone, code);

        if (!isValid) {
            return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş kod.' });
        }

        res.json({ success: true, message: 'Telefon numarası doğrulandı.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendOTP,
    verifyOTP
};
