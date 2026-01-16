require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./config/logger');

const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB().then(() => {
    // Start Server
    server.listen(PORT, () => {
        logger.info(`API Server running on port ${PORT}`);
        logger.info(`WhatsApp Bot should be running on a separate instance.`);
    });
});

// Simplified QR Endpoint (Since bot is not here)
app.get('/qrcode', (req, res) => {
    res.send(`
        <div style="text-align:center; padding-top: 50px; font-family: sans-serif;">
            <h1>Bot Ayrıldı 🤖</h1>
            <p>WhatsApp Bot artık farklı bir sunucuda çalışıyor.</p>
            <p>QR Kodu görmek için <b>Bot Sunucusunun</b> loglarını (terminal çıktılarını) kontrol ediniz.</p>
        </div>
    `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    logger.error(`Error: ${err.message}`);
});
