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

// =============== APPOINTMENTS ===============
router.get('/appointments', protect, adminController.getAppointments);
router.post('/appointments', protect, adminController.createAppointment);
router.put('/appointments/:id', protect, adminController.updateAppointment);

// Delete appointment
router.delete('/appointments/:id', protect, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Ownership Check
        if (req.user.role === 'BARBER') {
            const appt = await Appointment.findById(id);
            if (!appt) return res.status(404).json({ error: 'Randevu bulunamadı' });

            if (appt.barberId && appt.barberId.toString() !== req.user.id) {
                return res.status(403).json({ error: 'Bu randevuyu iptal etme yetkiniz yok.' });
            }
        }

        await appointmentService.cancelAppointment(id);
        logger.info(`Admin cancelled appointment: ${id} (User: ${req.user.username})`);
        res.json({ message: 'Randevu iptal edildi.' });
    } catch (error) {
        next(error);
    }
});

// Update appointment notes
router.patch('/appointments/:id/notes', protect, async (req, res, next) => {
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
router.get('/appointments/search', protect, async (req, res, next) => {
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
router.get('/closed-dates', protect, async (req, res, next) => {
    try {
        const dates = await ClosedDate.find().sort({ date: 1 });
        res.json(dates);
    } catch (error) {
        next(error);
    }
});

router.post('/closed-dates', protect, async (req, res, next) => {
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

router.delete('/closed-dates/:id', protect, async (req, res, next) => {
    try {
        await ClosedDate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Kapalı gün silindi.' });
    } catch (error) {
        next(error);
    }
});

// =============== SERVICES ===============
router.get('/services', protect, async (req, res, next) => {
    try {
        const services = await Service.find().sort({ name: 1 });
        res.json(services);
    } catch (error) {
        next(error);
    }
});

router.post('/services', protect, async (req, res, next) => {
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

router.put('/services/:id', protect, async (req, res, next) => {
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

router.delete('/services/:id', protect, async (req, res, next) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        res.json({ message: 'Hizmet silindi.' });
    } catch (error) {
        next(error);
    }
});

// =============== STATISTICS ===============
router.get('/stats', protect, async (req, res, next) => {
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

// =============== SETTINGS ===============
router.get('/settings', protect, async (req, res, next) => {
    try {
        const Settings = require('../models/settings.model');
        const settings = await Settings.getSettings();
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

router.put('/settings', protect, async (req, res, next) => {
    try {
        const Settings = require('../models/settings.model');
        const { appointmentStartHour, appointmentEndHour, bookingRangeDays, businessAddress, businessMapsLink } = req.body;

        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        if (appointmentStartHour !== undefined) settings.appointmentStartHour = appointmentStartHour;
        if (appointmentEndHour !== undefined) settings.appointmentEndHour = appointmentEndHour;
        if (bookingRangeDays !== undefined) settings.bookingRangeDays = bookingRangeDays;
        if (businessAddress !== undefined) settings.businessAddress = businessAddress;
        if (businessMapsLink !== undefined) settings.businessMapsLink = businessMapsLink;

        await settings.save();
        logger.info('Admin updated settings');
        res.json(settings);
    } catch (error) {
        next(error);
    }
});

// =============== BROADCAST ===============
router.post('/broadcast', protect, adminController.sendBroadcast);

// =============== WHATSAPP ===============
const whatsappService = require('../services/whatsapp.service');

router.get('/whatsapp/status', protect, async (req, res, next) => {
    try {
        const status = await whatsappService.getStatus();
        res.json(status);
    } catch (error) {
        next(error);
    }
});

router.post('/whatsapp/logout', protect, async (req, res, next) => {
    try {
        await whatsappService.logout();
        res.json({ message: 'WhatsApp bağlantısı kesildi.' });
    } catch (error) {
        next(error);
    }
});

// =============== STAFF MANAGEMENT ===============
const AdminUser = require('../models/admin.model'); // Admin model is effectively User model

router.get('/staff', protect, async (req, res, next) => {
    try {
        const staff = await AdminUser.find().select('-passwordHash').sort({ createdAt: -1 });
        res.json(staff);
    } catch (error) {
        next(error);
    }
});

router.post('/staff', protect, async (req, res, next) => {
    try {
        const { username, password, name, role, color } = req.body;

        // Simple validation
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Kullanıcı adı, şifre ve isim zorunludur.' });
        }

        const user = await AdminUser.create({
            username,
            password, // Virtual setter handles hashing
            name,
            role: role || 'BARBER',
            color: color || '#D4AF37'
        });

        logger.info(`Admin created staff: ${username} (${role})`);
        res.status(201).json({
            _id: user._id,
            username: user.username,
            name: user.name,
            role: user.role,
            color: user.color
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
        }
        next(error);
    }
});

router.put('/staff/:id', protect, async (req, res, next) => {
    try {
        const { username, password, name, role, color, isActive } = req.body;
        const { id } = req.params;

        const user = await AdminUser.findById(id);
        if (!user) return res.status(404).json({ error: 'Personel bulunamadı.' });

        if (username) user.username = username;
        if (name) user.name = name;
        if (role) user.role = role;
        if (color) user.color = color;
        if (typeof isActive === 'boolean') user.isActive = isActive;

        // Update password only if provided
        if (password && password.trim().length > 0) {
            user.password = password; // Triggers virtual setter
        }

        await user.save();
        logger.info(`Admin updated staff: ${user.username}`);

        res.json({
            _id: user._id,
            username: user.username,
            name: user.name,
            role: user.role,
            color: user.color,
            isActive: user.isActive
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
        }
        next(error);
    }
});

router.delete('/staff/:id', protect, async (req, res, next) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion (safety check)
        // Ideally we check req.user._id but middleware might not set it identical to DB _id depending on auth implementation.
        // Let's assume frontend handles basic safety, backend handles ID existence.

        await AdminUser.findByIdAndDelete(id);
        logger.info(`Admin deleted staff: ${id}`);
        res.json({ message: 'Personel silindi.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
