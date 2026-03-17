const Appointment = require('../models/appointment.model');
const Settings = require('../models/settings.model');
const ClosedDate = require('../models/closedDate.model');
const logger = require('../config/logger');
const dateUtils = require('../utils/date');

// Helper to get business hours (cached or fresh)
const getBusinessHours = async () => {
    const settings = await Settings.getSettings();
    return {
        start: settings.appointmentStartHour || 8,
        end: settings.appointmentEndHour || 21
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
        return [];
    }

    // 2. Check if day of week is closed
    const settings = await Settings.getSettings();
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    if (settings.closedWeekDays && settings.closedWeekDays.includes(dayOfWeek)) {
        return [];
    }

    // 3. Get Settings
    const { start, end } = await getBusinessHours();
    const allSlots = generateSlots(start, end);

    const query = {
        date: date,
        status: 'confirmed'
    };

    if (barberId) {
        query.$or = [
            { barberId: barberId },
            { barberId: null },
            { barberId: { $exists: false } }
        ];
    }

    const bookedAppointments = await Appointment.find(query).select('hour');
    const bookedHours = bookedAppointments.map(app => app.hour);

    let availableSlots = allSlots.filter(slot => !bookedHours.includes(slot));

    // Filter out past hours if date is today (Turkey Time)
    const todayStr = dateUtils.getTurkeyTodayString();

    if (date === todayStr) {
        const currentHour = dateUtils.getTurkeyHour();
        // Allow booking only for future hours
        availableSlots = availableSlots.filter(slot => {
            const [h] = slot.split(':').map(Number);
            return h > currentHour;
        });
    } else if (date < todayStr) {
        // No slots for past days
        return [];
    }

    return availableSlots;
};

/**
 * Create a new appointment
 */
const createAppointment = async (data) => {
    const todayStr = dateUtils.getTurkeyTodayString();
    const currentHour = dateUtils.getTurkeyHour();

    // Past date check
    if (data.date < todayStr) {
        throw new Error('Geçmiş tarihe randevu alınamaz.');
    }
    
    // Today but past hour check
    if (data.date === todayStr) {
        const [h] = data.hour.split(':').map(Number);
        if (h <= currentHour) {
            throw new Error('Geçmiş saate randevu alınamaz.');
        }
    }

    // Check Closed Date
    const isClosed = await ClosedDate.findOne({ date: data.date });
    if (isClosed) {
        throw new Error(`Seçilen tarih (${data.date}) işletmemiz kapalıdır: ${isClosed.reason}`);
    }

    // Check Weekday
    const settings = await Settings.getSettings();
    const closedWeekDays = settings.closedWeekDays || [];
    const dateObj = new Date(data.date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    if (closedWeekDays.includes(dayOfWeek)) {
        const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        throw new Error(`${dayNames[dayOfWeek]} günleri açık değiliz.`);
    }

    // Conflict Query
    const conflictQuery = {
        date: data.date,
        hour: data.hour,
        status: 'confirmed'
    };
    if (data.barberId) {
        conflictQuery.$or = [
            { barberId: data.barberId },
            { barberId: null },
            { barberId: { $exists: false } }
        ];
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
            barberId: data.barberId,
            barberName: data.barberName
        });

        const savedAppointment = await appointment.save();
        logger.info(`Appointment created: ${savedAppointment._id} for ${data.phone} (Barber: ${data.barberName})`);

        // Send WhatsApp Notification (Async)
        try {
            const whatsappService = require('./whatsapp.service');
            let message = `Sayın ${data.customerName},\n${data.date} tarihinde saat ${data.hour} için randevunuz oluşturulmuştur.\n`;
            if (data.barberName) message += `Berber: ${data.barberName}\n`;
            message += `Bizi tercih ettiğiniz için teşekkür ederiz.`;
            whatsappService.sendMessage(data.phone, message).catch(e => logger.error('WA Send fail', e));
        } catch (waError) {}

        return savedAppointment;

    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Bu saat maalesef dolu. Lütfen başka bir saat seçin.');
        }
        throw error;
    }
};

/**
 * Get active appointment for a phone number
 */
const getMyAppointment = async (phone) => {
    const todayStr = dateUtils.getTurkeyTodayString();

    const appointment = await Appointment.findOne({
        phone: phone,
        status: 'confirmed',
        date: { $gte: todayStr }
    }).sort({ date: 1, hour: 1 });

    return appointment;
};

/**
 * Cancel an appointment
 */
const cancelAppointment = async (id, phone) => {
    const appointment = await Appointment.findById(id);
    if (!appointment) {
        throw new Error('Randevu bulunamadı.');
    }

    // Security Check: If phone is provided (public cancel), it must match
    if (phone && appointment.phone !== phone) {
        throw new Error('Bu randevuyu iptal etme yetkiniz bulunmamaktadır.');
    }

    appointment.status = 'cancelled';
    await appointment.save();
    logger.info(`Appointment cancelled: ${id} (Verified Phone: ${phone || 'Admin Override'})`);
    return appointment;
};

const getCustomerHistory = async (phone) => {
    const appointments = await Appointment.find({
        phone: phone
    }).sort({ date: -1, hour: -1 }).limit(10);
    return appointments;
};

const deleteAppointment = async (id) => {
    const result = await Appointment.findByIdAndDelete(id);
    if (!result) {
        throw new Error('Randevu bulunamadı.');
    }
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
    const sevenDaysAgo = dateUtils.getTurkeyNow();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const year = sevenDaysAgo.getFullYear();
    const month = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
    const day = String(sevenDaysAgo.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

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
    deleteAppointment,
    getCustomerHistory,
    getDailyAppointments,
    cleanupOldAppointments
};
