const whatsappService = require('../services/whatsapp.service');

const getStatus = (req, res) => {
    try {
        const qrStream = whatsappService.getQR();
        let formattedStatus = 'INITIALIZING';

        if (qrStream === 'READY') {
            formattedStatus = 'CONNECTED';
        } else if (qrStream === 'AUTHENTICATED_PROCESSING') {
            formattedStatus = 'CONNECTING';
        } else if (qrStream && qrStream.startsWith('data:image')) {
            formattedStatus = 'QR_READY';
        }

        res.json({
            status: formattedStatus,
            qr: qrStream
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching WhatsApp status' });
    }
};

const pairWithPhone = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        const code = await whatsappService.pairWithPhone(phone);
        res.json({ code });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Pairing failed' });
    }
};

const logout = async (req, res) => {
    try {
        await whatsappService.logout();
        res.json({ message: 'WhatsApp disconnected' });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
};

module.exports = { getStatus, pairWithPhone, logout };
