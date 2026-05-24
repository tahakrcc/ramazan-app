const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Public
router.get('/approved', feedbackController.getApprovedFeedbacks);

// Bot Hook — protected with internal API key
const botHookAuth = (req, res, next) => {
    const key = req.headers['x-internal-key'];
    const expectedKey = process.env.BOT_HOOK_KEY;
    if (!expectedKey || key !== expectedKey) {
        return res.status(403).json({ error: 'Yetkisiz erişim.' });
    }
    next();
};
router.post('/bot-hook', botHookAuth, feedbackController.createFeedbackFromBot);

// Admin
router.get('/', authMiddleware.protect, feedbackController.getAllFeedbacks);
router.put('/:id', authMiddleware.protect, authMiddleware.restrictTo('ADMIN'), feedbackController.updateFeedbackStatus);
router.delete('/:id', authMiddleware.protect, authMiddleware.restrictTo('ADMIN'), feedbackController.deleteFeedback);

module.exports = router;
