require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/admin.model');
const connectDB = require('./config/db');

const checkUsers = async () => {
    try {
        await connectDB();

        console.log('Fetching users...');
        const admins = await Admin.find({});

        if (admins.length === 0) {
            console.log('NO ADMINS FOUND IN DATABASE. Please run createAdmin.js again.');
        } else {
            console.log('Found Admins:');
            admins.forEach(admin => {
                console.log(`- Username: '${admin.username}' (ID: ${admin._id})`);
                // Note: We cannot decrypt the password, but we can verify it exists
                console.log(`  Password Hash: ${admin.password ? 'Exists' : 'MISSING'}`);
            });
        }
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkUsers();
