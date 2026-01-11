require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/admin.model');
const connectDB = require('./config/db');

const createAdmin = async () => {
    try {
        await connectDB();

        const username = 'admin';
        const password = 'admin123';

        // Check if admin exists
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            console.log('Admin user already exists.');
            // Update password just in case
            existingAdmin.password = password;
            await existingAdmin.save();
            console.log('Admin password reset to: admin123');
        } else {
            const newAdmin = new Admin({
                username,
                password
            });
            await newAdmin.save();
            console.log('Admin user created successfully.');
        }

        console.log('Username:', username);
        console.log('Password:', password);

        process.exit();
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
