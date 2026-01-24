/**
 * Price Feed Routes - Live cryptocurrency prices
 */

const express = require('express');
const router = express.Router();
const { 
  fetchPrices, 
  getPrice, 
  getSupportedAssets,
  getHistoricalPrices 
} = require('../services/priceService');

// GET /api/prices - Get all current prices
router.get('/', async (req, res, next) => {
  try {
    const prices = await fetchPrices();
    res.json({
      success: true,
      data: prices,
      timestamp: Date.now(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/assets - Get supported assets list
router.get('/assets', (req, res) => {
  const assets = getSupportedAssets();
  res.json({
    success: true,
    data: assets,
  });
});

// GET /api/prices/:symbol - Get price for specific asset
router.get('/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const price = await getPrice(symbol);
    
    if (!price) {
      return res.status(404).json({
        success: false,
        message: `Price not found for ${symbol}`,
      });
    }

    res.json({
      success: true,
      data: price,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/prices/:symbol/history - Get historical prices
router.get('/:symbol/history', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const { days = 7 } = req.query;
    
    const history = await getHistoricalPrices(symbol, parseInt(days));
    
    if (!history) {
      return res.status(404).json({
        success: false,
        message: `Historical data not found for ${symbol}`,
      });
    }

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
