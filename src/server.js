require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const whatsappService = require('./services/whatsapp.service');
const logger = require('./config/logger');

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB().then(() => {
    // Start Server
    // Start Server
    server.listen(PORT, () => {
        logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
});

// QR Code handling moved to Microservice
app.get('/qrcode', (req, res) => {
    res.redirect(`${process.env.VITE_WP_SERVICE_URL || 'https://ramazan-whatsapp.onrender.com'}/qrcode`);
});


// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    logger.error(`Error: ${err.message}`);
    // server.close(() => process.exit(1)); // Optional: Restart in production via PM2
});
