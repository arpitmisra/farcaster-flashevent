const resolverService = require('../services/resolverService');
const logger = require('../utils/logger');

/**
 * Market Resolver Job (BLOCKCHAIN-ONLY VERSION)
 * 
 * Automatically resolves markets directly from blockchain - NO MongoDB required!
 * 
 * Flow:
 * 1. Fetch all markets from MarketFactory on-chain
 * 2. Filter: expired + not resolved
 * 3. Parse question to extract token/target
 * 4. Fetch current price from oracle
 * 5. Determine outcome and resolve on-chain
 */

// Configuration
const CONFIG = {
  MAX_CONCURRENT: 3,           // Max markets to resolve concurrently
  BATCH_SIZE: 20,              // Markets to fetch per job run
};

// Resolution statistics
let stats = {
  totalProcessed: 0,
  totalSuccess: 0,
  totalFailed: 0,
  lastRun: null,
};

// Track failed markets to avoid hammering them
const failedMarkets = new Map(); // address -> { attempts, lastAttempt }
const MAX_RETRIES = 5;
const RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

/**
 * Main job processor
 */
async function process(job) {
  const startTime = Date.now();
  logger.info('🔄 Starting resolver job (BLOCKCHAIN-ONLY mode)');
  
  try {
    // Get pending markets directly from blockchain
    const markets = await resolverService.getPendingMarkets(CONFIG.BATCH_SIZE);
    
    if (markets.length === 0) {
      logger.debug('No markets pending resolution');
      return { processed: 0, success: 0, failed: 0 };
    }
    
    // Filter out recently failed markets
    const marketsToProcess = markets.filter(m => shouldProcessMarket(m.contractAddress));
    
    logger.info(`Found ${markets.length} pending, processing ${marketsToProcess.length}`);
    
    // Process markets in batches for concurrency control
    const results = await processMarketsInBatches(marketsToProcess, CONFIG.MAX_CONCURRENT);
    
    // Update stats
    stats.totalProcessed += results.processed;
    stats.totalSuccess += results.success;
    stats.totalFailed += results.failed;
    stats.lastRun = new Date();
    
    const duration = Date.now() - startTime;
    logger.info(`✅ Resolver job completed in ${duration}ms`, results);
    
    return results;
    
  } catch (error) {
    logger.error('❌ Resolver job failed:', error);
    throw error;
  }
}

/**
 * Check if market should be processed (not recently failed)
 */
function shouldProcessMarket(address) {
  const failed = failedMarkets.get(address);
  if (!failed) return true;
  
  // Skip if max retries exceeded
  if (failed.attempts >= MAX_RETRIES) {
    return false;
  }
  
  // Skip if retry delay not passed
  if (Date.now() - failed.lastAttempt < RETRY_DELAY) {
    return false;
  }
  
  return true;
}

/**
 * Record market failure
 */
function recordFailure(address, error) {
  const existing = failedMarkets.get(address) || { attempts: 0 };
  failedMarkets.set(address, {
    attempts: existing.attempts + 1,
    lastAttempt: Date.now(),
    lastError: error,
  });
}

/**
 * Process markets in batches with concurrency control
 */
async function processMarketsInBatches(markets, concurrency) {
  let processed = 0;
  let success = 0;
  let failed = 0;
  const errors = [];
  
  // Process in chunks
  for (let i = 0; i < markets.length; i += concurrency) {
    const batch = markets.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(market => processMarket(market))
    );
    
    for (const result of batchResults) {
      processed++;
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
      } else {
        failed++;
        if (result.reason) {
          errors.push(result.reason.message);
        }
      }
    }
    
    // Small delay between batches to avoid overwhelming the network
    if (i + concurrency < markets.length) {
      await sleep(1000);
    }
  }
  
  return { processed, success, failed, errors: errors.slice(0, 5) };
}

/**
 * Process a single market (BLOCKCHAIN-ONLY)
 */
async function processMarket(market) {
  const { contractAddress, question } = market;
  
  try {
    logger.info(`Processing market: ${contractAddress}`);
    logger.debug(`Question: ${question.substring(0, 80)}...`);
    
    // Auto-resolve using oracle data
    const result = await resolverService.autoResolveMarket(market);
    
    // Clear from failed markets on success
    failedMarkets.delete(contractAddress);
    
    logger.info(`✅ Market ${contractAddress} resolved:`, {
      outcome: result.outcomeString,
      txHash: result.txHash,
    });
    
    return { success: true, result };
    
  } catch (error) {
    logger.error(`❌ Failed to resolve market ${contractAddress}:`, error.message);
    
    // Record failure for retry logic
    recordFailure(contractAddress, error.message);
    
    return { success: false, error: error.message };
  }
}

/**
 * Get resolver job statistics
 */
function getStats() {
  return { 
    ...stats,
    failedMarketsCount: failedMarkets.size,
  };
}

/**
 * Reset statistics
 */
function resetStats() {
  stats = {
    totalProcessed: 0,
    totalSuccess: 0,
    totalFailed: 0,
    lastRun: null,
  };
  failedMarkets.clear();
}

/**
 * Helper: sleep for ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run job manually (for testing or CLI)
 */
async function runManually() {
  logger.info('Running resolver job manually...');
  return process({});
}

/**
 * Get list of failed markets (for debugging)
 */
function getFailedMarkets() {
  const result = [];
  for (const [address, data] of failedMarkets) {
    result.push({ address, ...data });
  }
  return result;
}

module.exports = {
  process,
  getStats,
  resetStats,
  runManually,
  getFailedMarkets,
  CONFIG,
};
