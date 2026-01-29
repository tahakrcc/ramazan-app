const Admin = require('../models/admin.model');
const Appointment = require('../models/appointment.model');
const appointmentService = require('../services/appointment.service'); // Added import
const broadcastService = require('../services/broadcast.service'); // Added import
const whatsappService = require('../services/whatsapp.service'); // Added import
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const logger = require('../config/logger');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, {
        expiresIn: '12h',
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
                role: admin.role, // Added role
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
        // Trigger cleanup (fire & forget)
        appointmentService.cleanupOldAppointments().catch(err => logger.error('Cleanup failed', err));

        const { date, startDate, endDate, view, barberId } = req.query;
        let query = {};

        const today = new Date().toISOString().split('T')[0];

        if (view === 'archive') {
            // Archive: Cancelled OR Past dates
            query = {
                $or: [
                    { status: 'cancelled' },
                    { date: { $lt: today } }
                ]
            };
        } else {
            // Active: NOT cancelled
            query = { status: { $ne: 'cancelled' } };

            if (startDate && endDate) {
                // Calendar View or specific range
                query.date = { $gte: startDate, $lte: endDate };
            } else if (date) {
                // Specific date
                query.date = date;
            } else {
                // Default List View: Today onwards
                query.date = { $gte: today };
            }
        }

        // Filter by Barber if requested OR if user is a BARBER
        if (req.user.role === 'BARBER') {
            query.barberId = req.user.id;
        } else if (barberId) {
            query.barberId = barberId;
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
        const { customerName, phone, date, hour, service, notes } = req.body;
        let { barberId, barberName } = req.body;

        // Enforce Barber Ownership
        if (req.user.role === 'BARBER') {
            barberId = req.user.id;
            barberName = req.user.name || 'Berber';
        }

        const appointment = new Appointment({
            customerName,
            phone,
            date,
            hour,
            service: service || 'Admin Created',
            notes: notes || '',
            createdFrom: 'admin',
            status: 'confirmed',
            barberId,
            barberName
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
}



const sendBroadcast = async (req, res, next) => {
    try {
        const { message, filter } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        let phones = [];
        const today = new Date().toISOString().split('T')[0];

        if (filter === 'active') {
            // Get unique phones from confirmed future appointments
            const result = await Appointment.find({
                status: 'confirmed',
                date: { $gte: today }
            }).distinct('phone');
            phones = result;
        } else {
            // Get all unique phones from history
            const result = await Appointment.find().distinct('phone');
            phones = result;
        }

        // Filter valid phones (simple check)
        phones = phones.filter(p => p && p.length >= 10);

        logger.info(`Starting broadcast to ${phones.length} recipients. Filter: ${filter}`);

        // Async processing (don't wait for all to finish for response)
        // Batched sending to avoid overload
        (async () => {
            let successCount = 0;
            for (const phone of phones) {
                try {
                    await whatsappService.sendMessage(phone, message);
                    successCount++;
                    // Tiny delay to be safe
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    logger.error(`Broadcast fail to ${phone}: ${e.message}`);
                }
            }
            logger.info(`Broadcast completed. Sent: ${successCount}/${phones.length}`);
        })();

        res.json({ success: true, recipientCount: phones.length, message: 'Gönderim sıraya alındı.' });

    } catch (error) {
        next(error);
    }
};

// WhatsApp Yönetimi
const getWhatsAppStatus = async (req, res) => {
    try {
        const status = await whatsappService.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const pairWhatsApp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: 'Telefon numarası gerekli' });
        }
        const code = await whatsappService.requestPairing(phone);
        res.json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({ message: 'Eşleştirme kodu alınamadı', error: error.message });
    }
};

const disconnectWhatsApp = async (req, res) => {
    try {
        const success = await whatsappService.logout();
        if (success) {
            res.json({ success: true, message: 'Bağlantı kesildi' });
        } else {
            res.status(500).json({ success: false, message: 'Bağlantı kesilemedi' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    login,
    getAppointments,
    createAppointment,
    updateAppointment,
    sendBroadcast,
    getWhatsAppStatus,
    pairWhatsApp,
    disconnectWhatsApp
};
