const Bet = require('../models/Bet');
const Market = require('../models/Market');
const User = require('../models/User');
const axios = require('axios');
const { redis } = require('../config/redis');

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

class FeedService {
  /**
   * Get main feed
   */
  async getFeed({ type, userId, cursor, limit }) {
    let items = [];
    
    if (type === 'trending') {
      items = await this._getTrendingFeed(limit);
    } else if (type === 'following' && userId) {
      items = await this._getFollowingFeed(userId, cursor, limit);
    } else {
      items = await this._getAllFeed(cursor, limit);
    }
    
    // Get next cursor
    const lastItem = items[items.length - 1];
    const nextCursor = lastItem ? lastItem._id.toString() : null;
    
    return {
      items,
      cursor: nextCursor,
      hasMore: items.length === limit,
    };
  }
  
  /**
   * Get all activity feed
   */
  async _getAllFeed(cursor, limit) {
    const query = cursor ? { _id: { $lt: cursor } } : {};
    
    const bets = await Bet.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    return this._enrichFeedItems(bets);
  }
  
  /**
   * Get trending feed
   */
  async _getTrendingFeed(limit) {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    
    // Get bets from last 24h grouped by market
    const trendingMarkets = await Bet.aggregate([
      { $match: { createdAt: { $gte: oneDayAgo } } },
      {
        $group: {
          _id: '$marketId',
          volume: { $sum: { $toDouble: '$amount' } },
          betCount: { $sum: 1 },
          lastBet: { $max: '$createdAt' },
        },
      },
      { $sort: { volume: -1 } },
      { $limit: limit },
    ]);
    
    // Get market details
    const marketIds = trendingMarkets.map((m) => m._id);
    const markets = await Market.find({ marketId: { $in: marketIds } }).lean();
    const marketMap = Object.fromEntries(markets.map((m) => [m.marketId, m]));
    
    return trendingMarkets.map((item) => ({
      type: 'TRENDING_MARKET',
      marketId: item._id,
      market: marketMap[item._id],
      volume24h: item.volume,
      betCount24h: item.betCount,
      lastActivity: item.lastBet,
    }));
  }
  
  /**
   * Get following feed (users followed on Farcaster)
   */
  async getFollowingFeed(fid, cursor, limit) {
    try {
      // Get following list from Neynar
      const response = await axios.get(
        `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=100`,
        {
          headers: { 'api_key': NEYNAR_API_KEY },
        }
      );
      
      const followingFids = response.data.users?.map((u) => u.fid) || [];
      
      if (followingFids.length === 0) {
        return { items: [], cursor: null, hasMore: false };
      }
      
      // Get users by FID
      const users = await User.find({ fid: { $in: followingFids } }).lean();
      const userAddresses = users.map((u) => u.address);
      
      // Get bets from following users
      const query = {
        userId: { $in: userAddresses },
        ...(cursor ? { _id: { $lt: cursor } } : {}),
      };
      
      const bets = await Bet.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      
      const items = await this._enrichFeedItems(bets);
      const lastItem = items[items.length - 1];
      
      return {
        items,
        cursor: lastItem ? lastItem._id.toString() : null,
        hasMore: items.length === limit,
      };
    } catch (error) {
      console.error('Error fetching following feed:', error);
      return { items: [], cursor: null, hasMore: false };
    }
  }
  
  /**
   * Get feed for a specific market
   */
  async getMarketFeed(marketId, cursor, limit) {
    const query = {
      marketId,
      ...(cursor ? { _id: { $lt: cursor } } : {}),
    };
    
    const bets = await Bet.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    const items = await this._enrichFeedItems(bets);
    const lastItem = items[items.length - 1];
    
    return {
      items,
      cursor: lastItem ? lastItem._id.toString() : null,
      hasMore: items.length === limit,
    };
  }
  
  /**
   * Get feed for a specific user
   */
  async getUserFeed(address, cursor, limit) {
    const query = {
      userId: address.toLowerCase(),
      ...(cursor ? { _id: { $lt: cursor } } : {}),
    };
    
    const bets = await Bet.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    const items = await this._enrichFeedItems(bets);
    const lastItem = items[items.length - 1];
    
    return {
      items,
      cursor: lastItem ? lastItem._id.toString() : null,
      hasMore: items.length === limit,
    };
  }
  
  /**
   * Get Farcaster casts related to markets
   */
  async getMarketCasts(marketId, cursor, limit) {
    try {
      // Search for casts mentioning the market
      const market = await Market.findOne({ marketId }).lean();
      if (!market) {
        return { casts: [], cursor: null };
      }
      
      // Search Farcaster for relevant casts
      const searchQuery = encodeURIComponent(market.question.slice(0, 50));
      const response = await axios.get(
        `https://api.neynar.com/v2/farcaster/cast/search?q=${searchQuery}&limit=${limit}`,
        {
          headers: { 'api_key': NEYNAR_API_KEY },
        }
      );
      
      return {
        casts: response.data.result?.casts || [],
        cursor: response.data.result?.next?.cursor || null,
      };
    } catch (error) {
      console.error('Error fetching market casts:', error);
      return { casts: [], cursor: null };
    }
  }
  
  /**
   * Enrich feed items with user and market data
   */
  async _enrichFeedItems(bets) {
    if (bets.length === 0) return [];
    
    // Get unique market IDs and user addresses
    const marketIds = [...new Set(bets.map((b) => b.marketId))];
    const userAddresses = [...new Set(bets.map((b) => b.userId))];
    
    // Fetch markets and users
    const [markets, users] = await Promise.all([
      Market.find({ marketId: { $in: marketIds } }).lean(),
      User.find({ address: { $in: userAddresses } }).lean(),
    ]);
    
    const marketMap = Object.fromEntries(markets.map((m) => [m.marketId, m]));
    const userMap = Object.fromEntries(users.map((u) => [u.address, u]));
    
    return bets.map((bet) => ({
      type: 'BET',
      _id: bet._id,
      marketId: bet.marketId,
      market: marketMap[bet.marketId],
      user: userMap[bet.userId] || { address: bet.userId },
      position: bet.position,
      amount: bet.amount,
      shares: bet.shares,
      price: bet.price,
      txHash: bet.txHash,
      createdAt: bet.createdAt,
    }));
  }
}

module.exports = new FeedService();
