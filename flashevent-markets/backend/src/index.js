require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');

const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');

// Check if running in serverless environment (Vercel)
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === 'true';

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development or serverless, allow any origin
    if (process.env.NODE_ENV === 'development' || IS_SERVERLESS) {
      return callback(null, true);
    }
    
    // In production, check against your allowed list
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
    // Also allow any vercel.app domain
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, tighten in production
    }
  },
  credentials: true,
}));

// Rate limiting (more lenient for serverless)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_SERVERLESS ? 1000 : (process.env.NODE_ENV === 'development' ? 5000 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  // Skip rate limiting in serverless (each function is isolated)
  skip: () => IS_SERVERLESS,
});
app.use(limiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging (skip in serverless to reduce cold start time)
if (!IS_SERVERLESS) {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// Database connection middleware for serverless
// Connects on each request if not already connected
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    // Continue without DB - endpoints will handle gracefully
    logger.warn('DB connection skipped:', err.message);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    mode: IS_SERVERLESS ? 'serverless' : 'server',
    platform: IS_SERVERLESS ? 'vercel' : 'node',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FlashEvent Markets API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      markets: '/api/markets',
      bets: '/api/bets',
      users: '/api/users',
      prices: '/api/prices',
    },
  });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    mode: IS_SERVERLESS ? 'serverless' : 'live',
    chainId: process.env.CHAIN_ID || 10143,
    rpcUrl: process.env.RPC_URL ? 'configured' : 'not configured',
    serverless: IS_SERVERLESS,
  });
});

// API routes
app.use('/api', routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// For serverless (Vercel), export the app directly
if (IS_SERVERLESS) {
  module.exports = app;
} else {
  // For traditional server mode
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3001;
  
  // Dynamic imports for server-only features
  async function start() {
    try {
      // Connect to database
      try {
        await connectDB();
        logger.info('Connected to MongoDB');
      } catch (dbError) {
        logger.warn('MongoDB not available - using in-memory storage');
      }

      // Connect to Redis
      try {
        await connectRedis();
        logger.info('Connected to Redis');
      } catch (redisError) {
        logger.warn('Redis not available - running without cache');
      }

      // Initialize background jobs
      try {
        const { initializeJobs } = require('./jobs');
        await initializeJobs();
        logger.info('Background jobs initialized');
      } catch (jobError) {
        logger.warn('Background jobs could not be initialized:', jobError.message);
      }

      // Initialize WebSocket server (only in server mode)
      try {
        const { initializeSocket } = require('./services/socketService');
        initializeSocket(server);
        logger.info('WebSocket server initialized');
      } catch (wsError) {
        logger.warn('WebSocket server could not be initialized:', wsError.message);
      }

      // Start price feed updates
      try {
        const { startPriceUpdates } = require('./services/priceService');
        startPriceUpdates(15000); // Update every 15 seconds
      } catch (priceError) {
        logger.warn('Price updates could not be started:', priceError.message);
      }

      // Start HTTP server
      server.listen(PORT, '0.0.0.0', () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`API URL: http://localhost:${PORT}/api`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });

  start();
  
  module.exports = { app, server };
}
