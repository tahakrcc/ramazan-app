const Feedback = require('../models/feedback.model');
const BotState = require('../models/botState.model');
const logger = require('../config/logger');

// === Admin Operations ===

const getAllFeedbacks = async (req, res, next) => {
    try {
        const feedbacks = await Feedback.find().sort({ createdAt: -1 });
        res.json(feedbacks);
    } catch (error) { next(error); }
};

const getApprovedFeedbacks = async (req, res, next) => {
    try {
        const feedbacks = await Feedback.find({ isApproved: true }).sort({ createdAt: -1 });
        res.json(feedbacks);
    } catch (error) { next(error); }
};

const updateFeedbackStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isApproved } = req.body;
        const feedback = await Feedback.findByIdAndUpdate(id, { isApproved }, { new: true });
        res.json(feedback);
    } catch (error) { next(error); }
};

const deleteFeedback = async (req, res, next) => {
    try {
        await Feedback.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (error) { next(error); }
};

// === Bot / Internal Operations ===

const createFeedbackFromBot = async (req, res, next) => {
    try {
        const { phone, message } = req.body;

        // Parse message: Expecting "5 This was great" format or just "5"
        // Regex looks for a number 1-5 at the start
        const match = message.trim().match(/^([1-5])\s*(.*)/s);

        if (!match) {
            return res.status(400).json({ error: 'Invalid format. Start with rating 1-5.' });
        }

        const rating = parseInt(match[1]);
        const comment = match[2] || 'Puan verildi.';

        // Attempt to find customer name from appointments or BotState context
        // For simplicity, we'll store generic if not found, but ideally we passed it in context
        // Just use phone as name fallback or look up latest appointment
        const Appointment = require('../models/appointment.model');
        const lastAppt = await Appointment.findOne({ phone: new RegExp(phone.slice(-10)) }).sort({ date: -1 });
        const customerName = lastAppt ? lastAppt.customerName : 'Müşteri';

        await Feedback.create({
            customerName,
            phone,
            rating,
            comment,
            source: 'whatsapp'
        });

        // Reset bot state
        await BotState.findOneAndUpdate({ phone }, { state: 'IDLE', context: {} });

        res.json({ success: true, message: 'Feedback received' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllFeedbacks,
    getApprovedFeedbacks,
    updateFeedbackStatus,
    deleteFeedback,
    createFeedbackFromBot
};
