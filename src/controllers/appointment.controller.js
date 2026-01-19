const appointmentService = require('../services/appointment.service');
const Joi = require('joi');

// Joi Schema for Validation - Updated with service field
// Joi Schema for Validation - Updated with service field
const createSchema = Joi.object({
    customerName: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[0-9]{10,11}$/).required().messages({
        'string.pattern.base': 'Geçerli bir telefon numarası giriniz (10-11 rakam)'
    }),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
        'string.pattern.base': 'Tarih formatı: YYYY-MM-DD olmalı'
    }),
    hour: Joi.string().pattern(/^\d{2}:00$/).required().messages({
        'string.pattern.base': 'Saat formatı: HH:00 olmalı'
    }),
    service: Joi.string().required() // Dynamic service ID validation would be better but string is enough for now
});

const getServices = async (req, res, next) => {
    try {
        const Service = require('../models/service.model');
        const services = await Service.find({ isActive: true }).sort({ price: 1 });
        res.json(services);
    } catch (error) {
        next(error);
    }
};

const getAvailable = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        const slots = await appointmentService.getAvailableSlots(date);
        res.json({ date, availableSlots: slots });
    } catch (error) {
        next(error);
    }
};

// In-memory rate limit store (IP -> { count, firstRequest })
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_APPOINTMENTS_PER_WINDOW = 2;

// Cleanup old entries every 30 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitStore.entries()) {
        if (now - data.firstRequest > RATE_LIMIT_WINDOW_MS) {
            rateLimitStore.delete(ip);
        }
    }
}, 30 * 60 * 1000);

const create = async (req, res, next) => {
    try {
        // Rate Limiting Check
        const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();

        if (rateLimitStore.has(clientIP)) {
            const data = rateLimitStore.get(clientIP);
            if (now - data.firstRequest < RATE_LIMIT_WINDOW_MS) {
                if (data.count >= MAX_APPOINTMENTS_PER_WINDOW) {
                    return res.status(429).json({
                        error: '2 saat içinde en fazla 2 randevu alabilirsiniz. Lütfen daha sonra tekrar deneyin.'
                    });
                }
                data.count++;
            } else {
                // Reset window
                rateLimitStore.set(clientIP, { count: 1, firstRequest: now });
            }
        } else {
            rateLimitStore.set(clientIP, { count: 1, firstRequest: now });
        }

        // 1. Validate Input
        const { error, value } = createSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // 2. Call Service
        const appointment = await appointmentService.createAppointment({
            ...value,
            createdFrom: 'web'
        });

        res.status(201).json(appointment);
    } catch (error) {
        if (error.message.includes('dolu') || error.message.includes('Geçmiş')) {
            return res.status(409).json({ error: error.message });
        }
        next(error);
    }
};

const getMy = async (req, res, next) => {
    try {
        const { phone } = req.query;
        if (!phone) {
            return res.status(400).json({ error: 'Phone parameter is required' });
        }

        // Sanitize phone - only digits
        const sanitizedPhone = phone.replace(/\D/g, '');

        const appointment = await appointmentService.getMyAppointment(sanitizedPhone);
        if (!appointment) {
            return res.status(404).json({ message: 'Aktif randevu bulunamadı.' });
        }
        res.json(appointment);
    } catch (error) {
        next(error);
    }
};

const cancel = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ObjectId format
        if (!/^[0-9a-fA-F]{24}$/.test(id)) {
            return res.status(400).json({ error: 'Geçersiz randevu ID' });
        }

        await appointmentService.cancelAppointment(id);
        res.json({ message: 'Randevu iptal edildi.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAvailable,
    create,
    getMy,
    cancel,
    getServices
};
