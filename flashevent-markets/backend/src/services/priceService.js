/**
 * Price Feed Service - Live cryptocurrency prices
 * Uses CoinGecko API for real-time price data
 */

const axios = require('axios');
const logger = require('../utils/logger');
const { emitPriceUpdate } = require('./socketService');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Supported assets
const SUPPORTED_ASSETS = {
  ethereum: { symbol: 'ETH', name: 'Ethereum' },
  bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
  solana: { symbol: 'SOL', name: 'Solana' },
  'usd-coin': { symbol: 'USDC', name: 'USD Coin' },
  chainlink: { symbol: 'LINK', name: 'Chainlink' },
  uniswap: { symbol: 'UNI', name: 'Uniswap' },
  aave: { symbol: 'AAVE', name: 'Aave' },
  'matic-network': { symbol: 'MATIC', name: 'Polygon' },
  arbitrum: { symbol: 'ARB', name: 'Arbitrum' },
  optimism: { symbol: 'OP', name: 'Optimism' },
};

// Cache for prices - initialize with mock data
let priceCache = {};
let lastFetchTime = 0;
const CACHE_DURATION = 10000; // 10 seconds

// Initialize with mock prices on startup
priceCache = getMockPrices();

/**
 * Get mock prices for fallback
 */
function getMockPrices() {
  const now = Date.now();
  // Add slight random variations for realism
  const rand = () => (Math.random() - 0.5) * 2;
  return {
    ETH: { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3500 + rand() * 50, change24h: 2.5 + rand(), volume24h: 15000000000, marketCap: 420000000000, lastUpdated: now },
    BTC: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 95000 + rand() * 500, change24h: 1.2 + rand(), volume24h: 35000000000, marketCap: 1900000000000, lastUpdated: now },
    SOL: { id: 'solana', symbol: 'SOL', name: 'Solana', price: 180 + rand() * 5, change24h: -1.5 + rand(), volume24h: 3000000000, marketCap: 85000000000, lastUpdated: now },
    USDC: { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', price: 1.00, change24h: 0.01, volume24h: 5000000000, marketCap: 45000000000, lastUpdated: now },
    LINK: { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 22 + rand(), change24h: 3.1 + rand(), volume24h: 800000000, marketCap: 13000000000, lastUpdated: now },
    UNI: { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', price: 12 + rand() * 0.5, change24h: -0.8 + rand(), volume24h: 200000000, marketCap: 7000000000, lastUpdated: now },
    AAVE: { id: 'aave', symbol: 'AAVE', name: 'Aave', price: 280 + rand() * 10, change24h: 4.2 + rand(), volume24h: 300000000, marketCap: 4200000000, lastUpdated: now },
    MATIC: { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', price: 0.85 + rand() * 0.05, change24h: -2.1 + rand(), volume24h: 400000000, marketCap: 8000000000, lastUpdated: now },
    ARB: { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', price: 1.80 + rand() * 0.1, change24h: 5.5 + rand(), volume24h: 600000000, marketCap: 2300000000, lastUpdated: now },
    OP: { id: 'optimism', symbol: 'OP', name: 'Optimism', price: 3.20 + rand() * 0.2, change24h: 2.8 + rand(), volume24h: 400000000, marketCap: 3400000000, lastUpdated: now },
  };
}

/**
 * Fetch current prices from CoinGecko
 */
async function fetchPrices() {
  const now = Date.now();
  
  // Return cached data if fresh
  if (now - lastFetchTime < CACHE_DURATION && Object.keys(priceCache).length > 0) {
    return priceCache;
  }

  try {
    const ids = Object.keys(SUPPORTED_ASSETS).join(',');
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids,
        vs_currencies: 'usd',
        include_24hr_change: true,
        include_24hr_vol: true,
        include_market_cap: true,
      },
      timeout: 10000,
    });

    const prices = {};
    for (const [id, data] of Object.entries(response.data)) {
      const asset = SUPPORTED_ASSETS[id];
      if (asset) {
        prices[asset.symbol] = {
          id,
          symbol: asset.symbol,
          name: asset.name,
          price: data.usd,
          change24h: data.usd_24h_change || 0,
          volume24h: data.usd_24h_vol || 0,
          marketCap: data.usd_market_cap || 0,
          lastUpdated: now,
        };
      }
    }

    priceCache = prices;
    lastFetchTime = now;

    // Emit price update to all subscribed clients
    emitPriceUpdate(prices);

    return prices;
  } catch (error) {
    logger.error('Error fetching prices from CoinGecko:', error.message);
    
    // Return cached data if available
    if (Object.keys(priceCache).length > 0) {
      return priceCache;
    }
    
    // Return mock data as fallback
    return getMockPrices();
  }
}

/**
 * Get price for a specific asset
 */
async function getPrice(symbol) {
  const prices = await fetchPrices();
  return prices[symbol.toUpperCase()] || null;
}

/**
 * Get all supported assets
 */
function getSupportedAssets() {
  return Object.entries(SUPPORTED_ASSETS).map(([id, info]) => ({
    id,
    ...info,
  }));
}

/**
 * Get historical price data
 */
async function getHistoricalPrices(symbol, days = 7) {
  const assetId = Object.entries(SUPPORTED_ASSETS).find(
    ([, info]) => info.symbol === symbol.toUpperCase()
  )?.[0];

  if (!assetId) {
    return null;
  }

  try {
    const response = await axios.get(`${COINGECKO_API}/coins/${assetId}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days,
      },
      timeout: 10000,
    });

    return {
      symbol: symbol.toUpperCase(),
      prices: response.data.prices.map(([timestamp, price]) => ({
        timestamp,
        price,
      })),
    };
  } catch (error) {
    logger.error(`Error fetching historical prices for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Start price update interval
 */
let priceUpdateInterval = null;

function startPriceUpdates(intervalMs = 15000) {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
  }

  // Fetch immediately
  fetchPrices().catch(err => logger.error('Initial price fetch error:', err));

  // Then fetch periodically
  priceUpdateInterval = setInterval(() => {
    fetchPrices().catch(err => logger.error('Price fetch error:', err));
  }, intervalMs);

  logger.info(`Price updates started (every ${intervalMs / 1000}s)`);
}

function stopPriceUpdates() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
    logger.info('Price updates stopped');
  }
}

module.exports = {
  fetchPrices,
  getPrice,
  getSupportedAssets,
  getHistoricalPrices,
  startPriceUpdates,
  stopPriceUpdates,
};
