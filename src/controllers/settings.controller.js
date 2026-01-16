const Settings = require('../models/settings.model');
const Service = require('../models/service.model');

// Ayarları getir (yoksa varsayılan oluştur)
const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        const services = await Service.find({ isActive: true });

        res.json({
            ...settings.toObject(),
            services
        });
    } catch (error) {
        next(error);
    }
};

// Ayarları güncelle (sadece admin)
const updateSettings = async (req, res, next) => {
    try {
        const { appointmentStartHour, appointmentEndHour, bookingRangeDays } = req.body;

        // Basit validasyonlar
        if (appointmentStartHour >= appointmentEndHour) {
            return res.status(400).json({ error: 'Başlangıç saati bitiş saatinden küçük olmalıdır.' });
        }

        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({});
        }

        settings.appointmentStartHour = appointmentStartHour;
        settings.appointmentEndHour = appointmentEndHour;
        settings.bookingRangeDays = bookingRangeDays;
        settings.businessAddress = req.body.businessAddress;
        settings.businessMapsLink = req.body.businessMapsLink;

        await settings.save();
        res.json(settings);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getSettings,
    updateSettings
};
