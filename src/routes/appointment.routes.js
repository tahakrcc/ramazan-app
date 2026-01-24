const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const rateLimiter = require('../middlewares/rateLimiter');

router.get('/services', appointmentController.getServices);
router.get('/barbers', appointmentController.getBarbers);
router.get('/available', appointmentController.getAvailable);
router.post('/', rateLimiter.createAppointmentLimiter, appointmentController.create);
router.get('/my', appointmentController.getMy);
router.put('/:id/cancel', appointmentController.cancel);

module.exports = router;
