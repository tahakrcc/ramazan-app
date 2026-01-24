const mongoose = require('mongoose');
require('dotenv').config();

// Use environment variable or fallback to the one seen in logs
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://tahakrcc:Taha.123@cluster0.k2ibf6q.mongodb.net/ramazan-app?retryWrites=true&w=majority';

const clearSession = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('Connected.');

        console.log('Clearing authstates collection...');
        const result = await mongoose.connection.db.collection('authstates').deleteMany({});
        console.log(`Deleted ${result.deletedCount} session documents.`);

        console.log('Session cleared successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing session:', error);
        process.exit(1);
    }
};

clearSession();
