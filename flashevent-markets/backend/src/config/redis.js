const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;
let usingMockRedis = false;

async function connectRedis() {
  if (redis) {
    return redis;
  }

  // Skip Redis connection entirely in demo mode
  if (!process.env.REDIS_URL || process.env.REDIS_URL === 'redis://localhost:6379') {
    logger.warn('Redis URL not configured or using localhost - using in-memory mock');
    redis = createMockRedis();
    usingMockRedis = true;
    return redis;
  }

  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 2) {
          logger.warn('Redis unavailable - falling back to mock');
          return null; // Stop retrying
        }
        return 500; // Retry after 500ms
      },
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 3000,
    });

    redis.on('error', (err) => {
      if (!usingMockRedis) {
        logger.error('Redis error:', err.message);
      }
    });

    redis.on('ready', () => {
      logger.info('Redis ready');
    });

    await redis.connect();
    
    return redis;
  } catch (error) {
    logger.warn('Redis unavailable - using in-memory mock');
    redis = createMockRedis();
    usingMockRedis = true;
    return redis;
  }
}

function createMockRedis() {
  const store = new Map();
  
  return {
    get: async (key) => store.get(key) || null,
    set: async (key, value) => { store.set(key, value); return 'OK'; },
    setex: async (key, seconds, value) => { store.set(key, value); return 'OK'; },
    del: async (key) => { store.delete(key); return 1; },
    exists: async (key) => store.has(key) ? 1 : 0,
    incr: async (key) => {
      const val = parseInt(store.get(key) || '0') + 1;
      store.set(key, val.toString());
      return val;
    },
    expire: async () => 1,
    lrange: async () => [],
    lpush: async () => 1,
    ltrim: async () => 'OK',
    publish: async () => 0,
    subscribe: async () => {},
    on: () => {},
    quit: async () => {},
  };
}

async function disconnectRedis() {
  if (redis && typeof redis.quit === 'function') {
    await redis.quit();
    redis = null;
  }
}

module.exports = {
  connectRedis,
  disconnectRedis,
  get redis() {
    return redis || createMockRedis();
  },
};
