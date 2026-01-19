const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Public
router.get('/approved', feedbackController.getApprovedFeedbacks);

// Bot Hook (Protected by simple key logic if needed, or internal IP)
router.post('/bot-hook', feedbackController.createFeedbackFromBot);

// Admin
router.get('/', authMiddleware.protect, feedbackController.getAllFeedbacks);
router.put('/:id', authMiddleware.protect, feedbackController.updateFeedbackStatus);
router.delete('/:id', authMiddleware.protect, feedbackController.deleteFeedback);

module.exports = router;
