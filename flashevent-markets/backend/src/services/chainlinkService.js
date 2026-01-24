const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Chainlink Price Feed Service
 * 
 * Supports multiple data sources:
 * 1. Chainlink Price Feeds (on-chain)
 * 2. CoinGecko API (fallback)
 * 3. Binance API (fallback)
 * 
 * This provides redundancy and reliability for price resolution.
 */

// Chainlink Aggregator V3 Interface ABI (minimal)
const CHAINLINK_AGGREGATOR_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
  'function description() external view returns (string memory)',
  'function getRoundData(uint80 _roundId) external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
];

// Chainlink Price Feed Addresses (Ethereum Mainnet - for reference)
// For Monad testnet, you may need to deploy mock price feeds or use API fallbacks
const CHAINLINK_FEEDS = {
  // Mainnet Ethereum (for future multi-chain support)
  ethereum: {
    'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
    'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
    'DAI/USD': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
    'AAVE/USD': '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9',
    'UNI/USD': '0x553303d460EE0afB37EdFf9bE42922D8FF63220e',
    'SOL/USD': '0x4ffC43a60e009B551865A93d232E33Fce9f01507',
    'MATIC/USD': '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676',
    'AVAX/USD': '0xFF3EEb22B22a6A6B64EDE6ad49CE10C8E7f45a86',
    'DOGE/USD': '0x2465CeF79C92C2F12D5f64B5F3a0B9C8E06C5E51',
    'SHIB/USD': '0x8dD1CD88F43aF196ae478e91b9F5E4Ac69A97C61',
    'ARB/USD': '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
    'OP/USD': '0x0D276FC14719f9292D5C1eA2198673d1f4269246',
  },
  // Sepolia testnet
  sepolia: {
    'ETH/USD': '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    'BTC/USD': '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43',
    'LINK/USD': '0xc59E3633BAAC79493d908e63626716e204A45EdF',
  },
  // Base Sepolia
  baseSepolia: {
    'ETH/USD': '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1',
    'BTC/USD': '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298',
  },
  // Monad testnet - use API fallback since no native Chainlink support yet
  monadTestnet: {},
};

// Token symbol to CoinGecko ID mapping
const COINGECKO_IDS = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'LINK': 'chainlink',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'DAI': 'dai',
  'AAVE': 'aave',
  'UNI': 'uniswap',
  'SOL': 'solana',
  'MATIC': 'matic-network',
  'AVAX': 'avalanche-2',
  'DOGE': 'dogecoin',
  'SHIB': 'shiba-inu',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'MON': 'monad', // If listed
  'PEPE': 'pepe',
  'WIF': 'dogwifcoin',
  'BONK': 'bonk',
};

// Token symbol to Binance pair mapping
const BINANCE_PAIRS = {
  'ETH': 'ETHUSDT',
  'BTC': 'BTCUSDT',
  'LINK': 'LINKUSDT',
  'SOL': 'SOLUSDT',
  'MATIC': 'MATICUSDT',
  'AVAX': 'AVAXUSDT',
  'DOGE': 'DOGEUSDT',
  'SHIB': 'SHIBUSDT',
  'ARB': 'ARBUSDT',
  'OP': 'OPUSDT',
  'AAVE': 'AAVEUSDT',
  'UNI': 'UNIUSDT',
  'PEPE': 'PEPEUSDT',
  'WIF': 'WIFUSDT',
  'BONK': 'BONKUSDT',
};

class ChainlinkService {
  constructor() {
    this.providers = {};
    this.feedCache = new Map(); // Cache feed data for 30 seconds
    this.CACHE_TTL = 30000; // 30 seconds
  }

  /**
   * Get provider for a specific network
   */
  getProvider(network = 'ethereum') {
    if (!this.providers[network]) {
      const rpcUrls = {
        ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        sepolia: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
        baseSepolia: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
        monadTestnet: process.env.RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
      };
      this.providers[network] = new ethers.JsonRpcProvider(rpcUrls[network]);
    }
    return this.providers[network];
  }

  /**
   * Get price from Chainlink on-chain feed
   */
  async getChainlinkPrice(pair, network = 'ethereum') {
    const feeds = CHAINLINK_FEEDS[network];
    if (!feeds || !feeds[pair]) {
      throw new Error(`No Chainlink feed for ${pair} on ${network}`);
    }

    const cacheKey = `chainlink_${network}_${pair}`;
    const cached = this.feedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const provider = this.getProvider(network);
      const feedAddress = feeds[pair];
      const aggregator = new ethers.Contract(feedAddress, CHAINLINK_AGGREGATOR_ABI, provider);

      const [roundData, decimals, description] = await Promise.all([
        aggregator.latestRoundData(),
        aggregator.decimals(),
        aggregator.description(),
      ]);

      const price = Number(roundData.answer) / Math.pow(10, Number(decimals));
      const updatedAt = Number(roundData.updatedAt);

      const result = {
        source: 'chainlink',
        pair,
        price,
        decimals: Number(decimals),
        roundId: roundData.roundId.toString(),
        updatedAt,
        updatedAtDate: new Date(updatedAt * 1000).toISOString(),
        description,
        feedAddress,
        network,
      };

      this.feedCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (error) {
      logger.error(`Chainlink price fetch failed for ${pair}:`, error.message);
      throw error;
    }
  }

  /**
   * Get price from CoinGecko API (fallback)
   */
  async getCoinGeckoPrice(token) {
    const coinId = COINGECKO_IDS[token.toUpperCase()];
    if (!coinId) {
      throw new Error(`No CoinGecko mapping for ${token}`);
    }

    const cacheKey = `coingecko_${token}`;
    const cached = this.feedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: {
            ids: coinId,
            vs_currencies: 'usd',
            include_last_updated_at: true,
          },
          timeout: 10000,
        }
      );

      const data = response.data[coinId];
      if (!data || data.usd === undefined) {
        throw new Error(`No price data for ${token}`);
      }

      const result = {
        source: 'coingecko',
        token,
        pair: `${token}/USD`,
        price: data.usd,
        updatedAt: data.last_updated_at,
        updatedAtDate: new Date(data.last_updated_at * 1000).toISOString(),
      };

      this.feedCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (error) {
      logger.error(`CoinGecko price fetch failed for ${token}:`, error.message);
      throw error;
    }
  }

  /**
   * Get price from Binance API (fallback)
   */
  async getBinancePrice(token) {
    const pair = BINANCE_PAIRS[token.toUpperCase()];
    if (!pair) {
      throw new Error(`No Binance mapping for ${token}`);
    }

    const cacheKey = `binance_${token}`;
    const cached = this.feedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await axios.get(
        `https://api.binance.com/api/v3/ticker/price`,
        {
          params: { symbol: pair },
          timeout: 10000,
        }
      );

      const price = parseFloat(response.data.price);

      const result = {
        source: 'binance',
        token,
        pair: `${token}/USD`,
        binancePair: pair,
        price,
        updatedAt: Math.floor(Date.now() / 1000),
        updatedAtDate: new Date().toISOString(),
      };

      this.feedCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (error) {
      logger.error(`Binance price fetch failed for ${token}:`, error.message);
      throw error;
    }
  }

  /**
   * Get price with automatic fallback
   * Priority: Chainlink -> CoinGecko -> Binance
   */
  async getPrice(token, options = {}) {
    const { network = 'ethereum', skipChainlink = false } = options;
    const pair = `${token.toUpperCase()}/USD`;
    
    const errors = [];

    // Try Chainlink first (if available for the network)
    if (!skipChainlink && CHAINLINK_FEEDS[network] && CHAINLINK_FEEDS[network][pair]) {
      try {
        const result = await this.getChainlinkPrice(pair, network);
        logger.debug(`Got ${token} price from Chainlink: $${result.price}`);
        return result;
      } catch (error) {
        errors.push({ source: 'chainlink', error: error.message });
      }
    }

    // Try CoinGecko
    if (COINGECKO_IDS[token.toUpperCase()]) {
      try {
        const result = await this.getCoinGeckoPrice(token);
        logger.debug(`Got ${token} price from CoinGecko: $${result.price}`);
        return result;
      } catch (error) {
        errors.push({ source: 'coingecko', error: error.message });
      }
    }

    // Try Binance
    if (BINANCE_PAIRS[token.toUpperCase()]) {
      try {
        const result = await this.getBinancePrice(token);
        logger.debug(`Got ${token} price from Binance: $${result.price}`);
        return result;
      } catch (error) {
        errors.push({ source: 'binance', error: error.message });
      }
    }

    // All sources failed
    const errorMsg = `Failed to get price for ${token}. Errors: ${JSON.stringify(errors)}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  /**
   * Get historical price at a specific timestamp
   * Uses Chainlink round data or API historical data
   */
  async getHistoricalPrice(token, timestamp, options = {}) {
    const { network = 'ethereum' } = options;
    const pair = `${token.toUpperCase()}/USD`;

    // Try Chainlink historical data
    if (CHAINLINK_FEEDS[network] && CHAINLINK_FEEDS[network][pair]) {
      try {
        const result = await this._getChainlinkHistoricalPrice(pair, timestamp, network);
        if (result) return result;
      } catch (error) {
        logger.debug(`Chainlink historical failed: ${error.message}`);
      }
    }

    // Fallback to CoinGecko historical
    try {
      const coinId = COINGECKO_IDS[token.toUpperCase()];
      if (!coinId) throw new Error(`No CoinGecko mapping for ${token}`);

      const date = new Date(timestamp * 1000);
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/${coinId}/history`,
        {
          params: { date: dateStr },
          timeout: 15000,
        }
      );

      if (response.data?.market_data?.current_price?.usd) {
        return {
          source: 'coingecko_historical',
          token,
          pair,
          price: response.data.market_data.current_price.usd,
          timestamp,
          date: dateStr,
        };
      }
    } catch (error) {
      logger.error(`Historical price fetch failed for ${token}:`, error.message);
    }

    throw new Error(`Could not get historical price for ${token} at ${timestamp}`);
  }

  /**
   * Get Chainlink historical price by searching rounds
   */
  async _getChainlinkHistoricalPrice(pair, targetTimestamp, network) {
    const feeds = CHAINLINK_FEEDS[network];
    if (!feeds || !feeds[pair]) return null;

    const provider = this.getProvider(network);
    const feedAddress = feeds[pair];
    const aggregator = new ethers.Contract(feedAddress, CHAINLINK_AGGREGATOR_ABI, provider);

    const [latestRound, decimals] = await Promise.all([
      aggregator.latestRoundData(),
      aggregator.decimals(),
    ]);

    // Binary search to find the round closest to target timestamp
    let low = 1n;
    let high = latestRound.roundId;
    let closestRound = null;
    let closestDiff = BigInt(Number.MAX_SAFE_INTEGER);

    // Limit search iterations
    const maxIterations = 50;
    let iterations = 0;

    while (low <= high && iterations < maxIterations) {
      iterations++;
      const mid = (low + high) / 2n;

      try {
        const roundData = await aggregator.getRoundData(mid);
        const roundTimestamp = BigInt(roundData.updatedAt);
        const targetBigInt = BigInt(targetTimestamp);
        const diff = roundTimestamp > targetBigInt 
          ? roundTimestamp - targetBigInt 
          : targetBigInt - roundTimestamp;

        if (diff < closestDiff) {
          closestDiff = diff;
          closestRound = roundData;
        }

        if (roundTimestamp < targetBigInt) {
          low = mid + 1n;
        } else if (roundTimestamp > targetBigInt) {
          high = mid - 1n;
        } else {
          // Exact match
          break;
        }
      } catch {
        // Round might not exist, adjust search
        high = mid - 1n;
      }
    }

    if (closestRound) {
      const price = Number(closestRound.answer) / Math.pow(10, Number(decimals));
      return {
        source: 'chainlink_historical',
        pair,
        price,
        roundId: closestRound.roundId.toString(),
        timestamp: Number(closestRound.updatedAt),
        targetTimestamp,
        diffSeconds: Number(closestDiff),
        network,
      };
    }

    return null;
  }

  /**
   * Check if price touched a target during a time period
   * This is crucial for resolving "Will X reach $Y" type markets
   */
  async didPriceTouch(token, targetPrice, startTime, endTime, options = {}) {
    const { direction = 'above', network = 'ethereum' } = options;
    const pair = `${token.toUpperCase()}/USD`;
    
    logger.info(`Checking if ${token} touched $${targetPrice} (${direction}) between ${startTime} and ${endTime}`);

    // Try Chainlink round iteration first
    if (CHAINLINK_FEEDS[network] && CHAINLINK_FEEDS[network][pair]) {
      try {
        const result = await this._checkChainlinkPriceTouch(
          pair, targetPrice, startTime, endTime, direction, network
        );
        if (result !== null) return result;
      } catch (error) {
        logger.debug(`Chainlink price touch check failed: ${error.message}`);
      }
    }

    // Fallback: Check current price (simple check)
    try {
      const currentPrice = await this.getPrice(token, { network, skipChainlink: true });
      const touched = direction === 'above' 
        ? currentPrice.price >= targetPrice
        : currentPrice.price <= targetPrice;

      return {
        touched,
        price: currentPrice.price,
        source: currentPrice.source,
        timestamp: currentPrice.updatedAt,
        note: 'Simple current price check (no historical data available)',
      };
    } catch (error) {
      logger.error(`Price touch check failed for ${token}:`, error.message);
      throw error;
    }
  }

  /**
   * Check Chainlink rounds for price touch
   */
  async _checkChainlinkPriceTouch(pair, targetPrice, startTime, endTime, direction, network) {
    const feeds = CHAINLINK_FEEDS[network];
    if (!feeds || !feeds[pair]) return null;

    const provider = this.getProvider(network);
    const feedAddress = feeds[pair];
    const aggregator = new ethers.Contract(feedAddress, CHAINLINK_AGGREGATOR_ABI, provider);

    const [latestRound, decimals] = await Promise.all([
      aggregator.latestRoundData(),
      aggregator.decimals(),
    ]);

    const decimalDivisor = Math.pow(10, Number(decimals));
    const targetPriceScaled = targetPrice * decimalDivisor;

    // Find starting round (binary search for startTime)
    let currentRound = latestRound.roundId;
    let touched = false;
    let touchPrice = null;
    let touchTimestamp = null;
    let roundsChecked = 0;
    const maxRounds = 1000; // Limit to prevent excessive iteration

    while (currentRound > 0n && roundsChecked < maxRounds) {
      try {
        const roundData = await aggregator.getRoundData(currentRound);
        const roundTime = Number(roundData.updatedAt);
        const price = Number(roundData.answer);

        // Skip rounds outside our time window
        if (roundTime > endTime) {
          currentRound--;
          continue;
        }
        if (roundTime < startTime) {
          break; // We've gone past our window
        }

        roundsChecked++;

        // Check if price touched target
        const priceNum = price / decimalDivisor;
        const didTouch = direction === 'above'
          ? price >= targetPriceScaled
          : price <= targetPriceScaled;

        if (didTouch) {
          touched = true;
          touchPrice = priceNum;
          touchTimestamp = roundTime;
          break;
        }

        currentRound--;
      } catch {
        currentRound--;
      }
    }

    return {
      touched,
      touchPrice,
      touchTimestamp,
      touchTimestampDate: touchTimestamp ? new Date(touchTimestamp * 1000).toISOString() : null,
      targetPrice,
      direction,
      source: 'chainlink',
      roundsChecked,
      network,
    };
  }

  /**
   * Get supported tokens list
   */
  getSupportedTokens() {
    const chainlinkTokens = new Set();
    Object.values(CHAINLINK_FEEDS).forEach(feeds => {
      Object.keys(feeds).forEach(pair => {
        const token = pair.split('/')[0];
        chainlinkTokens.add(token);
      });
    });

    return {
      chainlink: Array.from(chainlinkTokens),
      coingecko: Object.keys(COINGECKO_IDS),
      binance: Object.keys(BINANCE_PAIRS),
      all: [...new Set([
        ...Array.from(chainlinkTokens),
        ...Object.keys(COINGECKO_IDS),
        ...Object.keys(BINANCE_PAIRS),
      ])],
    };
  }

  /**
   * Validate price feed availability for a token
   */
  async validateToken(token) {
    const tokenUpper = token.toUpperCase();
    const sources = [];

    // Check Chainlink
    for (const [network, feeds] of Object.entries(CHAINLINK_FEEDS)) {
      if (feeds[`${tokenUpper}/USD`]) {
        sources.push({ source: 'chainlink', network });
      }
    }

    // Check CoinGecko
    if (COINGECKO_IDS[tokenUpper]) {
      sources.push({ source: 'coingecko', id: COINGECKO_IDS[tokenUpper] });
    }

    // Check Binance
    if (BINANCE_PAIRS[tokenUpper]) {
      sources.push({ source: 'binance', pair: BINANCE_PAIRS[tokenUpper] });
    }

    return {
      token: tokenUpper,
      supported: sources.length > 0,
      sources,
    };
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.feedCache.clear();
    logger.info('Price feed cache cleared');
  }
}

module.exports = new ChainlinkService();
