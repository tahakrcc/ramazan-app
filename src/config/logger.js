const winston = require('winston');

// Sensitive data filter - masks passwords, tokens, secrets
const sensitiveFilter = winston.format((info) => {
    if (typeof info.message === 'string') {
        // Mask common sensitive patterns
        info.message = info.message
            .replace(/password['":\s]*['"]?[^'",\s}]+['"]?/gi, 'password: [REDACTED]')
            .replace(/token['":\s]*['"]?[^'",\s}]+['"]?/gi, 'token: [REDACTED]')
            .replace(/secret['":\s]*['"]?[^'",\s}]+['"]?/gi, 'secret: [REDACTED]')
            .replace(/authorization['":\s]*['"]?Bearer\s+[^'",\s}]+['"]?/gi, 'Authorization: [REDACTED]');
    }
    return info;
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        sensitiveFilter(),
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        // Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        // Write all logs with importance level of `info` or less to `combined.log`
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

module.exports = logger;

