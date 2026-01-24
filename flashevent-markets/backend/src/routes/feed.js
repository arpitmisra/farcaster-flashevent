const express = require('express');
const router = express.Router();
const feedService = require('../services/feedService');
const { optionalAuth } = require('../middleware/auth');

/**
 * @route GET /api/feed
 * @desc Get social feed
 */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const {
      type, // 'all', 'following', 'trending'
      cursor,
      limit = 50,
    } = req.query;

    const feed = await feedService.getFeed({
      type: type || 'all',
      userId: req.user?.address,
      cursor,
      limit: parseInt(limit),
    });

    res.json(feed);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/following
 * @desc Get feed from followed users
 */
router.get('/following', optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.json({ items: [], cursor: null });
    }

    const { cursor, limit = 50 } = req.query;
    const feed = await feedService.getFollowingFeed(
      req.user.fid,
      cursor,
      parseInt(limit)
    );
    res.json(feed);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/market/:marketId
 * @desc Get feed for a specific market
 */
router.get('/market/:marketId', optionalAuth, async (req, res, next) => {
  try {
    const { cursor, limit = 50 } = req.query;
    const feed = await feedService.getMarketFeed(
      req.params.marketId,
      cursor,
      parseInt(limit)
    );
    res.json(feed);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/user/:address
 * @desc Get feed for a specific user
 */
router.get('/user/:address', optionalAuth, async (req, res, next) => {
  try {
    const { cursor, limit = 50 } = req.query;
    const feed = await feedService.getUserFeed(
      req.params.address,
      cursor,
      parseInt(limit)
    );
    res.json(feed);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/feed/casts
 * @desc Get Farcaster casts related to markets
 */
router.get('/casts', optionalAuth, async (req, res, next) => {
  try {
    const { marketId, cursor, limit = 50 } = req.query;
    const casts = await feedService.getMarketCasts(
      marketId,
      cursor,
      parseInt(limit)
    );
    res.json(casts);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
