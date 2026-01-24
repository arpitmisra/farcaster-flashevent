const express = require('express');
const router = express.Router();
const marketService = require('../services/marketService');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { optionalPayment } = require('../middleware/x402');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const logger = require('../utils/logger');

// Validation schemas
const createMarketSchema = z.object({
  body: z.object({
    type: z.enum(['PRICE_TOUCH', 'ONCHAIN_EVENT', 'API_COUNT', 'SPORTS']),
    question: z.string().min(10).max(280),
    duration: z.number().min(3600).max(2592000), // 1 hour to 30 days
    parameters: z.object({
      token: z.string().optional(),
      targetPrice: z.number().optional(),
      isAbove: z.boolean().optional(),
      contractAddress: z.string().optional(),
      eventSelector: z.string().optional(),
      apiEndpoint: z.string().optional(),
      threshold: z.number().optional(),
      // Sports market parameters
      sport: z.string().optional(),
      team1: z.string().optional(),
      team2: z.string().optional(),
      betType: z.enum(['win', 'draw', 'over']).optional(),
      matchDate: z.string().optional(),
      totalLine: z.number().optional(),
    }),
  }),
});

const getMarketsSchema = z.object({
  query: z.object({
    type: z.enum(['PRICE_TOUCH', 'ONCHAIN_EVENT', 'API_COUNT', 'SPORTS']).optional(),
    status: z.enum(['ACTIVE', 'RESOLVED', 'CANCELLED']).optional(),
    creator: z.string().optional(),
    sortBy: z.enum(['volume', 'endTime', 'createdAt']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
  }),
});

/**
 * @route GET /api/markets
 * @desc Get all markets with filtering and pagination
 */
router.get('/', optionalAuth, validate(getMarketsSchema), async (req, res, next) => {
  try {
    const {
      type,
      status,
      creator,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const markets = await marketService.getMarkets({
      type,
      status,
      creator,
      sortBy,
      sortOrder,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json(markets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/markets/trending
 * @desc Get trending markets
 */
router.get('/trending', optionalAuth, async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const markets = await marketService.getTrendingMarkets(parseInt(limit));
    res.json(markets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/markets/ending-soon
 * @desc Get markets ending soon
 */
router.get('/ending-soon', optionalAuth, async (req, res, next) => {
  try {
    const { limit = 10, hours = 24 } = req.query;
    const markets = await marketService.getEndingSoon(parseInt(limit), parseInt(hours));
    res.json(markets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/markets/:id
 * @desc Get market by ID
 */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const market = await marketService.getMarketById(req.params.id);
    res.json(market);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/markets
 * @desc Create a new market
 * Requires JWT authentication, optionally accepts x402 payment for fee discount
 */
router.post('/', authenticate, optionalPayment('CREATE_MARKET'), validate(createMarketSchema), async (req, res, next) => {
  try {
    const { type, question, duration, parameters } = req.body;
    
    // Log x402 payment status
    const hasX402Payment = req.x402?.verified;
    logger.info('Creating market', {
      creator: req.user.address,
      type,
      question: question.substring(0, 50) + '...',
      hasX402Payment,
    });
    
    const market = await marketService.createMarket({
      type,
      question,
      duration,
      parameters,
      creator: req.user.address,
      creatorFid: req.user.fid,
      // Pass x402 info for potential fee handling
      x402Payment: hasX402Payment ? req.x402 : null,
    });

    res.status(201).json(market);
  } catch (error) {
    logger.error('Market creation failed', { 
      error: error.message, 
      creator: req.user?.address 
    });
    next(error);
  }
});

/**
 * @route POST /api/markets/register
 * @desc Register a market that was already deployed on-chain by the user
 * This is for indexing purposes - the market already exists on blockchain
 */
router.post('/register', authenticate, async (req, res, next) => {
  try {
    const { 
      marketAddress, 
      txHash, 
      question, 
      type, 
      parameters, 
      creator, 
      creatorFid, 
      endTime 
    } = req.body;
    
    logger.info('Registering user-deployed market', {
      marketAddress,
      txHash,
      creator: req.user.address,
    });
    
    // Verify the creator matches the authenticated user
    if (creator?.toLowerCase() !== req.user.address?.toLowerCase()) {
      logger.warn('Creator mismatch', { 
        provided: creator, 
        authenticated: req.user.address 
      });
      // Allow anyway for now, but log it
    }
    
    const market = await marketService.registerMarket({
      marketAddress,
      txHash,
      question,
      type,
      parameters,
      creator: req.user.address,
      creatorFid: creatorFid || req.user.fid,
      endTime,
    });

    res.status(201).json(market);
  } catch (error) {
    logger.error('Market registration failed', { 
      error: error.message, 
      creator: req.user?.address 
    });
    next(error);
  }
});

/**
 * @route GET /api/markets/:id/positions
 * @desc Get all positions for a market
 */
router.get('/:id/positions', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const positions = await marketService.getMarketPositions(
      req.params.id,
      parseInt(page),
      parseInt(limit)
    );
    res.json(positions);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/markets/:id/activity
 * @desc Get recent activity for a market
 */
router.get('/:id/activity', optionalAuth, async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const activity = await marketService.getMarketActivity(req.params.id, parseInt(limit));
    res.json(activity);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/markets/:id/price-history
 * @desc Get price history for a market
 */
router.get('/:id/price-history', optionalAuth, async (req, res, next) => {
  try {
    const { interval = '1h', limit = 168 } = req.query;
    const history = await marketService.getPriceHistory(
      req.params.id,
      interval,
      parseInt(limit)
    );
    res.json(history);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
