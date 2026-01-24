const Market = require('../models/Market');
const Bet = require('../models/Bet');
const { redis } = require('../config/redis');
const { getContract, createMarket: createMarketOnChain, getMarketsCount } = require('../utils/blockchain');
const logger = require('../utils/logger');
const { emitMarketCreated, emitMarketUpdated, emitMarketResolved } = require('./socketService');

class MarketService {
  /**
   * Get markets with filtering and pagination
   */
  async getMarkets({ type, status, creator, sortBy, sortOrder, page, limit }) {
    const query = {};
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (creator) query.creator = creator.toLowerCase();
    
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    
    const [markets, total] = await Promise.all([
      Market.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Market.countDocuments(query),
    ]);
    
    return {
      markets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  
  /**
   * Get market by ID
   */
  async getMarketById(id) {
    // Try cache first
    const cached = await redis.get(`market:${id}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const market = await Market.findOne({ marketId: id }).lean();
    if (!market) {
      const error = new Error('Market not found');
      error.status = 404;
      throw error;
    }
    
    // Cache for 30 seconds
    await redis.setex(`market:${id}`, 30, JSON.stringify(market));
    
    return market;
  }
  
  /**
   * Create a new market on-chain and in database
   */
  async createMarket({ type, question, duration, parameters, creator, creatorFid }) {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + duration;
    
    try {
      // Create market on blockchain
      logger.info('Creating market on blockchain', { question, creator });
      
      let txResult;
      try {
        txResult = await createMarketOnChain(question, expiryTimestamp);
      } catch (blockchainError) {
        // Handle specific blockchain errors
        const errorMsg = blockchainError.message || '';
        
        if (errorMsg.includes('insufficient') || errorMsg.includes('balance')) {
          logger.error('Backend wallet has insufficient balance', { error: errorMsg });
          const error = new Error(
            'Server wallet has insufficient funds to create the market. ' +
            'Please contact the administrator to fund the deployment wallet.'
          );
          error.status = 503;
          error.code = 'INSUFFICIENT_SERVER_FUNDS';
          throw error;
        }
        
        if (errorMsg.includes('nonce') || errorMsg.includes('replacement')) {
          logger.error('Transaction nonce error', { error: errorMsg });
          const error = new Error(
            'Transaction pending. Please wait a moment and try again.'
          );
          error.status = 503;
          error.code = 'TX_PENDING';
          throw error;
        }
        
        throw blockchainError;
      }
      
      const { txHash, marketAddress, expiry } = txResult;
      
      // Get market count for ID
      const marketCount = await getMarketsCount();
      const marketId = (marketCount - 1).toString(); // Just created, so count - 1
      
      // Prepare market data
      const marketData = {
        marketId,
        marketAddress,
        type,
        question,
        endTime: expiry,
        creator: creator?.toLowerCase() || 'unknown',
        creatorFid,
        parameters,
        status: 'ACTIVE',
        yesVolume: '0',
        noVolume: '0',
        yesPrice: '0.5',
        noPrice: '0.5',
        txHash,
        createdAt: new Date(),
      };

      // Try to save to database (but don't fail if DB is unavailable)
      try {
        const market = new Market(marketData);
        await market.save();
        logger.info('Market saved to database');
        
        // Emit real-time event for new market
        emitMarketCreated(market.toObject());
      } catch (dbError) {
        logger.warn('Could not save market to database (DB may be unavailable)', { 
          error: dbError.message 
        });
        // Continue anyway - market was created on-chain
      }
      
      logger.info(`Market created on-chain: ${marketId}`, { 
        creator, 
        question, 
        marketAddress,
        txHash 
      });
      
      return {
        ...marketData,
        marketAddress,
        txHash,
      };
    } catch (error) {
      logger.error('Failed to create market', { error: error.message, creator, question });
      throw new Error(`Market creation failed: ${error.message}`);
    }
  }

  /**
   * Register a market that was deployed on-chain by the user
   * This is for indexing purposes only - no blockchain transaction needed
   */
  async registerMarket({ marketAddress, txHash, question, type, parameters, creator, creatorFid, endTime }) {
    try {
      logger.info('Registering user-deployed market', { marketAddress, creator });

      // Generate a market ID (use address or count)
      let marketId;
      try {
        const marketCount = await getMarketsCount();
        marketId = marketCount.toString();
      } catch (e) {
        // Fallback to address-based ID
        marketId = marketAddress.slice(2, 10);
      }

      // Prepare market data
      const marketData = {
        marketId,
        marketAddress,
        type: type || 'PRICE_TOUCH',
        question,
        endTime: endTime || Math.floor(Date.now() / 1000) + 86400,
        creator: creator?.toLowerCase() || 'unknown',
        creatorFid,
        parameters: parameters || {},
        status: 'ACTIVE',
        yesVolume: '0',
        noVolume: '0',
        yesPrice: '0.5',
        noPrice: '0.5',
        txHash,
        createdAt: new Date(),
        deployedByUser: true, // Mark as user-deployed
      };

      // Try to save to database
      try {
        const market = new Market(marketData);
        await market.save();
        logger.info('User-deployed market registered in database', { marketId, marketAddress });
        
        // Emit real-time event
        emitMarketCreated(market.toObject());
        
        return market.toObject();
      } catch (dbError) {
        logger.warn('Could not save to database, returning data anyway', { error: dbError.message });
        return marketData;
      }
    } catch (error) {
      logger.error('Failed to register market', { error: error.message, marketAddress });
      throw new Error(`Market registration failed: ${error.message}`);
    }
  }
  
  /**
   * Get trending markets
   */
  async getTrendingMarkets(limit) {
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    
    // Get markets with most volume in last 24h
    const markets = await Market.aggregate([
      {
        $match: {
          status: 'ACTIVE',
          endTime: { $gt: now },
        },
      },
      {
        $addFields: {
          totalVolume: {
            $add: [
              { $toDouble: '$yesVolume' },
              { $toDouble: '$noVolume' },
            ],
          },
        },
      },
      { $sort: { totalVolume: -1 } },
      { $limit: limit },
    ]);
    
    return markets;
  }
  
  /**
   * Get markets ending soon
   */
  async getEndingSoon(limit, hours) {
    const now = Math.floor(Date.now() / 1000);
    const deadline = now + (hours * 3600);
    
    const markets = await Market.find({
      status: 'ACTIVE',
      endTime: { $gt: now, $lt: deadline },
    })
      .sort({ endTime: 1 })
      .limit(limit)
      .lean();
    
    return markets;
  }
  
  /**
   * Get positions for a market
   */
  async getMarketPositions(marketId, page, limit) {
    const skip = (page - 1) * limit;
    
    const positions = await Bet.aggregate([
      { $match: { marketId } },
      {
        $group: {
          _id: '$userId',
          yesShares: {
            $sum: {
              $cond: [{ $eq: ['$position', 'YES'] }, { $toDouble: '$shares' }, 0],
            },
          },
          noShares: {
            $sum: {
              $cond: [{ $eq: ['$position', 'NO'] }, { $toDouble: '$shares' }, 0],
            },
          },
          totalInvested: { $sum: { $toDouble: '$amount' } },
        },
      },
      { $sort: { totalInvested: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);
    
    return positions;
  }
  
  /**
   * Get market activity
   */
  async getMarketActivity(marketId, limit) {
    const bets = await Bet.find({ marketId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    return bets.map((bet) => ({
      type: 'BET',
      user: bet.userId,
      position: bet.position,
      amount: bet.amount,
      shares: bet.shares,
      price: bet.price,
      timestamp: bet.createdAt,
      txHash: bet.txHash,
    }));
  }
  
  /**
   * Get price history
   */
  async getPriceHistory(marketId, interval, limit) {
    // Get from Redis time-series or aggregate from bets
    const key = `market:${marketId}:prices:${interval}`;
    const history = await redis.lrange(key, 0, limit - 1);
    
    if (history.length > 0) {
      return history.map((item) => JSON.parse(item));
    }
    
    // Fallback: aggregate from bets
    const intervalMs = this._getIntervalMs(interval);
    const bets = await Bet.find({ marketId })
      .sort({ createdAt: 1 })
      .lean();
    
    if (bets.length === 0) {
      return [];
    }
    
    const points = [];
    let currentBucket = null;
    let lastPrice = 0.5;
    
    for (const bet of bets) {
      const timestamp = Math.floor(bet.createdAt.getTime() / intervalMs) * intervalMs;
      
      if (!currentBucket || currentBucket.timestamp !== timestamp) {
        if (currentBucket) {
          points.push(currentBucket);
        }
        currentBucket = {
          timestamp,
          yesPrice: bet.yesPrice || lastPrice,
          noPrice: bet.noPrice || (1 - lastPrice),
          volume: 0,
        };
      }
      
      currentBucket.volume += parseFloat(bet.amount);
      lastPrice = bet.yesPrice || lastPrice;
    }
    
    if (currentBucket) {
      points.push(currentBucket);
    }
    
    return points.slice(-limit);
  }
  
  /**
   * Update market from chain event
   */
  async updateMarketFromChain(marketId, data) {
    const updatedMarket = await Market.findOneAndUpdate(
      { marketId },
      {
        $set: {
          status: data.status,
          yesVolume: data.yesVolume,
          noVolume: data.noVolume,
          yesPrice: data.yesPrice,
          noPrice: data.noPrice,
          outcome: data.outcome,
          resolvedAt: data.resolvedAt,
        },
      },
      { new: true }
    );
    
    // Invalidate cache
    await redis.del(`market:${marketId}`);
    
    // Emit real-time update
    if (updatedMarket) {
      if (data.outcome) {
        emitMarketResolved(updatedMarket.toObject(), data.outcome);
      } else {
        emitMarketUpdated(updatedMarket.toObject());
      }
    }
  }
  
  _getIntervalMs(interval) {
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };
    return intervals[interval] || intervals['1h'];
  }
}

module.exports = new MarketService();
