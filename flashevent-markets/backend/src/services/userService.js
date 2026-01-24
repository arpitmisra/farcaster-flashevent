const User = require('../models/User');
const Market = require('../models/Market');
const Bet = require('../models/Bet');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../utils/logger');

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'flashevent-secret-key';

class UserService {
  /**
   * Get user by address
   */
  async getUserByAddress(address) {
    const user = await User.findOne({ address: address.toLowerCase() }).lean();
    
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    
    return user;
  }
  
  /**
   * Get user by Farcaster ID
   */
  async getUserByFid(fid) {
    const user = await User.findOne({ fid }).lean();
    
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    
    return user;
  }
  
  /**
   * Update user profile
   */
  async updateProfile(address, updates) {
    const user = await User.findOneAndUpdate(
      { address: address.toLowerCase() },
      { $set: updates },
      { new: true }
    ).lean();
    
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    
    return user;
  }
  
  /**
   * Get user's markets
   */
  async getUserMarkets(address, page, limit) {
    const skip = (page - 1) * limit;
    
    const [markets, total] = await Promise.all([
      Market.find({ creator: address.toLowerCase() })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Market.countDocuments({ creator: address.toLowerCase() }),
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
   * Get user's public bets
   */
  async getUserPublicBets(address, page, limit) {
    const skip = (page - 1) * limit;
    
    const [bets, total] = await Promise.all([
      Bet.find({ userId: address.toLowerCase() })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bet.countDocuments({ userId: address.toLowerCase() }),
    ]);
    
    // Enrich with market data
    const marketIds = [...new Set(bets.map((b) => b.marketId))];
    const markets = await Market.find({ marketId: { $in: marketIds } }).lean();
    const marketMap = Object.fromEntries(markets.map((m) => [m.marketId, m]));
    
    return {
      bets: bets.map((bet) => ({
        ...bet,
        market: marketMap[bet.marketId],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  
  /**
   * Get user stats
   */
  async getUserStats(address) {
    const user = await User.findOne({ address: address.toLowerCase() }).lean();
    
    const betsStats = await Bet.aggregate([
      { $match: { userId: address.toLowerCase() } },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalVolume: { $sum: { $toDouble: '$amount' } },
        },
      },
    ]);
    
    const marketsCreated = await Market.countDocuments({ 
      creator: address.toLowerCase() 
    });
    
    return {
      address,
      fid: user?.fid,
      totalBets: betsStats[0]?.totalBets || 0,
      totalVolume: betsStats[0]?.totalVolume || 0,
      marketsCreated,
      joinedAt: user?.createdAt,
    };
  }
  
  /**
   * Authenticate with Farcaster
   */
  async authenticateFarcaster({ message, signature, fid, custody }) {
    try {
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() !== custody.toLowerCase()) {
        throw new Error('Invalid signature');
      }
      
      // Verify FID ownership via Neynar
      const response = await axios.get(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
        {
          headers: { 'api_key': NEYNAR_API_KEY },
        }
      );
      
      const fcUser = response.data.users?.[0];
      if (!fcUser) {
        throw new Error('Farcaster user not found');
      }
      
      // Check custody address matches
      if (fcUser.custody_address?.toLowerCase() !== custody.toLowerCase()) {
        throw new Error('Custody address mismatch');
      }
      
      // Find or create user
      let user = await User.findOne({ fid });
      
      if (!user) {
        user = new User({
          fid,
          address: custody.toLowerCase(),
          username: fcUser.username,
          displayName: fcUser.display_name,
          avatar: fcUser.pfp_url,
          bio: fcUser.profile?.bio?.text,
        });
        await user.save();
        logger.info(`New user created: ${fid}`, { username: fcUser.username });
      } else {
        // Update user info
        user.username = fcUser.username;
        user.displayName = fcUser.display_name;
        user.avatar = fcUser.pfp_url;
        user.bio = fcUser.profile?.bio?.text;
        user.lastLogin = new Date();
        await user.save();
      }
      
      // Generate JWT
      const token = jwt.sign(
        {
          fid: user.fid,
          address: user.address,
          username: user.username,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return {
        token,
        user: user.toObject(),
      };
    } catch (error) {
      logger.error('Farcaster authentication failed:', error);
      const err = new Error('Authentication failed');
      err.status = 401;
      throw err;
    }
  }
  
  /**
   * Link wallet to account
   */
  async linkWallet(fid, { address, signature, message }) {
    try {
      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Invalid signature');
      }
      
      // Check if wallet is already linked to another account
      const existingUser = await User.findOne({
        linkedWallets: address.toLowerCase(),
        fid: { $ne: fid },
      });
      
      if (existingUser) {
        throw new Error('Wallet already linked to another account');
      }
      
      // Add wallet to user
      const user = await User.findOneAndUpdate(
        { fid },
        {
          $addToSet: { linkedWallets: address.toLowerCase() },
        },
        { new: true }
      ).lean();
      
      if (!user) {
        throw new Error('User not found');
      }
      
      logger.info(`Wallet linked: ${address} to FID ${fid}`);
      
      return { success: true, user };
    } catch (error) {
      logger.error('Wallet linking failed:', error);
      const err = new Error(error.message || 'Failed to link wallet');
      err.status = 400;
      throw err;
    }
  }
}

module.exports = new UserService();
