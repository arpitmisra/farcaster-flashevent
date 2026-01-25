const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Check if running in serverless environment (Vercel) - read-only filesystem
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === 'true';

// Custom format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    }),
  ],
});

// Add file transport ONLY in production AND NOT serverless (Vercel has read-only filesystem)
if (process.env.NODE_ENV === 'production' && !IS_SERVERLESS) {
  try {
    logger.add(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
    
    logger.add(new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }));
  } catch (err) {
    // Ignore file transport errors (e.g., read-only filesystem)
    console.warn('File logging disabled:', err.message);
  }
}

module.exports = logger;
