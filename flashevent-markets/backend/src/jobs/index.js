const resolverJob = require('./resolverJob');
const indexerJob = require('./indexerJob');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;

// Check if Redis URL is valid (not just localhost fallback)
const isRedisConfigured = REDIS_URL && 
  REDIS_URL !== 'redis://localhost:6379' && 
  REDIS_URL.includes('://');

// State management
let queues = null;
let fallbackIntervals = [];
let isRunningResolver = false;
let isRunningIndexer = false;
let schedulerMode = 'none'; // 'redis', 'fallback', 'none'

/**
 * Try to initialize Bull queues with Redis
 * Returns true if successful, false otherwise
 */
async function tryInitializeBullQueues() {
  // Skip Bull/Redis entirely if not properly configured
  if (!isRedisConfigured) {
    logger.info('📭 No external Redis configured - skipping Bull queue setup');
    return false;
  }

  try {
    const Bull = require('bull');
    
    queues = {
      resolver: new Bull('resolver', REDIS_URL, {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      }),
      indexer: new Bull('indexer', REDIS_URL, {
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      }),
    };

    // Process resolver queue
    queues.resolver.process(async (job) => {
      return await resolverJob.process(job);
    });

    // Process indexer queue  
    queues.indexer.process(async (job) => {
      return await indexerJob.process(job);
    });

    // Error handling
    Object.values(queues).forEach((queue) => {
      queue.on('error', (error) => {
        logger.error(`Queue error:`, error);
      });
      
      queue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed:`, error);
      });
      
      queue.on('completed', (job) => {
        logger.debug(`Job ${job.id} completed`);
      });
    });

    // Test connection by pinging
    await queues.resolver.isReady();
    
    return true;
  } catch (error) {
    logger.warn(`Redis/Bull initialization failed: ${error.message}`);
    queues = null;
    return false;
  }
}

/**
 * Fallback scheduler using setInterval (No Redis required)
 * Runs resolver and indexer jobs on a fixed schedule
 */
async function initializeFallbackScheduler() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔄 Starting FALLBACK SCHEDULER (No Redis)');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Resolver job - every 60 seconds (1 minute)
  const resolverInterval = setInterval(async () => {
    if (isRunningResolver) {
      logger.debug('Resolver job already running, skipping...');
      return;
    }
    
    isRunningResolver = true;
    try {
      const result = await resolverJob.process({});
      if (result.processed > 0) {
        logger.info(`✅ Resolver: ${result.success} resolved, ${result.failed} failed`);
      }
    } catch (error) {
      logger.error('❌ Resolver job error:', error.message);
    } finally {
      isRunningResolver = false;
    }
  }, 60 * 1000); // Every 60 seconds
  
  // Indexer job - every 30 seconds
  const indexerInterval = setInterval(async () => {
    if (isRunningIndexer) {
      logger.debug('Indexer job already running, skipping...');
      return;
    }
    
    isRunningIndexer = true;
    try {
      await indexerJob.process({});
    } catch (error) {
      logger.error('❌ Indexer job error:', error.message);
    } finally {
      isRunningIndexer = false;
    }
  }, 30 * 1000); // Every 30 seconds
  
  fallbackIntervals.push(resolverInterval, indexerInterval);
  
  // Run resolver immediately on startup (after 5 seconds to let everything initialize)
  setTimeout(async () => {
    try {
      logger.info('🚀 Running initial market resolution check...');
      isRunningResolver = true;
      const result = await resolverJob.process({});
      logger.info('📊 Initial check result:', result);
    } catch (error) {
      logger.error('Initial resolver check failed:', error.message);
    } finally {
      isRunningResolver = false;
    }
  }, 5000);
  
  schedulerMode = 'fallback';
  logger.info('📅 Schedule: Resolver every 1 min | Indexer every 30s');
  logger.info('✅ Fallback scheduler is ACTIVE');
}

// Initialize scheduled jobs
async function initializeJobs() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('🔧 Initializing Background Jobs...');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Try Redis/Bull first
  const bullInitialized = await tryInitializeBullQueues();
  
  if (bullInitialized && queues) {
    try {
      // Clear any existing repeatable jobs
      const resolverJobs = await queues.resolver.getRepeatableJobs();
      for (const job of resolverJobs) {
        await queues.resolver.removeRepeatableByKey(job.key);
      }
      
      const indexerJobs = await queues.indexer.getRepeatableJobs();
      for (const job of indexerJobs) {
        await queues.indexer.removeRepeatableByKey(job.key);
      }
      
      // Schedule resolver job every minute
      await queues.resolver.add(
        'check-markets',
        {},
        {
          repeat: { cron: '* * * * *' }, // Every minute
        }
      );
      
      // Schedule indexer job every 30 seconds
      await queues.indexer.add(
        'sync-chain',
        {},
        {
          repeat: { cron: '*/30 * * * * *' }, // Every 30 seconds
        }
      );
      
      schedulerMode = 'redis';
      logger.info('✅ Background jobs initialized with Redis/Bull');
      logger.info('📅 Schedule: Resolver every 1 min | Indexer every 30s');
      return;
    } catch (error) {
      logger.error('Bull job scheduling failed:', error.message);
      logger.info('Falling back to setInterval scheduler...');
      queues = null;
    }
  }
  
  // Fallback: Use setInterval-based scheduler (no Redis needed)
  await initializeFallbackScheduler();
}

// Graceful shutdown
async function shutdownJobs() {
  logger.info('Shutting down background jobs...');
  
  // Clear fallback intervals
  fallbackIntervals.forEach(interval => clearInterval(interval));
  fallbackIntervals = [];
  
  // Close Bull queues if they exist
  if (queues) {
    try {
      await Promise.all(
        Object.values(queues).map((queue) => queue.close())
      );
    } catch (error) {
      logger.error('Error closing Bull queues:', error.message);
    }
  }
  
  schedulerMode = 'none';
  logger.info('✅ Background jobs shut down');
}

/**
 * Get current scheduler status
 */
function getSchedulerStatus() {
  return {
    mode: schedulerMode,
    redisConfigured: isRedisConfigured,
    queuesActive: !!queues,
    fallbackActive: fallbackIntervals.length > 0,
    resolverRunning: isRunningResolver,
    indexerRunning: isRunningIndexer,
  };
}

/**
 * Manually trigger resolver job (for testing/admin)
 */
async function triggerResolver() {
  if (isRunningResolver) {
    return { success: false, message: 'Resolver already running' };
  }
  
  isRunningResolver = true;
  try {
    const result = await resolverJob.process({});
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    isRunningResolver = false;
  }
}

module.exports = {
  queues,
  initializeJobs,
  shutdownJobs,
  getSchedulerStatus,
  triggerResolver,
};
