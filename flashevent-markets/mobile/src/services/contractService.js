/**
 * Contract Service - Smart contract interactions for Foundry-deployed contracts
 * Integrates with WalletContext for signing transactions via MetaMask
 */

import { ethers } from 'ethers';
import {
  MARKET_FACTORY_ABI,
  MARKET_ABI,
  MARKET_RESULT,
  CONTRACT_ADDRESSES,
  NETWORK_CONFIG,
} from '../config/contracts';

// Logger
const logger = {
  info: (msg, data) => console.log('[ContractService]', msg, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error('[ContractService]', msg, data ? JSON.stringify(data) : ''),
  debug: (msg, data) => console.log('[ContractService:DEBUG]', msg, data ? JSON.stringify(data) : ''),
};

class ContractService {
  constructor() {
    this.provider = null;
    this.marketFactory = null;
    this.walletContext = null; // Will be set by setWalletContext
    this.initProvider();
  }

  /**
   * Initialize the read-only JSON-RPC provider
   */
  initProvider() {
    try {
      const rpcUrl = NETWORK_CONFIG.rpcUrl;
      const factoryAddress = CONTRACT_ADDRESSES.MARKET_FACTORY;
      
      logger.info('Initializing provider', { 
        rpcUrl,
        factoryAddress,
        envAddress: process.env.EXPO_PUBLIC_MARKET_FACTORY_ADDRESS || 'not set'
      });

      this.provider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: NETWORK_CONFIG.chainId,
        name: 'monad-testnet',
      });

      // Initialize factory contract (read-only)
      this.marketFactory = new ethers.Contract(
        factoryAddress,
        MARKET_FACTORY_ABI,
        this.provider
      );

      logger.info('Provider initialized successfully', { factoryAddress });
      
      // Verify contract exists by calling a view function
      this.verifyContract();
    } catch (error) {
      logger.error('Failed to initialize provider', { error: error.message });
    }
  }
  
  /**
   * Verify the contract exists at the configured address
   */
  async verifyContract() {
    try {
      const code = await this.provider.getCode(CONTRACT_ADDRESSES.MARKET_FACTORY);
      if (code === '0x' || code === '0x0') {
        logger.error('Contract not found at address', { address: CONTRACT_ADDRESSES.MARKET_FACTORY });
      } else {
        logger.info('Contract verified', { 
          address: CONTRACT_ADDRESSES.MARKET_FACTORY,
          codeLength: code.length 
        });
      }
    } catch (error) {
      logger.error('Failed to verify contract', { error: error.message });
    }
  }

  /**
   * Set the wallet context for signing transactions
   * This should be called from a component that has access to WalletContext
   */
  setWalletContext(context) {
    this.walletContext = context;
    logger.info('Wallet context set', { 
      isConnected: context?.isConnected, 
      address: context?.address 
    });
  }

  /**
   * Check if wallet is connected and ready for transactions
   */
  isWalletReady() {
    return this.walletContext?.isConnected && this.walletContext?.address;
  }

  /**
   * Get a read-only market contract instance
   */
  getMarketContract(marketAddress) {
    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }
    return new ethers.Contract(marketAddress, MARKET_ABI, this.provider);
  }

  /**
   * Encode function data for a contract call
   */
  encodeFunctionData(abi, functionName, args) {
    const iface = new ethers.Interface(abi);
    return iface.encodeFunctionData(functionName, args);
  }

  // ============================================
  // MARKET FACTORY FUNCTIONS
  // ============================================

  /**
   * Create a new market via factory
   * @param {string} question - The market question
   * @param {number|BigInt} expiryTimestamp - Unix timestamp when market expires
   * @param {number|BigInt} bettingDeadline - Optional: Unix timestamp when betting closes (defaults to 15 min before expiry)
   * @returns {Promise<{txHash: string, marketAddress: string}>}
   */
  async createMarket(question, expiryTimestamp, bettingDeadline = null) {
    if (!this.isWalletReady()) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet.');
    }

    logger.info('Creating market', { question, expiryTimestamp: expiryTimestamp.toString() });

    // Ensure expiry is a BigInt
    const expiry = BigInt(expiryTimestamp);
    
    // Default betting deadline: 15 minutes before expiry (minimum lock duration)
    const DEFAULT_LOCK_DURATION = BigInt(15 * 60); // 15 minutes in seconds
    const actualBettingDeadline = bettingDeadline 
      ? BigInt(bettingDeadline) 
      : (expiry - DEFAULT_LOCK_DURATION);

    // Encode the function call with bettingDeadline
    const data = this.encodeFunctionData(
      MARKET_FACTORY_ABI,
      'createMarket',
      [question, expiry, actualBettingDeadline]
    );

    logger.debug('Encoded data', { 
      to: CONTRACT_ADDRESSES.MARKET_FACTORY,
      dataLength: data.length,
      data: data.slice(0, 74) + '...' // Show function selector + first param
    });

    // Send transaction via WalletContext
    const txResult = await this.walletContext.sendTransaction({
      to: CONTRACT_ADDRESSES.MARKET_FACTORY,
      data: data,
      value: '0x0',
    });

    const txHash = txResult.hash || txResult.transactionHash || txResult;
    logger.info('Transaction sent', { txHash });

    // Get full receipt to extract market address
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    // Parse MarketCreated event
    let marketAddress = null;
    const factoryInterface = new ethers.Interface(MARKET_FACTORY_ABI);
    
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = factoryInterface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          if (parsed?.name === 'MarketCreated') {
            marketAddress = parsed.args.market;
            logger.info('Market created', { marketAddress });
            break;
          }
        } catch (e) {
          // Not a MarketCreated event
        }
      }
    }

    // Fallback: get latest market from factory
    if (!marketAddress) {
      const count = await this.marketFactory.marketsCount();
      if (count > 0n) {
        marketAddress = await this.marketFactory.getMarket(count - 1n);
        logger.info('Got market from factory', { marketAddress });
      }
    }

    return { txHash, marketAddress };
  }

  // ============================================
  // BETTING FUNCTIONS
  // ============================================

  /**
   * Place a YES bet on a market
   * @param {string} marketAddress - The market contract address
   * @param {string|number} amount - Amount in ETH/MON to bet
   * @returns {Promise<{txHash: string, marketAddress: string, side: string, amount: string}>}
   */
  async placeYes(marketAddress, amount) {
    if (!this.isWalletReady()) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet.');
    }

    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }

    const amountStr = amount.toString();
    const valueWei = ethers.parseEther(amountStr);
    
    logger.info('Placing YES bet', { 
      marketAddress, 
      amount: amountStr,
      valueWei: valueWei.toString()
    });

    // Encode the function call - placeYes() takes no arguments
    const data = this.encodeFunctionData(MARKET_ABI, 'placeYes', []);

    // Send transaction with value
    const txResult = await this.walletContext.sendTransaction({
      to: marketAddress,
      data: data,
      value: ethers.toQuantity(valueWei), // Convert to hex
    });

    const txHash = txResult.hash || txResult.transactionHash || txResult;
    logger.info('YES bet placed', { txHash });

    return {
      txHash,
      marketAddress,
      side: 'YES',
      amount: amountStr,
    };
  }

  /**
   * Place a NO bet on a market
   * @param {string} marketAddress - The market contract address  
   * @param {string|number} amount - Amount in ETH/MON to bet
   * @returns {Promise<{txHash: string, marketAddress: string, side: string, amount: string}>}
   */
  async placeNo(marketAddress, amount) {
    if (!this.isWalletReady()) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet.');
    }

    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }

    const amountStr = amount.toString();
    const valueWei = ethers.parseEther(amountStr);
    
    logger.info('Placing NO bet', { 
      marketAddress, 
      amount: amountStr,
      valueWei: valueWei.toString()
    });

    // Encode the function call - placeNo() takes no arguments
    const data = this.encodeFunctionData(MARKET_ABI, 'placeNo', []);

    // Send transaction with value
    const txResult = await this.walletContext.sendTransaction({
      to: marketAddress,
      data: data,
      value: ethers.toQuantity(valueWei), // Convert to hex
    });

    const txHash = txResult.hash || txResult.transactionHash || txResult;
    logger.info('NO bet placed', { txHash });

    return {
      txHash,
      marketAddress,
      side: 'NO',
      amount: amountStr,
    };
  }

  /**
   * Place a bet (convenience method)
   * @param {string} marketAddress - The market contract address
   * @param {boolean|string} side - true/'yes'/'YES' for YES, false/'no'/'NO' for NO
   * @param {string|number} amount - Amount in ETH/MON to bet
   */
  async placeBet(marketAddress, side, amount) {
    const isYes = side === true || side === 'yes' || side === 'YES';
    
    if (isYes) {
      return this.placeYes(marketAddress, amount);
    } else {
      return this.placeNo(marketAddress, amount);
    }
  }

  // ============================================
  // CLAIM FUNCTIONS
  // ============================================

  /**
   * Claim winnings from a resolved market
   * @param {string} marketAddress - The market contract address
   * @returns {Promise<{txHash: string, winnings: number, fee: number}>}
   */
  async claim(marketAddress) {
    if (!this.isWalletReady()) {
      throw new Error('Wallet not connected. Please connect your MetaMask wallet.');
    }

    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }

    logger.info('Claiming winnings', { marketAddress });

    // Encode the function call
    const data = this.encodeFunctionData(MARKET_ABI, 'claim', []);

    // Send transaction
    const txResult = await this.walletContext.sendTransaction({
      to: marketAddress,
      data: data,
      value: '0x0',
    });

    const txHash = txResult.hash || txResult.transactionHash || txResult;
    logger.info('Claim transaction sent', { txHash });

    // Get receipt and parse Claimed event
    const receipt = await this.provider.getTransactionReceipt(txHash);
    const marketInterface = new ethers.Interface(MARKET_ABI);

    let winnings = 0;
    let fee = 0;

    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = marketInterface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          if (parsed?.name === 'Claimed') {
            winnings = parseFloat(ethers.formatEther(parsed.args.winnings));
            fee = parseFloat(ethers.formatEther(parsed.args.fee));
            logger.info('Claimed', { winnings, fee });
            break;
          }
        } catch (e) {
          // Not a Claimed event
        }
      }
    }

    return { txHash, marketAddress, winnings, fee };
  }

  /**
   * Alias for claim
   */
  async claimWinnings(marketAddress) {
    return this.claim(marketAddress);
  }

  // ============================================
  // READ-ONLY FUNCTIONS (No wallet needed)
  // ============================================

  /**
   * Get market details from contract
   * @param {string} marketAddress - The market contract address
   */
  async getMarketDetails(marketAddress) {
    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }

    const market = this.getMarketContract(marketAddress);

    try {
      const [
        question,
        expiry,
        factory,
        result,
        totalYesBetsAmount,
        totalNoBetsAmount,
        totalYesBets,
        totalNoBets,
        protocolFeeBps,
        treasury,
        creator,
      ] = await Promise.all([
        market.question(),
        market.expiry(),
        market.factory(),
        market.result(),
        market.totalYesBetsAmount(),
        market.totalNoBetsAmount(),
        market.totalYesBets(),
        market.totalNoBets(),
        market.protocolFeeBps(),
        market.treasury(),
        market.creator(),
      ]);

      // Fetch bettingDeadline and isBettingOpen if available
      let bettingDeadline = 0;
      let isBettingOpen = true;
      
      try {
        bettingDeadline = await market.bettingDeadline();
        isBettingOpen = await market.isBettingOpen();
      } catch (e) {
        // Older contract version without betting deadline
        logger.debug('Betting deadline not available', { error: e.message });
        bettingDeadline = expiry; // Fallback to expiry
        isBettingOpen = Date.now() / 1000 < Number(expiry);
      }

      const [yesProbability, noProbability, isExpired, isResolved] = await Promise.all([
        market.getProbablityYes(),
        market.getProbablityNo(),
        market.getIsExpired(),
        market.getIsresolved(),
      ]);

      const yesPoolFloat = parseFloat(ethers.formatEther(totalYesBetsAmount));
      const noPoolFloat = parseFloat(ethers.formatEther(totalNoBetsAmount));

      return {
        address: marketAddress,
        question,
        expiry: Number(expiry),
        endTime: Number(expiry) * 1000, // Convert to milliseconds for JS Date
        bettingDeadline: Number(bettingDeadline),
        bettingDeadlineTime: Number(bettingDeadline) * 1000, // Convert to milliseconds
        isBettingOpen,
        factory,
        creator, // The actual creator address from contract
        result: Number(result),
        resolved: Number(result) !== MARKET_RESULT.Pending,
        outcome: Number(result) === MARKET_RESULT.Yes,
        yesPool: yesPoolFloat.toString(),
        noPool: noPoolFloat.toString(),
        totalPool: (yesPoolFloat + noPoolFloat).toString(),
        totalYesBets: Number(totalYesBets),
        totalNoBets: Number(totalNoBets),
        bettorCount: Number(totalYesBets) + Number(totalNoBets),
        protocolFeeBps: Number(protocolFeeBps),
        treasury,
        yesProbability: Number(yesProbability),
        noProbability: Number(noProbability),
        isExpired,
        isResolved,
        marketType: 0, // Default to PRICE_TOUCH for now
      };
    } catch (error) {
      logger.error('Failed to get market details', { marketAddress, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's position in a market
   */
  async getUserPosition(marketAddress, userAddress) {
    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }

    const market = this.getMarketContract(marketAddress);

    const [yesBets, noBets, hasVoted, hasClaimed] = await Promise.all([
      market.yesBets(userAddress),
      market.noBets(userAddress),
      market.hasVoted(userAddress),
      market.hasClaimed(userAddress),
    ]);

    const yesBetsAmount = parseFloat(ethers.formatEther(yesBets));
    const noBetsAmount = parseFloat(ethers.formatEther(noBets));

    return {
      yesBets: yesBetsAmount,
      noBets: noBetsAmount,
      totalBet: yesBetsAmount + noBetsAmount,
      hasVoted,
      hasClaimed,
      side: yesBetsAmount > 0 ? 'YES' : noBetsAmount > 0 ? 'NO' : null,
    };
  }

  /**
   * Get claimable amount for a user
   */
  async getClaimableAmount(marketAddress, userAddress) {
    if (!ethers.isAddress(marketAddress)) {
      throw new Error(`Invalid market address: ${marketAddress}`);
    }

    const market = this.getMarketContract(marketAddress);

    try {
      const [claimableAmount, feeDeducted] = await market.getClaimableAmount(userAddress);
      return {
        claimable: parseFloat(ethers.formatEther(claimableAmount)),
        fee: parseFloat(ethers.formatEther(feeDeducted)),
        canClaim: claimableAmount > 0n,
      };
    } catch (error) {
      return {
        claimable: 0,
        fee: 0,
        canClaim: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all markets from factory
   */
  async getAllMarkets() {
    if (!this.marketFactory) {
      throw new Error('Market factory not configured');
    }

    return await this.marketFactory.getAllMarkets();
  }

  /**
   * Get markets with pagination
   */
  async getMarkets(offset = 0, limit = 10) {
    if (!this.marketFactory) {
      throw new Error('Market factory not configured');
    }

    return await this.marketFactory.getMarkets(offset, limit);
  }

  /**
   * Get total market count
   */
  async getMarketsCount() {
    if (!this.marketFactory) {
      throw new Error('Market factory not configured');
    }

    try {
      logger.debug('Calling marketsCount', { 
        factoryAddress: CONTRACT_ADDRESSES.MARKET_FACTORY 
      });
      const count = await this.marketFactory.marketsCount();
      logger.debug('marketsCount result', { count: count.toString() });
      return Number(count);
    } catch (error) {
      logger.error('marketsCount failed', { 
        error: error.message,
        factoryAddress: CONTRACT_ADDRESSES.MARKET_FACTORY
      });
      throw error;
    }
  }

  /**
   * Get market by index
   */
  async getMarketByIndex(index) {
    if (!this.marketFactory) {
      throw new Error('Market factory not configured');
    }

    return await this.marketFactory.getMarket(index);
  }

  /**
   * Check if address is a valid market
   */
  async isValidMarket(marketAddress) {
    if (!this.marketFactory) {
      return false;
    }

    return await this.marketFactory.isValidMarket(marketAddress);
  }

  /**
   * Fetch multiple markets with details
   */
  async fetchMarketsWithDetails(limit = 20) {
    try {
      const count = await this.getMarketsCount();
      logger.info('Fetching markets', { totalCount: count, limit });
      
      if (count === 0) {
        logger.info('No markets found in factory');
        return [];
      }
      
      const markets = [];
      const fetchCount = Math.min(count, limit);

      for (let i = 0; i < fetchCount; i++) {
        try {
          const address = await this.getMarketByIndex(i);
          logger.debug(`Fetching market ${i}`, { address });
          const details = await this.getMarketDetails(address);
          markets.push(details);
        } catch (error) {
          logger.error(`Failed to fetch market ${i}`, { error: error.message });
        }
      }

      logger.info('Markets fetched successfully', { count: markets.length });
      return markets;
    } catch (error) {
      logger.error('Failed to fetch markets with details', { error: error.message });
      return [];
    }
  }

  /**
   * Get markets by filter (for HomeScreen)
   * @param {string} filter - 'trending', 'new', 'following', or pagination params
   */
  async getMarkets(filter = 'trending') {
    try {
      // If filter is a number, treat it as offset for pagination
      if (typeof filter === 'number') {
        const offset = filter;
        const limit = 10;
        return await this.marketFactory.getMarkets(offset, limit);
      }

      // Otherwise fetch all markets and filter
      const markets = await this.fetchMarketsWithDetails(50);

      // Sort based on filter
      switch (filter) {
        case 'trending':
          // Sort by total pool (most active)
          return markets.sort((a, b) => parseFloat(b.totalPool) - parseFloat(a.totalPool));
        
        case 'new':
          // Sort by expiry (newest first - highest expiry = created most recently)
          return markets.sort((a, b) => b.expiry - a.expiry);
        
        case 'following':
          // For now return all markets (would need user follow data)
          return markets;
        
        default:
          return markets;
      }
    } catch (error) {
      logger.error('Failed to get markets', { filter, error: error.message });
      return [];
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Get result label
   */
  getResultLabel(result) {
    switch (result) {
      case MARKET_RESULT.Pending:
        return 'Pending';
      case MARKET_RESULT.Yes:
        return 'Yes';
      case MARKET_RESULT.No:
        return 'No';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if demo mode (always false now)
   */
  isDemoMode() {
    return false;
  }
}

// Export singleton instance
export const contractService = new ContractService();
export default contractService;
