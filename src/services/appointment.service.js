const Appointment = require('../models/appointment.model');
const Settings = require('../models/settings.model');
const ClosedDate = require('../models/closedDate.model');
const logger = require('../config/logger');

// Helper to get business hours (cached or fresh)
const getBusinessHours = async () => {
    const settings = await Settings.getSettings();
    return {
        start: settings.appointmentStartHour || 8,
        end: settings.appointmentEndHour || 21
        // Note: end is exclusive in loop usually, or inclusive? 
        // Original code: i < END_HOUR. If END=21, last slot is 20:00. Settings usually imply "Closing Time".
    };
};

const generateSlots = (start, end) => {
    const slots = [];
    for (let i = start; i < end; i++) {
        const hourString = `${i.toString().padStart(2, '0')}:00`;
        slots.push(hourString);
    }
    return slots;
};

/**
 * Get available slots for a given date
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<string[]>}
 */
const getAvailableSlots = async (date, barberId) => {
    // 1. Check if Closed Date
    const isClosed = await ClosedDate.findOne({ date });
    if (isClosed) {
        return []; // No slots available on holidays
    }

    // 2. Get Settings
    const { start, end } = await getBusinessHours();
    const allSlots = generateSlots(start, end);

    // Build query
    const query = {
        date: date,
        status: 'confirmed'
    };

    // If a specific barber is selected, check ONLY their schedule
    if (barberId) {
        query.barberId = barberId;
    }
    // If no barber selected (Legacy), we check ALL appointments to be safe
    // Or we could say "Any barber free?" but for now let's keep conservative.

    const bookedAppointments = await Appointment.find(query).select('hour');

    const bookedHours = bookedAppointments.map(app => app.hour);
    const availableSlots = allSlots.filter(slot => !bookedHours.includes(slot));

    return availableSlots;
};

/**
 * Create a new appointment
 * @param {Object} data - { customerName, phone, date, hour, service, createdFrom, barberId, barberName }
 * @returns {Promise<Object>}
 */
const createAppointment = async (data) => {
    const appointmentDateTime = new Date(`${data.date}T${data.hour}`);
    if (appointmentDateTime < new Date()) {
        throw new Error('Geçmiş zamana randevu alınamaz.');
    }

    // Check Closed Date
    const isClosed = await ClosedDate.findOne({ date: data.date });
    if (isClosed) {
        throw new Error(`Seçilen tarih (${data.date}) işletmemiz kapalıdır: ${isClosed.reason}`);
    }

    // Manual Conflict Check (Multi-Barber Support)
    // We cannot rely solely on unique index anymore because multiple barbers can have same slot
    const conflictQuery = {
        date: data.date,
        hour: data.hour,
        status: 'confirmed'
    };
    if (data.barberId) {
        conflictQuery.barberId = data.barberId;
    } else {
        // Legacy: If no barber specified, global lock? 
        // Or assume it's for the "default" admin?
        // Let's assume conflict if ANYone is booked to be safe, or allow if we want overlapping.
        // For safety, if no barberId, we assume single-resource mode.
    }

    const existing = await Appointment.findOne(conflictQuery);
    if (existing) {
        throw new Error('Bu saat maalesef dolu. Lütfen başka bir saat seçin.');
    }

    try {
        const appointment = new Appointment({
            customerName: data.customerName,
            phone: data.phone,
            date: data.date,
            hour: data.hour,
            service: data.service || 'sac',
            createdFrom: data.createdFrom,
            status: 'confirmed',
            barberId: data.barberId,      // New Field
            barberName: data.barberName   // New Field
        });

        const savedAppointment = await appointment.save();
        logger.info(`Appointment created: ${savedAppointment._id} for ${data.phone} (Barber: ${data.barberName})`);

        // Send WhatsApp Notification
        try {
            const whatsappService = require('./whatsapp.service');
            let message = `Sayın ${data.customerName},\n${data.date} tarihinde saat ${data.hour} için randevunuz oluşturulmuştur.\n`;
            if (data.barberName) message += `Berber: ${data.barberName}\n`;
            message += `Bizi tercih ettiğiniz için teşekkür ederiz.`;

            // Use clean phone, let service handle formatting
            await whatsappService.sendMessage(data.phone, message);
        } catch (waError) {
            logger.error('WhatsApp notification failed', waError);
        }

        return savedAppointment;

    } catch (error) {
        if (error.code === 11000) {
            // Fallback for race condition
            throw new Error('Bu saat maalesef dolu. Lütfen başka bir saat seçin.');
        }
        throw error;
    }
};

/**
 * Get active appointment for a phone number
 * @param {string} phone 
 */
const getMyAppointment = async (phone) => {
    const today = new Date().toISOString().split('T')[0];

    const appointment = await Appointment.findOne({
        phone: phone,
        status: 'confirmed',
        date: { $gte: today }
    }).sort({ date: 1, hour: 1 });

    return appointment;
};

/**
 * Cancel an appointment
 * @param {string} id 
 */
const cancelAppointment = async (id) => {
    const appointment = await Appointment.findById(id);
    if (!appointment) {
        throw new Error('Randevu bulunamadı.');
    }

    appointment.status = 'cancelled';
    await appointment.save();
    logger.info(`Appointment cancelled: ${id}`);
    return appointment;
};

/**
 * Get customer appointment history
 * @param {string} phone 
 */
const getCustomerHistory = async (phone) => {
    const appointments = await Appointment.find({
        phone: phone
    }).sort({ date: -1, hour: -1 }).limit(10);

    return appointments;
};

const deleteAppointment = async (id) => {
    const result = await Appointment.findByIdAndDelete(id);
    if (!result) {
        throw new Error('Randevu bulunamadı veya zaten silinmiş.');
    }
    logger.info(`Appointment deleted permanently: ${id}`);
    return result;
};

const getDailyAppointments = async (date) => {
    const appointments = await Appointment.find({
        date: date,
        status: 'confirmed'
    }).sort({ hour: 1 });
    return appointments;
};

const cleanupOldAppointments = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString().split('T')[0];

    // Delete appointments older than 7 days
    const result = await Appointment.deleteMany({
        date: { $lt: dateStr }
    });

    if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old appointments.`);
    }
    return result;
};

module.exports = {
    getAvailableSlots,
    createAppointment,
    getMyAppointment,
    cancelAppointment,
    getCustomerHistory,
    getDailyAppointments,
    cleanupOldAppointments
};
