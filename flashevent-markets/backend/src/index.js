require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Check if running in serverless environment (Vercel)
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.IS_SERVERLESS === 'true';

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware - simplified for serverless
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false,
}));

// CORS - allow all origins for now
app.use(cors({
  origin: true,
  credentials: true,
}));

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Lazy load database connection
let dbConnected = false;
const connectDatabase = async () => {
  if (dbConnected) return;
  try {
    const { connectDB } = require('./config/database');
    await connectDB();
    dbConnected = true;
  } catch (err) {
    console.warn('DB connection skipped:', err.message);
  }
};

// Health check - no DB needed
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: IS_SERVERLESS ? 'serverless' : 'server',
    platform: IS_SERVERLESS ? 'vercel' : 'node',
  });
});

// Root endpoint - no DB needed
app.get('/', (req, res) => {
  res.json({
    name: 'FlashEvent Markets API',
    version: '1.0.0',
    status: 'running',
    serverless: IS_SERVERLESS,
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

// API status - no DB needed
app.get('/api/status', (req, res) => {
  res.json({
    mode: IS_SERVERLESS ? 'serverless' : 'live',
    chainId: process.env.CHAIN_ID || 10143,
    rpcUrl: process.env.RPC_URL ? 'configured' : 'not configured',
    mongoUri: process.env.MONGODB_URI ? 'configured' : 'not configured',
    serverless: IS_SERVERLESS,
  });
});

// Database connection middleware - only for API routes that need it
app.use('/api', async (req, res, next) => {
  await connectDatabase();
  next();
});

// Load and use routes
try {
  const routes = require('./routes');
  app.use('/api', routes);
} catch (err) {
  console.error('Failed to load routes:', err.message);
  app.use('/api', (req, res) => {
    res.status(500).json({ error: 'Routes not available', details: err.message });
  });
}

// Error handlers
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    stack: IS_SERVERLESS ? undefined : err.stack 
  });
});

// Always export the app for Vercel
module.exports = app;

// Start server in non-serverless mode
if (!IS_SERVERLESS) {
  const http = require('http');
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3001;
  
  async function start() {
    try {
      await connectDatabase();
      console.log('Connected to MongoDB');

      try {
        const { connectRedis } = require('./config/redis');
        await connectRedis();
        console.log('Connected to Redis');
      } catch (redisError) {
        console.warn('Redis not available');
      }

      try {
        const { initializeJobs } = require('./jobs');
        await initializeJobs();
        console.log('Background jobs initialized');
      } catch (jobError) {
        console.warn('Background jobs not initialized:', jobError.message);
      }

      try {
        const { initializeSocket } = require('./services/socketService');
        initializeSocket(server);
        console.log('WebSocket server initialized');
      } catch (wsError) {
        console.warn('WebSocket not initialized:', wsError.message);
      }

      try {
        const { startPriceUpdates } = require('./services/priceService');
        startPriceUpdates(15000);
      } catch (priceError) {
        console.warn('Price updates not started:', priceError.message);
      }

      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`API URL: http://localhost:${PORT}/api`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));

  start();
}
