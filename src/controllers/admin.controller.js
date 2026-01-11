const Admin = require('../models/admin.model');
const Appointment = require('../models/appointment.model');
const broadcastService = require('../services/broadcast.service'); // Added import
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        // Find admin
        const admin = await Admin.findOne({ username });

        // Check password
        if (admin && (await admin.comparePassword(password))) {
            logger.info(`Admin logged in: ${username}`);
            res.json({
                _id: admin._id,
                username: admin.username,
                token: generateToken(admin._id, admin.role),
            });
        } else {
            // Log failed attempt (Security Audit)
            logger.warn(`Failed admin login attempt for username: ${username}`);
            res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }
    } catch (error) {
        next(error);
    }
};

const getAppointments = async (req, res, next) => {
    try {
        const { date, startDate, endDate } = req.query;
        // Only show confirmed appointments (not cancelled)
        const query = { status: 'confirmed' };
        if (date) {
            query.date = date;
        } else if (startDate && endDate) {
            query.date = { $gte: startDate, $lte: endDate };
        }

        const appointments = await Appointment.find(query).sort({ date: 1, hour: 1 });
        res.json(appointments);
    } catch (error) {
        next(error);
    }
};

const createAppointment = async (req, res, next) => {
    try {
        // Admin can force create? Maybe still respect unique constraint to avoid double booking
        // Or maybe admin creation has looser validation (e.g. past dates?)
        // For now, let's reuse standard logic but allow specifying fields
        const { customerName, phone, date, hour } = req.body;

        const appointment = new Appointment({
            customerName,
            phone,
            date,
            hour,
            service: 'Admin Created',
            createdFrom: 'admin',
            status: 'confirmed'
        });

        const savedCallback = await appointment.save();
        // Log sensitive action
        logger.info(`Admin created appointment: ${savedCallback._id}`);

        res.status(201).json(savedCallback);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Bu saat dolu.' });
        }
        next(error);
    }
};

const updateAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const appointment = await Appointment.findByIdAndUpdate(id, updates, { new: true });
        logger.info(`Admin updated appointment: ${id}`);
        res.json(appointment);
    } catch (error) {
        next(error);
    }
    updateAppointment
};

const sendBroadcast = async (req, res) => {
    try {
        const { message, filter } = req.body;
        if (!message) return res.status(400).json({ error: 'Mesaj içeriği gereklidir' });

        // Run in background
        broadcastService.sendBroadcast(message, filter);

        res.json({ message: 'Toplu mesaj işlemi başlatıldı. Arka planda gönderiliyor.' });
    } catch (error) {
        res.status(500).json({ error: 'Broadcast error' });
    }
};

module.exports = {
    login,
    getAppointments,
    createAppointment,
    updateAppointment,
    sendBroadcast // Added export
};
