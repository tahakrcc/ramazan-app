const express = require('express');
const router = express.Router();
const appointmentRoutes = require('./appointment.routes');
const adminRoutes = require('./admin.routes');
const feedbackRoutes = require('./feedback.routes');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Public API Rate Limit
router.use('/appointments', apiLimiter, appointmentRoutes);

// Admin Routes (Login has its own limiter)
router.use('/admin', adminRoutes);
router.use('/feedbacks', feedbackRoutes);

module.exports = router;
