const Subscription = require('../models/subscription.model');
const webpush = require('web-push');

webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

exports.subscribe = async (req, res, next) => {
    try {
        const { subscription, phone } = req.body;
        
        if (!subscription || !phone) {
            return res.status(400).json({ error: 'Subscription and phone are required' });
        }

        // Update or insert subscription for this phone
        await Subscription.findOneAndUpdate(
            { phone },
            { subscription },
            { upsert: true, new: true }
        );

        res.status(201).json({ message: 'Subscribed successfully' });
    } catch (error) {
        next(error);
    }
};

// Helper function to send notification from backend services
exports.sendNotificationToPhone = async (phone, payload) => {
    try {
        const subRecord = await Subscription.findOne({ phone });
        if (!subRecord) return false;

        await webpush.sendNotification(subRecord.subscription, JSON.stringify(payload));
        return true;
    } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription expired or invalid, remove it
            await Subscription.deleteOne({ phone });
        }
        console.error('Push notification error:', error);
        return false;
    }
};
