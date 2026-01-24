const express = require('express');
const router = express.Router();

const marketsRoutes = require('./markets');
const betsRoutes = require('./bets');
const usersRoutes = require('./users');
const feedRoutes = require('./feed');
const resolverRoutes = require('./resolver');
const x402Routes = require('./x402');
const pricesRoutes = require('./prices');
const authRoutes = require('./auth');

// API version
router.get('/', (req, res) => {
  res.json({
    name: 'FlashEvent Markets API',
    version: '1.0.0',
    mode: 'LIVE',
    features: {
      websocket: true,
      realTimeUpdates: true,
      priceFeed: true,
      x402Payments: true,
    },
    endpoints: [
      '/api/auth',
      '/api/markets',
      '/api/bets',
      '/api/users',
      '/api/feed',
      '/api/resolver',
      '/api/x402',
      '/api/prices',
    ],
  });
});

// Route modules
router.use('/auth', authRoutes);
router.use('/markets', marketsRoutes);
router.use('/bets', betsRoutes);
router.use('/users', usersRoutes);
router.use('/feed', feedRoutes);
router.use('/resolver', resolverRoutes);
router.use('/x402', x402Routes);
router.use('/prices', pricesRoutes);

module.exports = router;
