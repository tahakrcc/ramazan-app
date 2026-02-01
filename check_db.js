const mongoose = require('mongoose');
const Appointment = require('./src/models/appointment.model');
require('dotenv').config();

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const date = '2026-02-05';

        console.log(`Checking appointments for ${date}...`);

        const all = await Appointment.find({ date });
        console.log(`Found ${all.length} appointments total.`);

        all.forEach(app => {
            console.log(`ID: ${app._id}, Hour: '${app.hour}', BarberId: '${app.barberId}' (${typeof app.barberId}), Status: '${app.status}'`);
        });

        // Test queries
        const confirmed = await Appointment.find({ date, status: 'confirmed' });
        console.log(`Confirmed: ${confirmed.length}`);

        if (all.length > 0 && all[0].barberId) {
            const bid = all[0].barberId.toString();
            console.log(`Testing query with barberId string: ${bid}`);
            const byBarber = await Appointment.find({ date, status: 'confirmed', barberId: bid });
            console.log(`Found by barberId string: ${byBarber.length}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

check();
