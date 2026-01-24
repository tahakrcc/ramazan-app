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

module.exports = router;
