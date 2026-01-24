const { ethers } = require('ethers');
const { getContract, getProvider, getFactoryWithSigner, getMarketContract, getAllMarkets } = require('../utils/blockchain');
const chainlinkService = require('./chainlinkService');
const sportsService = require('./sportsService');
const logger = require('../utils/logger');

/**
 * Market Resolution Service (BLOCKCHAIN-ONLY VERSION)
 * 
 * Resolves markets DIRECTLY from blockchain - NO MongoDB required!
 * 
 * Data Sources:
 * - MarketFactory.getAllMarkets() - Get all market addresses
 * - Market contract - Get expiry, result status, question
 * - Chainlink/CoinGecko/Binance - Price data for PRICE markets
 * - Sports APIs (TheSportsDB, ESPN, API-Football) - Sports data for SPORTS markets
 * 
 * Supported Market Types:
 * - PRICE_TOUCH (0): Crypto price predictions (uses Chainlink)
 * - ONCHAIN_EVENT (1): On-chain events (future implementation)
 * - SPORTS (2): Sports outcomes (uses Sports APIs)
 * 
 * Resolution Flow:
 * 1. Fetch all markets from MarketFactory on-chain
 * 2. Filter: expired + not resolved
 * 3. Detect market type from question
 * 4. Fetch data from appropriate oracle/API
 * 5. Determine outcome and resolve on-chain
 */

// Market Result enum matching smart contract
const MARKET_RESULT = {
  Pending: 0,
  Yes: 1,
  No: 2,
};

// Market types for resolution
const MARKET_TYPE = {
  PRICE: 'PRICE',
  SPORTS: 'SPORTS',
  UNKNOWN: 'UNKNOWN',
};

class ResolverService {
  constructor() {
    this.resolutionLock = new Map(); // Prevent concurrent resolution of same market
  }

  /**
   * Get markets pending resolution DIRECTLY FROM BLOCKCHAIN
   * No MongoDB required!
   * @param {number} limit - Max markets to return
   * @returns {Array} Markets that can be resolved
   */
  async getPendingMarkets(limit = 50) {
    const now = Math.floor(Date.now() / 1000);
    const pendingMarkets = [];
    
    try {
      // Get all market addresses from factory
      const marketAddresses = await getAllMarkets();
      logger.info(`Found ${marketAddresses.length} total markets on-chain`);
      
      // Check each market
      for (const address of marketAddresses) {
        if (pendingMarkets.length >= limit) break;
        
        try {
          const market = getMarketContract(address);
          
          // Fetch market data in parallel
          const [expiry, result, question] = await Promise.all([
            market.expiry(),
            market.result(),
            market.question(),
          ]);
          
          const expiryNum = Number(expiry);
          const resultNum = Number(result);
          
          // Check if expired and not yet resolved
          if (expiryNum < now && resultNum === MARKET_RESULT.Pending) {
            pendingMarkets.push({
              contractAddress: address,
              expiry: expiryNum,
              question: question,
              result: resultNum,
            });
            logger.debug(`Found pending market: ${address} - "${question.substring(0, 50)}..."`);
          }
        } catch (err) {
          logger.warn(`Error checking market ${address}: ${err.message}`);
        }
      }
      
      logger.info(`Found ${pendingMarkets.length} markets pending resolution`);
      return pendingMarkets;
      
    } catch (error) {
      logger.error('Error fetching pending markets from blockchain:', error.message);
      return [];
    }
  }

  /**
   * Get resolution data for a specific market (by contract address)
   */
  async getResolutionData(marketAddress) {
    try {
      const market = getMarketContract(marketAddress);
      
      // Fetch all data in parallel
      const [expiry, result, question, totalYes, totalNo, creator] = await Promise.all([
        market.expiry(),
        market.result(),
        market.question(),
        market.totalYesBetsAmount(),
        market.totalNoBetsAmount(),
        market.creator(),
      ]);
      
      const now = Math.floor(Date.now() / 1000);
      const expiryNum = Number(expiry);
      const resultNum = Number(result);
      const canResolve = expiryNum < now && resultNum === MARKET_RESULT.Pending;
      
      const marketData = {
        contractAddress: marketAddress,
        question,
        expiry: expiryNum,
        result: resultNum,
        totalYesBetsAmount: ethers.formatEther(totalYes),
        totalNoBetsAmount: ethers.formatEther(totalNo),
        creator,
      };
      
      // Parse question to extract token/target for oracle
      let oracleData = null;
      let suggestedOutcome = null;
      
      if (canResolve) {
        try {
          const parsed = this._parseQuestion(question);
          if (parsed.token) {
            oracleData = await this._fetchOracleData(parsed);
            suggestedOutcome = this._determineOutcome(parsed, oracleData);
          }
        } catch (error) {
          logger.error(`Failed to fetch oracle data: ${error.message}`);
          oracleData = { error: error.message };
        }
      }
      
      return {
        market: marketData,
        oracleData,
        canResolve,
        suggestedOutcome,
        timeUntilResolution: canResolve ? 0 : expiryNum - now,
      };
      
    } catch (error) {
      logger.error(`Error getting resolution data for ${marketAddress}:`, error.message);
      throw error;
    }
  }

  /**
   * Resolve a market on-chain (by contract address)
   * @param {string} marketAddress - Market contract address
   * @param {boolean} outcome - true for YES, false for NO
   * @returns {Object} Resolution result
   */
  async resolveMarket(marketAddress, outcome) {
    // Prevent concurrent resolution
    if (this.resolutionLock.has(marketAddress)) {
      throw new Error('Market resolution already in progress');
    }
    
    this.resolutionLock.set(marketAddress, true);
    
    try {
      const market = getMarketContract(marketAddress);
      
      // Verify market state on-chain
      const [expiry, result, question] = await Promise.all([
        market.expiry(),
        market.result(),
        market.question(),
      ]);
      
      const expiryNum = Number(expiry);
      const resultNum = Number(result);
      const now = Math.floor(Date.now() / 1000);
      
      if (resultNum !== MARKET_RESULT.Pending) {
        throw new Error('Market already resolved on-chain');
      }
      
      if (expiryNum > now) {
        throw new Error(`Market not yet ended. Ends in ${expiryNum - now} seconds`);
      }

      // Convert outcome to contract enum
      const resultEnum = outcome ? MARKET_RESULT.Yes : MARKET_RESULT.No;
      
      logger.info(`Resolving market ${marketAddress} with outcome: ${outcome ? 'YES' : 'NO'}`);
      logger.info(`Question: ${question.substring(0, 80)}...`);
      
      // Get factory with signer and resolve
      const factoryWithSigner = getFactoryWithSigner();
      
      // Estimate gas first
      let gasEstimate;
      try {
        gasEstimate = await factoryWithSigner.resolveMarket.estimateGas(
          marketAddress,
          resultEnum
        );
      } catch (estimateError) {
        const errorMsg = estimateError.message || '';
        if (errorMsg.includes('MarketAlreadyResolved')) {
          throw new Error('Market already resolved on blockchain');
        }
        throw estimateError;
      }
      
      // Add 20% buffer to gas estimate
      const gasLimit = (gasEstimate * 120n) / 100n;
      
      const tx = await factoryWithSigner.resolveMarket(
        marketAddress,
        resultEnum,
        { gasLimit }
      );
      
      logger.info(`Resolution tx submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      
      if (receipt.status !== 1) {
        throw new Error('Resolution transaction failed');
      }
      
      logger.info(`✅ Market ${marketAddress} resolved successfully`, {
        outcome: outcome ? 'YES' : 'NO',
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      });
      
      return {
        success: true,
        txHash: receipt.hash,
        marketAddress,
        outcome,
        outcomeString: outcome ? 'YES' : 'NO',
        gasUsed: receipt.gasUsed.toString(),
      };
      
    } catch (error) {
      logger.error(`Market ${marketAddress} resolution failed:`, error.message);
      throw error;
    } finally {
      this.resolutionLock.delete(marketAddress);
    }
  }

  /**
   * Auto-resolve market based on oracle data (BLOCKCHAIN-ONLY)
   * Supports both PRICE and SPORTS market types
   * @param {Object} marketData - Market data from getPendingMarkets
   * @returns {Object} Resolution result
   */
  async autoResolveMarket(marketData) {
    const { contractAddress, question } = marketData;
    
    // Parse question to extract market data (works for both price and sports)
    const parsed = this._parseQuestion(question);
    
    // Validate based on market type
    if (parsed.marketType === MARKET_TYPE.PRICE && !parsed.token) {
      throw new Error(`Could not parse PRICE market question: "${question}"`);
    }
    if (parsed.marketType === MARKET_TYPE.SPORTS && !parsed.team1) {
      throw new Error(`Could not parse SPORTS market question: "${question}"`);
    }
    if (parsed.marketType === MARKET_TYPE.UNKNOWN) {
      throw new Error(`Unknown market type for question: "${question}"`);
    }
    
    // Fetch data based on market type
    let oracleData;
    if (parsed.marketType === MARKET_TYPE.SPORTS) {
      oracleData = await this._fetchSportsData(parsed);
    } else {
      oracleData = await this._fetchOracleData(parsed);
    }
    
    // Determine outcome based on market type
    const outcome = this._determineOutcome(parsed, oracleData);
    
    if (outcome === null) {
      throw new Error('Could not determine outcome from oracle data');
    }
    
    logger.info(`Auto-resolving market ${contractAddress}`, {
      question: question.substring(0, 80),
      marketType: parsed.marketType,
      token: parsed.token,
      targetPrice: parsed.targetPrice,
      currentPrice: oracleData?.currentPrice,
      outcome: outcome ? 'YES' : 'NO',
    });
    
    // Resolve with determined outcome
    return this.resolveMarket(contractAddress, outcome);
  }

  /**
   * Detect market type from question
   * @param {string} question - Market question
   * @returns {string} Market type: PRICE, SPORTS, or UNKNOWN
   */
  _detectMarketType(question) {
    const upperQuestion = question.toUpperCase();
    
    // Sports keywords
    const sportsKeywords = [
      'WIN', 'BEAT', 'DEFEAT', 'VS', 'VERSUS', 'MATCH', 'GAME',
      'FOOTBALL', 'SOCCER', 'CRICKET', 'NBA', 'NFL', 'MLB',
      'PREMIER LEAGUE', 'LA LIGA', 'CHAMPIONS LEAGUE', 'IPL',
      'WORLD CUP', 'SUPER BOWL', 'FINALS', 'PLAYOFF',
      'MANCHESTER', 'LIVERPOOL', 'CHELSEA', 'ARSENAL', 'BARCELONA', 'REAL MADRID',
      'LAKERS', 'WARRIORS', 'CELTICS', 'BULLS', 'HEAT',
      'INDIA', 'AUSTRALIA', 'ENGLAND', 'PAKISTAN',
      'WIMBLEDON', 'US OPEN', 'GRAND SLAM',
    ];
    
    // Price keywords
    const priceKeywords = ['$', 'PRICE', 'ETH', 'BTC', 'SOL', 'TOUCH', 'REACH', 'HIT'];
    
    // Check for sports
    const hasSportsKeyword = sportsKeywords.some(kw => upperQuestion.includes(kw));
    const hasVsPattern = /\bVS\.?\b|\bVERSUS\b|\bAGAINST\b|\bBEAT\b/i.test(question);
    
    // Check for price
    const hasPriceKeyword = priceKeywords.some(kw => upperQuestion.includes(kw));
    const hasDollarSign = question.includes('$');
    
    // Determine type
    if ((hasSportsKeyword || hasVsPattern) && !hasDollarSign) {
      return MARKET_TYPE.SPORTS;
    } else if (hasPriceKeyword || hasDollarSign) {
      return MARKET_TYPE.PRICE;
    }
    
    return MARKET_TYPE.UNKNOWN;
  }

  /**
   * Parse market question to extract relevant data based on market type
   * Handles both PRICE and SPORTS markets
   */
  _parseQuestion(question) {
    const marketType = this._detectMarketType(question);
    
    if (marketType === MARKET_TYPE.SPORTS) {
      return this._parseSportsQuestion(question);
    } else {
      return this._parsePriceQuestion(question);
    }
  }

  /**
   * Parse price market question
   * Examples:
   * - "Will ETH touch $4000 by Jan 2026?"
   * - "Will BTC be above $100000?"
   * - "ETH > $3500 by end of month"
   */
  _parsePriceQuestion(question) {
    const result = {
      marketType: MARKET_TYPE.PRICE,
      token: null,
      targetPrice: null,
      direction: 'above', // default
      type: 'PRICE_TOUCH',
    };
    
    // Common token patterns
    const tokens = ['ETH', 'BTC', 'SOL', 'LINK', 'AAVE', 'UNI', 'MATIC', 'AVAX', 
                    'DOGE', 'SHIB', 'ARB', 'OP', 'PEPE', 'WIF', 'BONK', 'MON'];
    
    const upperQuestion = question.toUpperCase();
    
    // Find token
    for (const token of tokens) {
      if (upperQuestion.includes(token)) {
        result.token = token;
        break;
      }
    }
    
    // Find price - look for $ followed by numbers
    const priceMatch = question.match(/\$([0-9,]+(?:\.[0-9]+)?)/);
    if (priceMatch) {
      result.targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
    
    // Determine direction
    if (upperQuestion.includes('BELOW') || upperQuestion.includes('UNDER') || 
        upperQuestion.includes('< ') || upperQuestion.includes('DROP')) {
      result.direction = 'below';
    }
    
    logger.debug(`Parsed PRICE question: "${question.substring(0, 50)}..."`, result);
    
    return result;
  }

  /**
   * Parse sports market question
   * Examples:
   * - "Will Manchester United win against Liverpool?"
   * - "Will India beat Australia?"
   * - "Lakers vs Warriors - will Lakers win?"
   */
  _parseSportsQuestion(question) {
    const sportsData = sportsService.parseQuestion(question);
    
    const result = {
      marketType: MARKET_TYPE.SPORTS,
      team1: sportsData.team1,
      team2: sportsData.team2,
      sport: sportsData.sport,
      questionType: sportsData.questionType,
      targetValue: sportsData.targetValue,
    };
    
    logger.debug(`Parsed SPORTS question: "${question.substring(0, 50)}..."`, result);
    
    return result;
  }


  /**
   * Fetch oracle data for PRICE markets (BLOCKCHAIN-ONLY)
   * @param {Object} parsed - Parsed question with token, targetPrice, direction
   */
  async _fetchOracleData(parsed) {
    const { token, targetPrice, direction } = parsed;
    
    if (!token) {
      throw new Error('No token found in market question');
    }
    
    logger.debug(`Fetching price for ${token}, target: $${targetPrice}`);
    
    try {
      // Get current price from oracle
      const priceData = await chainlinkService.getPrice(token);
      
      // Determine if target was reached
      const isAbove = direction !== 'below';
      const touched = isAbove 
        ? priceData.price >= targetPrice
        : priceData.price <= targetPrice;
      
      return {
        type: 'PRICE_TOUCH',
        marketType: MARKET_TYPE.PRICE,
        token,
        targetPrice,
        direction,
        currentPrice: priceData.price,
        source: priceData.source,
        touched,
        timestamp: Math.floor(Date.now() / 1000),
      };
      
    } catch (error) {
      logger.error(`Price data fetch failed for ${token}:`, error.message);
      throw new Error(`Failed to get price for ${token}: ${error.message}`);
    }
  }

  /**
   * Fetch sports data from sports API
   * @param {Object} parsed - Parsed sports question with team1, team2, sport
   */
  async _fetchSportsData(parsed) {
    const { team1, team2, sport, questionType, targetValue } = parsed;
    
    if (!team1) {
      throw new Error('No team found in sports market question');
    }
    
    logger.debug(`Fetching sports data for ${team1} vs ${team2 || 'opponent'}, sport: ${sport}`);
    
    try {
      // Get match result from sports API
      const matchResult = await sportsService.getMatchResult(team1, team2, sport);
      
      if (!matchResult.found) {
        throw new Error(`Match result not found for ${team1} vs ${team2}`);
      }
      
      return {
        type: 'SPORTS',
        marketType: MARKET_TYPE.SPORTS,
        team1,
        team2,
        sport,
        questionType,
        targetValue,
        matchResult,
        timestamp: Math.floor(Date.now() / 1000),
      };
      
    } catch (error) {
      logger.error(`Sports data fetch failed for ${team1} vs ${team2}:`, error.message);
      throw new Error(`Failed to get sports data: ${error.message}`);
    }
  }

  /**
   * Determine market outcome based on oracle/sports data (BLOCKCHAIN-ONLY)
   * @param {Object} parsed - Parsed question data
   * @param {Object} oracleData - Oracle/sports data
   * @returns {boolean|null} true=YES, false=NO, null=unknown
   */
  _determineOutcome(parsed, oracleData) {
    if (!oracleData) {
      logger.warn('No oracle/sports data available');
      return null;
    }
    
    // For price markets: YES if target was touched/reached
    if (oracleData.marketType === MARKET_TYPE.PRICE || oracleData.type === 'PRICE_TOUCH') {
      const result = oracleData.touched === true;
      logger.info(`PRICE Outcome: ${parsed.token} @ $${oracleData.currentPrice}, ` +
                  `target $${parsed.targetPrice} ${parsed.direction} => ${result ? 'YES' : 'NO'}`);
      return result;
    }
    
    // For sports markets: Use sportsService to determine outcome
    if (oracleData.marketType === MARKET_TYPE.SPORTS || oracleData.type === 'SPORTS') {
      const result = sportsService.determineOutcome(
        parsed.team1,
        parsed.team2,
        oracleData.matchResult,
        parsed.questionType,
        parsed.targetValue
      );
      
      logger.info(`SPORTS Outcome: ${parsed.team1} vs ${parsed.team2}, ` +
                  `result: ${oracleData.matchResult.score || 'N/A'} => ${result ? 'YES' : 'NO'}`);
      return result;
    }
    
    return null;
  }

  /**
   * Get on-chain event data
   */
  async _getOnchainEventData(params) {
    const { contractAddress, eventSelector, minCount = 1 } = params;
    
    if (!contractAddress || !eventSelector) {
      throw new Error('Missing contractAddress or eventSelector');
    }
    
    try {
      const provider = getProvider();
      
      const logs = await provider.getLogs({
        address: contractAddress,
        topics: [eventSelector],
        fromBlock: 'earliest',
        toBlock: 'latest',
      });
      
      return {
        type: 'ONCHAIN_EVENT',
        contractAddress,
        eventSelector,
        eventFound: logs.length >= minCount,
        logCount: logs.length,
        minCount,
        latestLog: logs.length > 0 ? {
          blockNumber: logs[logs.length - 1].blockNumber,
          transactionHash: logs[logs.length - 1].transactionHash,
        } : null,
        timestamp: Math.floor(Date.now() / 1000),
      };
      
    } catch (error) {
      logger.error(`On-chain event fetch failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get API data
   */
  async _getAPIData(params) {
    const { apiEndpoint, threshold, jsonPath } = params;
    
    if (!apiEndpoint) {
      throw new Error('Missing apiEndpoint');
    }
    
    try {
      const response = await axios.get(apiEndpoint, {
        timeout: 15000,
        headers: {
          'User-Agent': 'FlashEvent-Market-Resolver/1.0',
        },
      });
      
      // Extract value from response
      let value;
      if (jsonPath) {
        // Simple JSON path extraction (e.g., "data.count")
        value = jsonPath.split('.').reduce((obj, key) => obj?.[key], response.data);
      } else {
        value = this._extractValueFromResponse(response.data);
      }
      
      const numericValue = parseFloat(value) || 0;
      const reached = threshold !== undefined ? numericValue >= threshold : numericValue > 0;
      
      return {
        type: 'API_COUNT',
        apiEndpoint,
        value: numericValue,
        threshold,
        reached,
        rawResponse: typeof response.data === 'object' 
          ? JSON.stringify(response.data).slice(0, 500) 
          : String(response.data).slice(0, 500),
        timestamp: Math.floor(Date.now() / 1000),
      };
      
    } catch (error) {
      logger.error(`API fetch failed:`, error.message);
      throw error;
    }
  }

  /**
   * Extract numeric value from API response
   */
  _extractValueFromResponse(data) {
    if (typeof data === 'number') return data;
    if (typeof data === 'string') return parseFloat(data) || 0;
    if (typeof data === 'object' && data !== null) {
      // Try common patterns
      return data.count ?? data.value ?? data.total ?? 
             data.result ?? data.data ?? data.amount ?? 0;
    }
    return 0;
  }

  /**
   * Determine market outcome based on type and oracle data
   */
  _determineOutcome(market, oracleData) {
    if (!oracleData) {
      logger.warn(`No oracle data for market ${market.marketId}`);
      return null;
    }
    
    switch (market.type) {
      case 'PRICE_TOUCH':
        // YES if price touched/reached target, NO otherwise
        return oracleData.touched === true;
        
      case 'ONCHAIN_EVENT':
        // YES if event was found, NO otherwise
        return oracleData.eventFound === true;
        
      case 'API_COUNT':
        // YES if threshold was reached, NO otherwise
        return oracleData.reached === true;
        
      default:
        logger.warn(`Cannot determine outcome for unknown type: ${market.type}`);
        return null;
    }
  }

  /**
   * Get oracle data for market type (public API)
   */
  async getOracleData(type, params) {
    switch (type) {
      case 'PRICE_TOUCH':
      case 'PRICE':
        return this._getPriceData({ type: 'PRICE_TOUCH' }, params);
        
      case 'ONCHAIN_EVENT':
        return this._getOnchainEventData(params);
        
      case 'API_COUNT':
        return this._getAPIData(params);
        
      default:
        throw new Error(`Unknown market type: ${type}`);
    }
  }

  /**
   * Get current price for a token (simplified API)
   */
  async getPrice(token) {
    return chainlinkService.getPrice(token);
  }

  /**
   * Validate market parameters
   */
  async validateMarketParams(type, params) {
    switch (type) {
      case 'PRICE_TOUCH': {
        const { token, targetPrice } = params;
        if (!token) return { valid: false, error: 'Token is required' };
        if (!targetPrice || targetPrice <= 0) {
          return { valid: false, error: 'Valid targetPrice is required' };
        }
        
        // Validate token is supported
        const validation = await chainlinkService.validateToken(token);
        if (!validation.supported) {
          return { valid: false, error: `Token ${token} is not supported` };
        }
        
        return { valid: true, sources: validation.sources };
      }
        
      case 'ONCHAIN_EVENT': {
        const { contractAddress, eventSelector } = params;
        if (!contractAddress || !ethers.isAddress(contractAddress)) {
          return { valid: false, error: 'Valid contractAddress is required' };
        }
        if (!eventSelector || !eventSelector.startsWith('0x')) {
          return { valid: false, error: 'Valid eventSelector is required' };
        }
        return { valid: true };
      }
        
      case 'API_COUNT': {
        const { apiEndpoint } = params;
        if (!apiEndpoint) {
          return { valid: false, error: 'apiEndpoint is required' };
        }
        try {
          new URL(apiEndpoint);
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid API endpoint URL' };
        }
      }
        
      default:
        return { valid: false, error: `Unknown market type: ${type}` };
    }
  }

  /**
   * Get supported tokens
   */
  getSupportedTokens() {
    return chainlinkService.getSupportedTokens();
  }
}

module.exports = new ResolverService();
