const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const settingsController = require('../controllers/settings.controller');
const rateLimiter = require('../middlewares/rateLimiter');

router.get('/settings', settingsController.getSettings);
router.get('/available', appointmentController.getAvailable);
router.post('/', rateLimiter.createAppointmentLimiter, appointmentController.create);
router.get('/my', appointmentController.getMy);
router.put('/:id/cancel', appointmentController.cancel);

module.exports = router;
