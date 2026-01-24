const express = require('express');
const router = express.Router();
const resolverService = require('../services/resolverService');
const chainlinkService = require('../services/chainlinkService');
const sportsService = require('../services/sportsService');
const resolverJob = require('../jobs/resolverJob');
const jobScheduler = require('../jobs/index');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const logger = require('../utils/logger');

// ============ Validation Schemas ============

const resolveMarketSchema = z.object({
  body: z.object({
    marketId: z.string().min(1, 'marketId is required'),
    outcome: z.boolean(),
  }),
});

const cancelMarketSchema = z.object({
  body: z.object({
    marketId: z.string().min(1, 'marketId is required'),
    reason: z.string().optional(),
  }),
});

const validateParamsSchema = z.object({
  body: z.object({
    type: z.enum(['PRICE_TOUCH', 'ONCHAIN_EVENT', 'API_COUNT']),
    params: z.object({}).passthrough(),
  }),
});

// ============ Public Routes ============

/**
 * @route GET /api/resolver/pending
 * @desc Get markets pending resolution
 * @access Public
 */
router.get('/pending', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const markets = await resolverService.getPendingMarkets(parseInt(limit));
    
    res.json({
      success: true,
      count: markets.length,
      markets,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/market/:id
 * @desc Get resolution data for a market (oracle data, suggested outcome)
 * @access Public
 */
router.get('/market/:id', async (req, res, next) => {
  try {
    const data = await resolverService.getResolutionData(req.params.id);
    res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/price/:token
 * @desc Get current price for a token
 * @access Public
 */
router.get('/price/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const priceData = await chainlinkService.getPrice(token);
    
    res.json({
      success: true,
      ...priceData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/tokens
 * @desc Get list of supported tokens for price markets
 * @access Public
 */
router.get('/tokens', async (req, res, next) => {
  try {
    const tokens = chainlinkService.getSupportedTokens();
    
    res.json({
      success: true,
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/validate-token/:token
 * @desc Check if a token is supported and get available price sources
 * @access Public
 */
router.get('/validate-token/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const validation = await chainlinkService.validateToken(token);
    
    res.json({
      success: true,
      ...validation,
    });
  } catch (error) {
    next(error);
  }
});

// ============ Sports API Routes ============

/**
 * @route GET /api/resolver/sports/match
 * @desc Get match result for a sports market
 * @query team1 - First team name (required)
 * @query team2 - Second team name (optional)
 * @query sport - Sport type (optional, auto-detected if not provided)
 * @access Public
 */
router.get('/sports/match', async (req, res, next) => {
  try {
    const { team1, team2, sport } = req.query;
    
    if (!team1) {
      return res.status(400).json({
        success: false,
        error: 'team1 is required',
      });
    }
    
    const result = await sportsService.getMatchResult(team1, team2, sport);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/sports/parse
 * @desc Parse a sports question to extract teams and sport type
 * @body question - The sports market question
 * @access Public
 */
router.post('/sports/parse', async (req, res, next) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'question is required',
      });
    }
    
    const parsed = sportsService.parseQuestion(question);
    
    res.json({
      success: true,
      ...parsed,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/sports/supported
 * @desc Get list of supported sports and teams
 * @access Public
 */
router.get('/sports/supported', async (req, res, next) => {
  try {
    const supported = sportsService.getSupportedSports();
    
    res.json({
      success: true,
      ...supported,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/sports/test-resolution
 * @desc Test sports market resolution without actually resolving
 * @body question - The sports market question to test
 * @access Public
 */
router.post('/sports/test-resolution', async (req, res, next) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'question is required',
      });
    }
    
    // Parse the question
    const parsed = sportsService.parseQuestion(question);
    
    if (!parsed.team1) {
      return res.status(400).json({
        success: false,
        error: 'Could not parse sports question - no team found',
        parsed,
      });
    }
    
    // Get match result
    const matchResult = await sportsService.getMatchResult(
      parsed.team1, 
      parsed.team2, 
      parsed.sport
    );
    
    // Determine outcome if match found
    let outcome = null;
    if (matchResult.found) {
      outcome = sportsService.determineOutcome(
        parsed.team1,
        parsed.team2,
        matchResult,
        parsed.questionType,
        parsed.targetValue
      );
    }
    
    res.json({
      success: true,
      question,
      parsed,
      matchResult,
      suggestedOutcome: outcome,
      suggestedOutcomeString: outcome === null ? 'UNKNOWN' : (outcome ? 'YES' : 'NO'),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/validate-params
 * @desc Validate market parameters before creation
 * @access Public
 */
router.post('/validate-params', validate(validateParamsSchema), async (req, res, next) => {
  try {
    const { type, params } = req.body;
    const validation = await resolverService.validateMarketParams(type, params);
    
    res.json({
      success: true,
      ...validation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/oracle/:type
 * @desc Get oracle data for a specific market type
 * @access Public
 */
router.get('/oracle/:type', async (req, res, next) => {
  try {
    const { params } = req.query;
    const parsedParams = params ? JSON.parse(params) : {};
    
    const data = await resolverService.getOracleData(req.params.type, parsedParams);
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/stats
 * @desc Get resolver job statistics
 * @access Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = resolverJob.getStats();
    const schedulerStatus = jobScheduler.getSchedulerStatus();
    
    res.json({
      success: true,
      scheduler: schedulerStatus,
      stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/scheduler-status
 * @desc Get scheduler status (Redis vs Fallback)
 * @access Public
 */
router.get('/scheduler-status', async (req, res, next) => {
  try {
    const status = jobScheduler.getSchedulerStatus();
    
    res.json({
      success: true,
      ...status,
      message: status.mode === 'fallback' 
        ? '✅ Auto-resolution active (Fallback Scheduler - no Redis)'
        : status.mode === 'redis'
        ? '✅ Auto-resolution active (Redis/Bull)'
        : '❌ Scheduler not running',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/trigger
 * @desc Manually trigger the resolver to run immediately
 * @access Public (for testing)
 */
router.post('/trigger', async (req, res, next) => {
  try {
    logger.info('Manual resolver trigger requested');
    const result = await jobScheduler.triggerResolver();
    
    res.json({
      success: result.success,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ============ Admin Routes (Authenticated) ============

/**
 * @route POST /api/resolver/resolve
 * @desc Manually resolve a market
 * @access Admin
 */
router.post('/resolve', authenticate, validate(resolveMarketSchema), async (req, res, next) => {
  try {
    const { marketId, outcome } = req.body;
    
    logger.info(`Manual resolution requested for market ${marketId}`, {
      outcome,
      resolver: req.user?.address,
    });
    
    const result = await resolverService.resolveMarket(
      marketId,
      outcome,
      req.user?.address || 'admin'
    );
    
    // Clear review flag if was flagged
    await resolverJob.clearReviewFlag(marketId);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/auto-resolve/:id
 * @desc Auto-resolve a market using oracle data
 * @access Admin
 */
router.post('/auto-resolve/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    logger.info(`Auto-resolution triggered for market ${id}`, {
      triggeredBy: req.user?.address,
    });
    
    const result = await resolverService.autoResolveMarket(id);
    
    // Clear review flag if was flagged
    await resolverJob.clearReviewFlag(id);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/cancel
 * @desc Cancel a market
 * @access Admin
 */
router.post('/cancel', authenticate, validate(cancelMarketSchema), async (req, res, next) => {
  try {
    const { marketId, reason } = req.body;
    
    logger.info(`Market cancellation requested for ${marketId}`, {
      reason,
      cancelledBy: req.user?.address,
    });
    
    const result = await resolverService.cancelMarket(marketId);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/run-job
 * @desc Manually trigger the resolver job
 * @access Admin
 */
router.post('/run-job', authenticate, async (req, res, next) => {
  try {
    logger.info(`Manual resolver job triggered by ${req.user?.address}`);
    
    const result = await resolverJob.runManually();
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/review
 * @desc Get markets requiring manual review
 * @access Admin
 */
router.get('/review', authenticate, async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const markets = await resolverJob.getMarketsForReview(parseInt(limit));
    
    res.json({
      success: true,
      count: markets.length,
      markets,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/clear-review/:id
 * @desc Clear manual review flag for a market
 * @access Admin
 */
router.post('/clear-review/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    await resolverJob.clearReviewFlag(id);
    
    res.json({
      success: true,
      message: `Review flag cleared for market ${id}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/resolver/clear-cache
 * @desc Clear the price feed cache
 * @access Admin
 */
router.post('/clear-cache', authenticate, async (req, res, next) => {
  try {
    chainlinkService.clearCache();
    
    res.json({
      success: true,
      message: 'Price feed cache cleared',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/historical-price/:token
 * @desc Get historical price for a token at a specific timestamp
 * @access Public
 */
router.get('/historical-price/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { timestamp, network = 'ethereum' } = req.query;
    
    if (!timestamp) {
      return res.status(400).json({
        success: false,
        error: 'timestamp query parameter is required',
      });
    }
    
    const priceData = await chainlinkService.getHistoricalPrice(
      token,
      parseInt(timestamp),
      { network }
    );
    
    res.json({
      success: true,
      ...priceData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/resolver/price-touch-check/:token
 * @desc Check if price touched a target during a time period
 * @access Public
 */
router.get('/price-touch-check/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const { targetPrice, startTime, endTime, direction = 'above', network = 'ethereum' } = req.query;
    
    if (!targetPrice || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'targetPrice, startTime, and endTime are required',
      });
    }
    
    const result = await chainlinkService.didPriceTouch(
      token,
      parseFloat(targetPrice),
      parseInt(startTime),
      parseInt(endTime),
      { direction, network }
    );
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
