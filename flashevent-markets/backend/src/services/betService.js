const Bet = require('../models/Bet');
const User = require('../models/User');
const Market = require('../models/Market');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');
const { emitBetPlaced, emitMarketUpdated } = require('./socketService');

class BetService {
  /**
   * Get user's bets with filtering
   */
  async getUserBets({ userId, status, marketId, page, limit }) {
    const query = { userId: userId.toLowerCase() };
    
    if (marketId) query.marketId = marketId;
    
    if (status) {
      if (status === 'ACTIVE') {
        // Get active market IDs
        const activeMarkets = await Market.find({ status: 'ACTIVE' }).distinct('marketId');
        query.marketId = { $in: activeMarkets };
      } else if (status === 'RESOLVED') {
        const resolvedMarkets = await Market.find({ status: 'RESOLVED' }).distinct('marketId');
        query.marketId = { $in: resolvedMarkets };
      }
    }
    
    const skip = (page - 1) * limit;
    
    const [bets, total] = await Promise.all([
      Bet.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bet.countDocuments(query),
    ]);
    
    // Enrich with market data
    const marketIds = [...new Set(bets.map((b) => b.marketId))];
    const markets = await Market.find({ marketId: { $in: marketIds } }).lean();
    const marketMap = Object.fromEntries(markets.map((m) => [m.marketId, m]));
    
    const enrichedBets = bets.map((bet) => ({
      ...bet,
      market: marketMap[bet.marketId],
    }));
    
    return {
      bets: enrichedBets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  
  /**
   * Get active bets for user
   */
  async getActiveBets(userId) {
    const activeMarkets = await Market.find({ status: 'ACTIVE' }).distinct('marketId');
    
    const bets = await Bet.find({
      userId: userId.toLowerCase(),
      marketId: { $in: activeMarkets },
    })
      .sort({ createdAt: -1 })
      .lean();
    
    // Enrich with market data
    const markets = await Market.find({ marketId: { $in: activeMarkets } }).lean();
    const marketMap = Object.fromEntries(markets.map((m) => [m.marketId, m]));
    
    return bets.map((bet) => ({
      ...bet,
      market: marketMap[bet.marketId],
    }));
  }
  
  /**
   * Get bet history
   */
  async getBetHistory(userId, page, limit) {
    const resolvedMarkets = await Market.find({ status: 'RESOLVED' }).distinct('marketId');
    
    const skip = (page - 1) * limit;
    
    const bets = await Bet.find({
      userId: userId.toLowerCase(),
      marketId: { $in: resolvedMarkets },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Enrich with market data and calculate P&L
    const markets = await Market.find({ 
      marketId: { $in: bets.map((b) => b.marketId) } 
    }).lean();
    const marketMap = Object.fromEntries(markets.map((m) => [m.marketId, m]));
    
    return bets.map((bet) => {
      const market = marketMap[bet.marketId];
      const won = market && (
        (market.outcome === true && bet.position === 'YES') ||
        (market.outcome === false && bet.position === 'NO')
      );
      
      return {
        ...bet,
        market,
        won,
        pnl: won ? bet.potentialPayout - bet.amount : -bet.amount,
      };
    });
  }
  
  /**
   * Get bet by ID
   */
  async getBetById(id, userId) {
    const bet = await Bet.findOne({
      _id: id,
      userId: userId.toLowerCase(),
    }).lean();
    
    if (!bet) {
      const error = new Error('Bet not found');
      error.status = 404;
      throw error;
    }
    
    const market = await Market.findOne({ marketId: bet.marketId }).lean();
    
    return { ...bet, market };
  }
  
  /**
   * Record a new bet
   */
  async recordBet({ marketId, position, amount, txHash, userId, userFid }) {
    // Get market to calculate shares
    const market = await Market.findOne({ marketId }).lean();
    if (!market) {
      const error = new Error('Market not found');
      error.status = 404;
      throw error;
    }
    
    // Calculate shares based on current price
    const price = position === 'YES' ? market.yesPrice : market.noPrice;
    const shares = parseFloat(amount) / parseFloat(price);
    const potentialPayout = shares; // Simplified: 1 share = 1 unit payout
    
    const bet = new Bet({
      marketId,
      userId: userId.toLowerCase(),
      userFid,
      position,
      amount,
      shares: shares.toString(),
      price,
      potentialPayout: potentialPayout.toString(),
      txHash,
      status: txHash ? 'CONFIRMED' : 'PENDING',
    });
    
    await bet.save();
    
    // Update user stats
    await User.findOneAndUpdate(
      { address: userId.toLowerCase() },
      {
        $inc: { totalBets: 1, totalVolume: parseFloat(amount) },
      }
    );
    
    // Emit real-time bet event
    emitBetPlaced(bet.toObject(), market);
    
    logger.info(`Bet recorded: ${bet._id}`, { marketId, userId, position, amount });
    
    return bet;
  }
  
  /**
   * Get user stats
   */
  async getUserStats(userId) {
    const stats = await Bet.aggregate([
      { $match: { userId: userId.toLowerCase() } },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalVolume: { $sum: { $toDouble: '$amount' } },
          avgBetSize: { $avg: { $toDouble: '$amount' } },
          uniqueMarkets: { $addToSet: '$marketId' },
        },
      },
    ]);
    
    if (stats.length === 0) {
      return {
        totalBets: 0,
        totalVolume: 0,
        avgBetSize: 0,
        marketsParticipated: 0,
        winRate: 0,
        totalPnL: 0,
      };
    }
    
    // Calculate win rate from resolved bets
    const resolvedMarkets = await Market.find({ status: 'RESOLVED' }).lean();
    const resolvedMap = Object.fromEntries(
      resolvedMarkets.map((m) => [m.marketId, m.outcome])
    );
    
    const resolvedBets = await Bet.find({
      userId: userId.toLowerCase(),
      marketId: { $in: resolvedMarkets.map((m) => m.marketId) },
    }).lean();
    
    let wins = 0;
    let totalPnL = 0;
    
    for (const bet of resolvedBets) {
      const outcome = resolvedMap[bet.marketId];
      const won = (outcome === true && bet.position === 'YES') ||
                  (outcome === false && bet.position === 'NO');
      
      if (won) {
        wins++;
        totalPnL += parseFloat(bet.potentialPayout) - parseFloat(bet.amount);
      } else {
        totalPnL -= parseFloat(bet.amount);
      }
    }
    
    const winRate = resolvedBets.length > 0 ? (wins / resolvedBets.length) * 100 : 0;
    
    return {
      totalBets: stats[0].totalBets,
      totalVolume: stats[0].totalVolume,
      avgBetSize: stats[0].avgBetSize,
      marketsParticipated: stats[0].uniqueMarkets.length,
      resolvedBets: resolvedBets.length,
      wins,
      winRate: Math.round(winRate * 10) / 10,
      totalPnL: Math.round(totalPnL * 1000) / 1000,
    };
  }
  
  /**
   * Get leaderboard
   */
  async getLeaderboard(period, limit) {
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'day') {
      dateFilter = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
    } else if (period === 'week') {
      dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === 'month') {
      dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
    }
    
    const leaderboard = await Bet.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$userId',
          totalVolume: { $sum: { $toDouble: '$amount' } },
          totalBets: { $sum: 1 },
          userFid: { $first: '$userFid' },
        },
      },
      { $sort: { totalVolume: -1 } },
      { $limit: limit },
    ]);
    
    // Enrich with user data
    const userAddresses = leaderboard.map((l) => l._id);
    const users = await User.find({ address: { $in: userAddresses } }).lean();
    const userMap = Object.fromEntries(users.map((u) => [u.address, u]));
    
    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      address: entry._id,
      user: userMap[entry._id],
      totalVolume: entry.totalVolume,
      totalBets: entry.totalBets,
    }));
  }
}

module.exports = new BetService();
