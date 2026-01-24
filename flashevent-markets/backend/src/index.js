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
const { initializeJobs } = require('./jobs');
const { initializeSocket, getConnectedClientsCount } = require('./services/socketService');
const { startPriceUpdates } = require('./services/priceService');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow ANY origin dynamically (fixes the '*' + credentials issue)
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check against your allowed list
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Rate limitin
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 5000 : 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    mode: 'live',
    connectedClients: getConnectedClientsCount(),
  });
});

// API status
app.get('/api/status', (req, res) => {
  res.json({
    mode: 'live',
    chainId: process.env.CHAIN_ID || 10143,
    rpcUrl: process.env.RPC_URL,
    wsConnections: getConnectedClientsCount(),
  });
});

// API routes
app.use('/api', routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;

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

    // Initialize background jobs (runs regardless of MongoDB - uses fallback scheduler)
    try {
      await initializeJobs();
      logger.info('Background jobs initialized');
    } catch (jobError) {
      logger.warn('Background jobs could not be initialized:', jobError.message);
    }

    // Initialize WebSocket server
    initializeSocket(server);

    // Start price feed updates
    startPriceUpdates(15000); // Update every 15 seconds

    // Start HTTP + WebSocket server
    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`WebSocket enabled on ws://localhost:${PORT}`);
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
