const mongoose = require('mongoose');

const connectDB = async (retries = 10) => {
    while (retries > 0) {
        try {
            const conn = await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 30000, // Increased to 30s
                socketTimeoutMS: 45000,
                family: 4 // Force IPv4
            });

            console.log(`MongoDB Connected: ${conn.connection.host}`);

            mongoose.connection.on('error', err => {
                console.error('MongoDB connection error:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('MongoDB disconnected');
            });

            return;

        } catch (error) {
            console.warn(`⚠️ Veritabanı bağlantısı kurulamadı. Tekrar deneniyor... (Kalan deneme: ${retries - 1})`);
            console.warn(`   Hata Detayı: ${error.message}`);
            retries -= 1;
            if (retries === 0) {
                console.error('CRITICAL: Could not connect to MongoDB after multiple attempts.');
                console.error('SUGGESTION: Check your internet connection or try changing your DNS to 8.8.8.8 (Google DNS).');
                process.exit(1);
            }
            // Wait 5 seconds before next retry
            await new Promise(res => setTimeout(res, 5000));
        }
    }
};

module.exports = connectDB;
