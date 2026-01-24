require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./src/models/admin.model');

const fixAdmins = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const result = await Admin.updateMany(
            { isActive: { $exists: false } },
            { $set: { isActive: true } }
        );

        console.log(`Updated ${result.modifiedCount} admins.`);

        // Also force update all just in case
        // await Admin.updateMany({}, { $set: { isActive: true } });

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

fixAdmins();
