/**
 * Demo API routes - provides mock data when contracts aren't deployed
 */
const express = require('express');
const router = express.Router();
const { 
  isDemoMode, 
  getDemoMarkets, 
  getDemoMarketById, 
  getDemoTrendingMarkets,
  getDemoUser,
  getDemoUserBets
} = require('../utils/demoData');

// Middleware to check demo mode
router.use((req, res, next) => {
  if (!isDemoMode()) {
    return res.status(404).json({ 
      success: false, 
      message: 'Demo routes only available when contracts are not deployed' 
    });
  }
  next();
});

// GET /api/demo/markets - Get all demo markets
router.get('/markets', (req, res) => {
  const { category } = req.query;
  const data = getDemoMarkets({ category });
  res.json({
    success: true,
    data,
    message: '⚠️ Demo mode - these are mock markets for testing',
  });
});

// GET /api/demo/markets/:id - Get single market
router.get('/markets/:id', (req, res) => {
  const market = getDemoMarketById(req.params.id);
  if (!market) {
    return res.status(404).json({ success: false, message: 'Market not found' });
  }
  res.json({
    success: true,
    data: market,
    message: '⚠️ Demo mode',
  });
});

// GET /api/demo/trending - Get trending markets
router.get('/trending', (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const markets = getDemoTrendingMarkets(limit);
  res.json({
    success: true,
    data: markets,
    message: '⚠️ Demo mode - trending markets',
  });
});

// GET /api/demo/user - Get demo user
router.get('/user', (req, res) => {
  res.json({
    success: true,
    data: getDemoUser(),
    message: '⚠️ Demo mode - mock user',
  });
});

// GET /api/demo/user/bets - Get user bets
router.get('/user/bets', (req, res) => {
  res.json({
    success: true,
    data: getDemoUserBets(),
    message: '⚠️ Demo mode - mock bets',
  });
});

// POST /api/demo/bet - Simulate placing a bet
router.post('/bet', (req, res) => {
  const { marketId, side, amount } = req.body;
  
  res.json({
    success: true,
    data: {
      id: `demo-bet-${Date.now()}`,
      marketId,
      side,
      amount,
      timestamp: Date.now(),
      txHash: '0x' + 'demo'.repeat(16), // Fake tx hash
    },
    message: '⚠️ Demo mode - bet simulated (no real transaction)',
  });
});

module.exports = router;
