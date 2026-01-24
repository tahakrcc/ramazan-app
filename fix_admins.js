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

        const allAdmins = await Admin.find({});
        console.log('Current Admins:', allAdmins.map(a => ({ id: a._id, u: a.username, n: a.name, r: a.role })));

        // Explicitly set the name for the main admin user
        const ramazanUpdate = await Admin.updateOne(
            { username: 'admin' },
            { $set: { name: 'Ramazan', role: 'ADMIN' } }
        );
        console.log(`Updated main admin name to Ramazan: ${ramazanUpdate.modifiedCount}`);

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

fixAdmins();
