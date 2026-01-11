require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('./src/models/service.model');

const services = [
    { id: 'sac', name: 'Saç Kesimi', price: 500, duration: 30, isActive: true },
    { id: 'sakal', name: 'Sakal Tıraşı', price: 300, duration: 15, isActive: true },
    { id: 'sac_sakal', name: 'Komple Bakım', price: 600, duration: 45, isActive: true }
];

const seedServices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('MongoDB Connected');

        await Service.deleteMany({});
        console.log('Cleared existing services');

        await Service.insertMany(services);
        console.log('Services seeded successfully');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding services:', error);
        process.exit(1);
    }
};

seedServices();
