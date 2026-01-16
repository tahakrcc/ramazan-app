const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Note: express-mongo-sanitize removed - incompatible with Express 5.x
// MongoDB injection prevention handled via Joi validation in controllers
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// HTTPS Redirect in Production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// const mongoSanitize = require('express-mongo-sanitize');
// const xss = require('xss-clean');
const hpp = require('hpp');
// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// Note: MongoDB injection prevention handled via Joi validation in controllers
// express-mongo-sanitize is incompatible with Express 5.x

// Data Sanitization against NoSQL Query Injection
// app.use(mongoSanitize()); // Removed due to Express 5.x incompatibility

// Data Sanitization against XSS
// app.use(xss()); // Removed causing 'Cannot set property query' error

// Prevent Parameter Pollution
app.use(hpp());

// CORS Configuration - More restrictive
const allowedOrigins = [
    'http://localhost:5173',  // Vite dev server
    'http://localhost:3000',  // Alternative dev
    'https://byramazan.com',  // Production Domain
    'https://www.byramazan.com',
    process.env.FRONTEND_URL  // Env var fallback
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true
}));

// Body Parser with size limit
app.use(express.json({ limit: '10kb' }));

// Rate Limiting for API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Çok fazla istek, lütfen 15 dakika sonra tekrar deneyin.' }
});

// Routes
app.use('/api', apiLimiter);
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error Handler
app.use(errorHandler);

module.exports = app;
