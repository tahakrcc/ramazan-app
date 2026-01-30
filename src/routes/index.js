const express = require('express');
const router = express.Router();
const appointmentRoutes = require('./appointment.routes');
const adminRoutes = require('./admin.routes');
const feedbackRoutes = require('./feedback.routes');
const complaintRoutes = require('./complaint.routes');

// Routes (apiLimiter already applied at app.js level)
router.use('/appointments', appointmentRoutes);
router.use('/admin', adminRoutes);
router.use('/feedbacks', feedbackRoutes);
router.use('/complaints', complaintRoutes);

// Public settings endpoint (no auth required)
router.get('/settings/public', async (req, res, next) => {
    try {
        const Settings = require('../models/settings.model');
        const settings = await Settings.getSettings();
        // Only expose necessary public fields
        res.json({
            bookingRangeDays: settings.bookingRangeDays || 14,
            appointmentStartHour: settings.appointmentStartHour || 10,
            appointmentEndHour: settings.appointmentEndHour || 20,
            businessAddress: settings.businessAddress || '',
            businessMapsLink: settings.businessMapsLink || ''
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
