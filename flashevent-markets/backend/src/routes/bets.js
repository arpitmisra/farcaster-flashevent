const express = require('express');
const router = express.Router();
const betService = require('../services/betService');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

// Validation schemas
const placeBetSchema = z.object({
  body: z.object({
    marketId: z.string(),
    position: z.enum(['YES', 'NO']),
    amount: z.string(), // Wei amount as string
    txHash: z.string().optional(),
  }),
});

/**
 * @route GET /api/bets
 * @desc Get user's bets
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const {
      status,
      marketId,
      page = 1,
      limit = 20,
    } = req.query;

    const bets = await betService.getUserBets({
      userId: req.user.address,
      status,
      marketId,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json(bets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/bets/active
 * @desc Get user's active bets
 */
router.get('/active', authenticate, async (req, res, next) => {
  try {
    const bets = await betService.getActiveBets(req.user.address);
    res.json(bets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/bets/history
 * @desc Get user's bet history
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const bets = await betService.getBetHistory(
      req.user.address,
      parseInt(page),
      parseInt(limit)
    );
    res.json(bets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/bets/:id
 * @desc Get bet by ID
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const bet = await betService.getBetById(req.params.id, req.user.address);
    res.json(bet);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/bets
 * @desc Record a new bet (after on-chain transaction)
 */
router.post('/', authenticate, validate(placeBetSchema), async (req, res, next) => {
  try {
    const { marketId, position, amount, txHash } = req.body;
    
    const bet = await betService.recordBet({
      marketId,
      position,
      amount,
      txHash,
      userId: req.user.address,
      userFid: req.user.fid,
    });

    res.status(201).json(bet);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/bets/stats
 * @desc Get user's betting statistics
 */
router.get('/stats/summary', authenticate, async (req, res, next) => {
  try {
    const stats = await betService.getUserStats(req.user.address);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/bets/leaderboard
 * @desc Get betting leaderboard
 */
router.get('/stats/leaderboard', optionalAuth, async (req, res, next) => {
  try {
    const { period = 'all', limit = 50 } = req.query;
    const leaderboard = await betService.getLeaderboard(period, parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
