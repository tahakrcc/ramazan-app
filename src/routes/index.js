const express = require('express');
const router = express.Router();
const appointmentRoutes = require('./appointment.routes');
const adminRoutes = require('./admin.routes');

const whatsappController = require('../controllers/whatsapp.controller'); // Added controller
const { apiLimiter } = require('../middlewares/rateLimiter');

// Public API Rate Limit
router.use('/appointments', apiLimiter, appointmentRoutes);

// Admin Routes (Login has its own limiter)
router.use('/admin', adminRoutes);

// WhatsApp Status Route (Protected by admin middleware in future, currently public for dashboard)
router.get('/admin/whatsapp-status', whatsappController.getStatus);

module.exports = router;
