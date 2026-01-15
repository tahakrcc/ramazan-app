require('dotenv').config();
const http = require('http');
const connectDB = require('./config/db');
const whatsappService = require('./services/whatsapp.service');
const logger = require('./config/logger');

// Create a dummy server to satisfy Render's port binding requirement
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    if (req.url === '/health') {
        res.end('Bot is running');
    } else {
        res.end('WhatsApp Bot Service');
    }
});

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB().then(() => {
    // Start Dummy Server
    server.listen(PORT, () => {
        logger.info(`Bot Service dummy server listening on port ${PORT}`);

        // Start WhatsApp Bot
        logger.info('Initializing WhatsApp Service...');

        // Override the client initialization in service might be needed, 
        // but for now we assume the service handles it.
        // We will need to make sure the service uses aggressive memory savings.
        whatsappService.initialize();
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    logger.error(`Error: ${err.message}`);
    // Don't exit process on error, try to keep running
});
