require('dotenv').config();
const mongoose = require('mongoose');
const Appointment = require('../src/models/appointment.model');
const Feedback = require('../src/models/feedback.model');
const BotState = require('../src/models/botState.model');
const logger = require('../src/config/logger');

const cleanup = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        console.log('Cleaning up test data...');

        const deletedAppointments = await Appointment.deleteMany({});
        console.log(`Deleted ${deletedAppointments.deletedCount} appointments.`);

        const deletedFeedbacks = await Feedback.deleteMany({});
        console.log(`Deleted ${deletedFeedbacks.deletedCount} feedbacks.`);

        const deletedBotStates = await BotState.deleteMany({});
        console.log(`Deleted ${deletedBotStates.deletedCount} bot states.`);

        // Optional: Clear Auth State if hard reset requested, but user wanted persistence.
        // We will KEEP AuthState (WhatsApp session) so they don't have to scan QR again.

        console.log('Cleanup complete. Core data (Admin, Services, Settings) preserved.');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
};

cleanup();
