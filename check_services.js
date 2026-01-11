require('dotenv').config();
const mongoose = require('mongoose');
const Service = require('./src/models/service.model');

const checkServices = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { family: 4 });
        console.log('Connected to DB');

        const services = await Service.find({});
        console.log('Total Services:', services.length);
        console.log('Active Services:', services.filter(s => s.isActive).length);
        console.log('Services:', JSON.stringify(services, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkServices();
