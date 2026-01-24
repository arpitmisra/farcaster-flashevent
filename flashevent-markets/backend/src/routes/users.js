const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

// Validation schemas
const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().min(1).max(50).optional(),
    bio: z.string().max(280).optional(),
    avatar: z.string().url().optional(),
  }),
});

/**
 * @route GET /api/users/me
 * @desc Get current user profile
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await userService.getUserByAddress(req.user.address);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/me
 * @desc Update current user profile
 */
router.put('/me', authenticate, validate(updateProfileSchema), async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.user.address, req.body);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:address
 * @desc Get user by address
 */
router.get('/:address', optionalAuth, async (req, res, next) => {
  try {
    const user = await userService.getUserByAddress(req.params.address);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/fid/:fid
 * @desc Get user by Farcaster ID
 */
router.get('/fid/:fid', optionalAuth, async (req, res, next) => {
  try {
    const user = await userService.getUserByFid(parseInt(req.params.fid));
    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:address/markets
 * @desc Get markets created by user
 */
router.get('/:address/markets', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const markets = await userService.getUserMarkets(
      req.params.address,
      parseInt(page),
      parseInt(limit)
    );
    res.json(markets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:address/bets
 * @desc Get user's public bets
 */
router.get('/:address/bets', optionalAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const bets = await userService.getUserPublicBets(
      req.params.address,
      parseInt(page),
      parseInt(limit)
    );
    res.json(bets);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:address/stats
 * @desc Get user statistics
 */
router.get('/:address/stats', optionalAuth, async (req, res, next) => {
  try {
    const stats = await userService.getUserStats(req.params.address);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/users/auth/farcaster
 * @desc Authenticate with Farcaster
 */
router.post('/auth/farcaster', async (req, res, next) => {
  try {
    const { message, signature, fid, custody } = req.body;
    const result = await userService.authenticateFarcaster({
      message,
      signature,
      fid,
      custody,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/users/auth/wallet
 * @desc Link wallet to account
 */
router.post('/auth/wallet', authenticate, async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;
    const result = await userService.linkWallet(req.user.fid, {
      address,
      signature,
      message,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
