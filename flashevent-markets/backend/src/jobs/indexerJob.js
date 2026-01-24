const { ethers } = require('ethers');
const { redis } = require('../config/redis');
const { getProvider, getContract, getAllMarkets } = require('../utils/blockchain');
const logger = require('../utils/logger');

/**
 * Indexer Job (BLOCKCHAIN-ONLY VERSION)
 * 
 * Syncs chain events WITHOUT MongoDB!
 * - Uses in-memory cache
 * - Respects RPC rate limits (100 block chunks)
 * - Can optionally sync to MongoDB if configured
 */

// Configuration
const CONFIG = {
  MAX_BLOCK_RANGE: 100,  // Monad testnet limit for eth_getLogs
  MAX_BLOCKS_PER_RUN: 500, // Process max 500 blocks per job run
  RETRY_DELAY: 5000,     // 5 seconds between retries
  MAX_RETRIES: 3,
};

// In-memory cache (persisted in Redis if available)
let lastProcessedBlock = null;

/**
 * Main indexer process
 */
async function process(job) {
  logger.debug('Running indexer job (blockchain-only mode)');
  
  try {
    const provider = getProvider();
    const currentBlock = await provider.getBlockNumber();
    
    // Get last processed block
    const fromBlock = await getLastProcessedBlock(currentBlock);
    
    if (fromBlock >= currentBlock) {
      logger.debug('No new blocks to index');
      return { synced: true, fromBlock, toBlock: currentBlock, events: 0 };
    }
    
    // Calculate end block (respect MAX_BLOCKS_PER_RUN)
    const maxToBlock = Math.min(
      fromBlock + CONFIG.MAX_BLOCKS_PER_RUN,
      currentBlock
    );
    
    logger.info(`📊 Indexing blocks ${fromBlock} → ${maxToBlock} (current: ${currentBlock})`);
    
    // Index events in chunks (respecting 100 block limit)
    let totalEvents = 0;
    let currentChunkStart = fromBlock;
    
    while (currentChunkStart <= maxToBlock) {
      const chunkEnd = Math.min(
        currentChunkStart + CONFIG.MAX_BLOCK_RANGE - 1,
        maxToBlock
      );
      
      logger.debug(`Processing chunk: ${currentChunkStart} → ${chunkEnd}`);
      
      try {
        const events = await indexEventsChunk(currentChunkStart, chunkEnd);
        totalEvents += events;
        
        // Save progress after each successful chunk
        await saveLastProcessedBlock(chunkEnd);
        lastProcessedBlock = chunkEnd;
        
      } catch (error) {
        logger.error(`Failed to index chunk ${currentChunkStart}-${chunkEnd}:`, error.message);
        // Don't throw - continue with next chunk
      }
      
      currentChunkStart = chunkEnd + 1;
      
      // Small delay to avoid overwhelming RPC
      if (currentChunkStart <= maxToBlock) {
        await sleep(200);
      }
    }
    
    logger.info(`✅ Indexed ${totalEvents} events from blocks ${fromBlock}-${maxToBlock}`);
    
    return {
      synced: true,
      fromBlock,
      toBlock: maxToBlock,
      events: totalEvents,
      blocksProcessed: maxToBlock - fromBlock + 1,
    };
    
  } catch (error) {
    logger.error('Indexer job error:', error);
    throw error;
  }
}

/**
 * Index events for a single chunk (max 100 blocks)
 */
async function indexEventsChunk(fromBlock, toBlock) {
  let eventCount = 0;
  
  try {
    // Index MarketFactory events
    eventCount += await indexMarketCreated(fromBlock, toBlock);
    
    // Note: Bet events would require querying each market contract
    // Skip for now to avoid rate limits - can be fetched on-demand
    
  } catch (error) {
    logger.error(`Error indexing chunk ${fromBlock}-${toBlock}:`, error.message);
  }
  
  return eventCount;
}

/**
 * Index MarketCreated events from factory
 */
async function indexMarketCreated(fromBlock, toBlock) {
  try {
    const factory = getContract('MarketFactory');
    
    // Get MarketCreated events
    const filter = factory.filters.MarketCreated();
    const events = await factory.queryFilter(filter, fromBlock, toBlock);
    
    if (events.length > 0) {
      logger.info(`Found ${events.length} MarketCreated events`);
      
      for (const event of events) {
        const { market, question, expiry, creator } = event.args;
        
        logger.info(`Market created: ${market}`, {
          question: question.substring(0, 50),
          creator,
          expiry: new Date(Number(expiry) * 1000).toISOString(),
          block: event.blockNumber,
          tx: event.transactionHash,
        });
      }
    }
    
    return events.length;
    
  } catch (error) {
    // Check if error is due to block range limit
    if (error.message.includes('100 range')) {
      logger.error('Block range too large - this should not happen with chunking!');
      throw new Error(`Block range ${fromBlock}-${toBlock} exceeds RPC limit`);
    }
    
    logger.error('Error indexing MarketCreated:', error.message);
    return 0;
  }
}

/**
 * Get last processed block from cache/redis
 */
async function getLastProcessedBlock(currentBlock) {
  // Try in-memory cache first
  if (lastProcessedBlock !== null) {
    return lastProcessedBlock + 1;
  }
  
  // Try Redis
  try {
    const cached = await redis.get('indexer:lastBlock');
    if (cached) {
      lastProcessedBlock = parseInt(cached);
      return lastProcessedBlock + 1;
    }
  } catch (error) {
    logger.debug('Redis not available for indexer cache');
  }
  
  // Default: start from recent blocks
  const startBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks
  lastProcessedBlock = startBlock - 1;
  
  logger.info(`Starting indexer from block ${startBlock} (no cached state)`);
  return startBlock;
}

/**
 * Save last processed block to cache/redis
 */
async function saveLastProcessedBlock(blockNumber) {
  try {
    await redis.set('indexer:lastBlock', blockNumber.toString());
  } catch (error) {
    // Redis not available - that's ok, we have in-memory cache
  }
}

/**
 * Helper: sleep for ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reset indexer state (for testing)
 */
async function reset() {
  lastProcessedBlock = null;
  try {
    await redis.del('indexer:lastBlock');
  } catch (error) {
    // Ignore
  }
  logger.info('Indexer state reset');
}

module.exports = { 
  process,
  reset,
  CONFIG,
};
