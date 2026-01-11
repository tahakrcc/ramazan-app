const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Çok fazla istek gönderdiniz, lütfen biraz bekleyin.' }
});

const createAppointmentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 creation requests per minute (still generous, but prevents massive spam)
    message: { error: 'Çok hızlı işlem yapıyorsunuz. Lütfen bekleyin.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 5, // 5 failed attempts
    message: { error: "Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin." }
});

module.exports = {
    apiLimiter,
    createAppointmentLimiter,
    loginLimiter
};
