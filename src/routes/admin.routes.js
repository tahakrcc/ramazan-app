const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect } = require('../middlewares/auth.middleware');
const { loginLimiter } = require('../middlewares/rateLimiter');
const appointmentService = require('../services/appointment.service');
const ClosedDate = require('../models/closedDate.model');
const Service = require('../models/service.model');
const Appointment = require('../models/appointment.model');
const logger = require('../config/logger');

// Public Admin Route
router.post('/secure-login-action', loginLimiter, adminController.login);

// Protected Admin Routes
router.use(protect);

// =============== APPOINTMENTS ===============
router.get('/appointments', adminController.getAppointments);
router.post('/appointments', adminController.createAppointment);
router.put('/appointments/:id', adminController.updateAppointment);

// Delete appointment
router.delete('/appointments/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await appointmentService.cancelAppointment(id);
        logger.info(`Admin cancelled appointment: ${id}`);
        res.json({ message: 'Randevu iptal edildi.' });
    } catch (error) {
        next(error);
    }
});

// Update appointment notes
router.patch('/appointments/:id/notes', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const apt = await Appointment.findByIdAndUpdate(id, { notes }, { new: true });
        res.json(apt);
    } catch (error) {
        next(error);
    }
});

// Search appointments
router.get('/appointments/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const appointments = await Appointment.find({
            $or: [
                { customerName: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ]
        }).sort({ date: -1, hour: -1 }).limit(50);

        res.json(appointments);
    } catch (error) {
        next(error);
    }
});

// =============== CLOSED DATES ===============
router.get('/closed-dates', async (req, res, next) => {
    try {
        const dates = await ClosedDate.find().sort({ date: 1 });
        res.json(dates);
    } catch (error) {
        next(error);
    }
});

router.post('/closed-dates', async (req, res, next) => {
    try {
        const { date, reason } = req.body;
        const closedDate = await ClosedDate.create({ date, reason: reason || 'Tatil' });
        logger.info(`Admin closed date: ${date}`);
        res.status(201).json(closedDate);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Bu tarih zaten kapalı.' });
        }
        next(error);
    }
});

router.delete('/closed-dates/:id', async (req, res, next) => {
    try {
        await ClosedDate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Kapalı gün silindi.' });
    } catch (error) {
        next(error);
    }
});

// =============== SERVICES ===============
router.get('/services', async (req, res, next) => {
    try {
        const services = await Service.find().sort({ name: 1 });
        res.json(services);
    } catch (error) {
        next(error);
    }
});

router.post('/services', async (req, res, next) => {
    try {
        const { id, name, price, duration } = req.body;
        const service = await Service.create({ id, name, price, duration: duration || 60 });
        logger.info(`Admin created service: ${name}`);
        res.status(201).json(service);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Bu hizmet ID zaten mevcut.' });
        }
        next(error);
    }
});

router.put('/services/:id', async (req, res, next) => {
    try {
        const { name, price, duration, isActive } = req.body;
        const service = await Service.findByIdAndUpdate(
            req.params.id,
            { name, price, duration, isActive },
            { new: true }
        );
        res.json(service);
    } catch (error) {
        next(error);
    }
});

router.delete('/services/:id', async (req, res, next) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ message: 'Hizmet silindi.' });
    } catch (error) {
        next(error);
    }
});

// =============== STATISTICS ===============
router.get('/stats', async (req, res, next) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Get all confirmed appointments
        const allAppointments = await Appointment.find({ status: 'confirmed' });

        // Get services for price lookup
        const services = await Service.find();
        const priceMap = {};
        services.forEach(s => { priceMap[s.id] = s.price; });

        // Default prices if not in DB
        const defaultPrices = { sac: 500, sakal: 300, sac_sakal: 600 };

        const getPrice = (serviceId) => priceMap[serviceId] || defaultPrices[serviceId] || 0;

        // Calculate stats
        const todayAppointments = allAppointments.filter(a => a.date === today);
        const weekAppointments = allAppointments.filter(a => a.date >= weekAgo);
        const monthAppointments = allAppointments.filter(a => a.date >= monthAgo);

        const todayRevenue = todayAppointments.reduce((sum, a) => sum + getPrice(a.service), 0);
        const weekRevenue = weekAppointments.reduce((sum, a) => sum + getPrice(a.service), 0);
        const monthRevenue = monthAppointments.reduce((sum, a) => sum + getPrice(a.service), 0);

        // Most popular service
        const serviceCounts = {};
        allAppointments.forEach(a => {
            serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1;
        });
        const popularService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0];

        // Busiest hours
        const hourCounts = {};
        allAppointments.forEach(a => {
            hourCounts[a.hour] = (hourCounts[a.hour] || 0) + 1;
        });
        const busiestHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

        res.json({
            appointments: {
                today: todayAppointments.length,
                week: weekAppointments.length,
                month: monthAppointments.length,
                total: allAppointments.length
            },
            revenue: {
                today: todayRevenue,
                week: weekRevenue,
                month: monthRevenue
            },
            popularService: popularService ? { name: popularService[0], count: popularService[1] } : null,
            busiestHours: busiestHours.map(([hour, count]) => ({ hour, count }))
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
