require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./src/models/admin.model');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const username = 'admin';
        const password = 'password123'; // Change this!

        const exists = await Admin.findOne({ username });
        if (exists) {
            console.log('Admin already exists');
            process.exit();
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await Admin.create({
            username,
            passwordHash,
            role: 'ADMIN'
        });

        console.log('Admin user created');
        console.log('Username: admin');
        console.log('Password: password123');
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedAdmin();
