const express = require('express');
const router = express.Router();
const Complaint = require('../models/complaint.model');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

// Protect all routes
router.use(protect);

// GET all complaints
router.get('/', async (req, res, next) => {
    try {
        const complaints = await Complaint.find().sort({ createdAt: -1 });
        res.json(complaints);
    } catch (error) {
        next(error);
    }
});

// PATCH (Resolve)
router.patch('/:id/resolve', restrictTo('ADMIN'), async (req, res, next) => {
    try {
        const complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
            { status: 'resolved' },
            { new: true }
        );
        res.json(complaint);
    } catch (error) {
        next(error);
    }
});

// DELETE
router.delete('/:id', restrictTo('ADMIN'), async (req, res, next) => {
    try {
        await Complaint.findByIdAndDelete(req.params.id);
        res.json({ message: 'Şikayet silindi' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
