const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verification.controller');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Rate limit sending OTPs to prevent abuse
router.post('/send-code', apiLimiter, verificationController.sendOTP);
router.post('/check-code', apiLimiter, verificationController.verifyOTP);

module.exports = router;
