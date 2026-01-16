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
    server.listen(PORT, () => {
        logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);

        // Start WhatsApp Bot
        whatsappService.initialize();
    });
});

// QR Code Endpoint for Browser
app.get('/qrcode', (req, res) => {
    const qr = whatsappService.getQR();
    if (qr === 'READY') {
        res.send('<h1>WhatsApp Bağlı! ✅</h1>');
    } else if (qr) {
        res.send(`
            <div style="text-align:center; padding-top: 50px;">
                <h1>WhatsApp Giriş</h1>
                <p>Terminale bakmak yerine bu kodu taratabilirsiniz:</p>
                <img src="${qr}" style="width:300px; height:300px; border: 1px solid #ccc; padding: 10px;" />
            </div>
        `);
    } else {
        res.send('<h1>QR Kod oluşturuluyor, lütfen sayfayı yenileyin... ⏳</h1>');
    }
});


// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    logger.error(`Error: ${err.message}`);
    // server.close(() => process.exit(1)); // Optional: Restart in production via PM2
});
