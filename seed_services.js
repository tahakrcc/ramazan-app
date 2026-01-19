require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('./src/models/service.model');

const seedServices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const services = [
            { id: 'sac', name: 'Saç Kesimi', price: 500, duration: 45 },
            { id: 'sakal', name: 'Sakal Tıraşı', price: 300, duration: 30 },
            { id: 'sac_sakal', name: 'Komple Bakım', price: 600, duration: 75 }
        ];

        for (const s of services) {
            const exists = await Service.findOne({ id: s.id });
            if (!exists) {
                await Service.create(s);
                console.log(`Created: ${s.name}`);
            } else {
                // Update price if exists
                await Service.findOneAndUpdate({ id: s.id }, s);
                console.log(`Updated: ${s.name}`);
            }
        }

        console.log('Services seeded successfully');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedServices();
