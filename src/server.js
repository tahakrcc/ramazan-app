require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const whatsappService = require('./services/whatsapp.service');
const logger = require('./config/logger');
require('./jobs/reminder.job'); // Start Reminder Job
require('./jobs/feedback_request.job'); // Start Feedback Job

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB().then(() => {
    // Start Server
    // Start Server
    server.listen(PORT, () => {
        logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);

        // Initialize Local WhatsApp Bot
        whatsappService.initialize();
    });
});


// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    logger.error(`Error: ${err.message}`);
    // server.close(() => process.exit(1)); // Optional: Restart in production via PM2
});
