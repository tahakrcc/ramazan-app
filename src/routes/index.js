const express = require('express');
const router = express.Router();
const appointmentRoutes = require('./appointment.routes');
const adminRoutes = require('./admin.routes');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Public API Rate Limit
router.use('/appointments', apiLimiter, appointmentRoutes);

// Admin Routes (Login has its own limiter)
router.use('/admin', adminRoutes);

module.exports = router;
