const Feedback = require('../models/feedback.model');
const BotState = require('../models/botState.model');
const logger = require('../config/logger');

// === Admin Operations ===

const getAllFeedbacks = async (req, res, next) => {
    try {
        let query = {};
        // If user is a BARBER, only show their feedbacks
        if (req.user && req.user.role === 'BARBER') {
            query.barberId = req.user.id;
        }

        const feedbacks = await Feedback.find(query).sort({ createdAt: -1 });
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

        const match = message.trim().match(/^([1-5])\s*(.*)/s);

        if (!match) {
            return res.status(400).json({ error: 'Invalid format. Start with rating 1-5.' });
        }

        const rating = parseInt(match[1]);
        const comment = match[2] || 'Puan verildi.';

        const Appointment = require('../models/appointment.model');
        const lastAppt = await Appointment.findOne({ phone: new RegExp(phone.slice(-10)) }).sort({ date: -1 }); // Get latest

        const customerName = lastAppt ? lastAppt.customerName : 'Müşteri';
        const barberId = lastAppt ? lastAppt.barberId : null;
        const barberName = lastAppt ? lastAppt.barberName : null;

        await Feedback.create({
            customerName,
            phone,
            rating,
            comment,
            barberId,
            barberName,
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
