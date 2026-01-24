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

// Cache for prices - will be populated on first fetch
let priceCache = {};
let lastFetchTime = 0;
const CACHE_DURATION = 10000; // 10 seconds
let isInitialized = false;

// Binance API as secondary fallback
const BINANCE_API = 'https://api.binance.com/api/v3';

// Symbol mappings for Binance
const BINANCE_SYMBOLS = {
  ETH: 'ETHUSDT',
  BTC: 'BTCUSDT',
  SOL: 'SOLUSDT',
  LINK: 'LINKUSDT',
  UNI: 'UNIUSDT',
  AAVE: 'AAVEUSDT',
  MATIC: 'MATICUSDT',
  ARB: 'ARBUSDT',
  OP: 'OPUSDT',
};

/**
 * Fetch prices from Binance as fallback
 */
async function fetchFromBinance() {
  try {
    const symbols = Object.values(BINANCE_SYMBOLS);
    const response = await axios.get(`${BINANCE_API}/ticker/24hr`, {
      params: { symbols: JSON.stringify(symbols) },
      timeout: 10000,
    });

    const prices = {};
    const now = Date.now();

    for (const [symbol, binanceSymbol] of Object.entries(BINANCE_SYMBOLS)) {
      const data = response.data.find(t => t.symbol === binanceSymbol);
      if (data) {
        const asset = Object.values(SUPPORTED_ASSETS).find(a => a.symbol === symbol);
        const id = Object.entries(SUPPORTED_ASSETS).find(([, a]) => a.symbol === symbol)?.[0];
        if (asset && id) {
          prices[symbol] = {
            id,
            symbol,
            name: asset.name,
            price: parseFloat(data.lastPrice),
            change24h: parseFloat(data.priceChangePercent),
            volume24h: parseFloat(data.quoteVolume),
            marketCap: 0, // Binance doesn't provide market cap
            lastUpdated: now,
          };
        }
      }
    }

    // USDC is always $1
    prices.USDC = {
      id: 'usd-coin',
      symbol: 'USDC',
      name: 'USD Coin',
      price: 1.00,
      change24h: 0,
      volume24h: 0,
      marketCap: 0,
      lastUpdated: now,
    };

    return prices;
  } catch (error) {
    logger.error('Error fetching from Binance:', error.message);
    return null;
  }
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
    
    // Try Binance as fallback
    logger.info('Attempting Binance fallback for prices...');
    const binancePrices = await fetchFromBinance();
    if (binancePrices && Object.keys(binancePrices).length > 0) {
      priceCache = binancePrices;
      lastFetchTime = Date.now();
      return binancePrices;
    }
    
    // Return empty object if all sources fail
    logger.warn('All price sources failed - no price data available');
    return {};
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
