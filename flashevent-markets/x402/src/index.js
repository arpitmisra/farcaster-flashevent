const { ethers } = require('ethers');
const X402Client = require('./client');
const X402Server = require('./server');
const utils = require('./utils');

/**
 * x402 Protocol Implementation for FlashEvent Markets
 * 
 * x402 enables instant micropayments without deposits by using
 * HTTP headers to authorize and verify payments.
 * 
 * Protocol Flow:
 * 1. Client makes request to paid endpoint
 * 2. Server returns 402 Payment Required with price info in headers
 * 3. Client signs payment authorization using EIP-712 typed data
 * 4. Client resends request with X-402-Payment header
 * 5. Server verifies signature, amount, recipient, chain, and nonce
 * 6. Server processes request and returns response with receipt
 * 
 * Security Features:
 * - EIP-712 typed data signatures (prevents signature malleability)
 * - Nonce tracking (prevents replay attacks)
 * - Deadline enforcement (prevents stale payments)
 * - Balance verification (optional, ensures payer can pay)
 * - Chain ID verification (prevents cross-chain attacks)
 */

// Default configuration for Monad testnet
const DEFAULT_CONFIG = {
  network: 'monad-testnet',
  chainId: 10143,
  rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
  paymentRecipient: null, // Must be set
  minPayment: ethers.parseEther('0.0001'),
  maxPayment: ethers.parseEther('10'),
  paymentTimeout: 300, // 5 minutes
  useEIP712: true,
  verifyBalance: true,
};

// Network configurations
const NETWORKS = {
  'monad-testnet': {
    chainId: 10143,
    rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
    explorer: 'https://testnet.monadexplorer.com',
  },
  'monad-mainnet': {
    chainId: 10142, // Placeholder - update when mainnet launches
    rpcUrl: 'https://rpc.monad.xyz',
    explorer: 'https://monadexplorer.com',
  },
  'sepolia': {
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
  },
  'base-sepolia': {
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
};

/**
 * Create x402 client for making paid requests
 * @param {Object} config - Client configuration
 * @returns {X402Client} Configured client instance
 */
function createClient(config = {}) {
  const networkConfig = NETWORKS[config.network] || NETWORKS['monad-testnet'];
  
  return new X402Client({
    ...DEFAULT_CONFIG,
    ...networkConfig,
    ...config,
  });
}

/**
 * Create x402 server middleware for Express
 * @param {Object} config - Server configuration
 * @returns {Function} Express middleware
 */
function createServerMiddleware(config = {}) {
  const networkConfig = NETWORKS[config.network] || NETWORKS['monad-testnet'];
  
  const server = new X402Server({
    ...DEFAULT_CONFIG,
    ...networkConfig,
    ...config,
  });
  
  return server.middleware();
}

/**
 * Create a full x402 server instance
 * @param {Object} config - Server configuration
 * @returns {X402Server} Server instance
 */
function createServer(config = {}) {
  const networkConfig = NETWORKS[config.network] || NETWORKS['monad-testnet'];
  
  return new X402Server({
    ...DEFAULT_CONFIG,
    ...networkConfig,
    ...config,
  });
}

/**
 * Price calculation utilities for FlashEvent Markets
 */
const pricing = {
  /**
   * Calculate fee based on bet amount (0.1% with minimum)
   */
  betFee(amount) {
    const value = BigInt(amount);
    const fee = (value * 10n) / 10000n; // 0.1%
    const minFee = ethers.parseEther('0.0001');
    return fee > minFee ? fee : minFee;
  },
  
  /**
   * Market creation fee
   */
  createMarketFee() {
    return ethers.parseEther('0.01');
  },
  
  /**
   * Premium analytics fee
   */
  analyticsFee() {
    return ethers.parseEther('0.005');
  },
  
  /**
   * Priority resolution fee
   */
  priorityResolutionFee() {
    return ethers.parseEther('0.02');
  },
  
  /**
   * Calculate dynamic fee based on demand
   */
  dynamicFee(baseFee, demandMultiplier = 1) {
    const base = BigInt(baseFee);
    const multiplier = BigInt(Math.floor(demandMultiplier * 100));
    return (base * multiplier) / 100n;
  },
};

/**
 * Operation types for pricing
 */
const OPERATIONS = {
  CREATE_MARKET: 'CREATE_MARKET',
  PLACE_BET: 'PLACE_BET',
  PREMIUM_ANALYTICS: 'PREMIUM_ANALYTICS',
  PRIORITY_RESOLUTION: 'PRIORITY_RESOLUTION',
  API_ACCESS: 'API_ACCESS',
};

/**
 * Default operation prices
 */
const OPERATION_PRICES = {
  [OPERATIONS.CREATE_MARKET]: ethers.parseEther('0.01'),
  [OPERATIONS.PLACE_BET]: ethers.parseEther('0.001'),
  [OPERATIONS.PREMIUM_ANALYTICS]: ethers.parseEther('0.005'),
  [OPERATIONS.PRIORITY_RESOLUTION]: ethers.parseEther('0.02'),
  [OPERATIONS.API_ACCESS]: ethers.parseEther('0.0001'),
};

module.exports = {
  // Factory functions
  createClient,
  createServer,
  createServerMiddleware,
  
  // Classes
  X402Client,
  X402Server,
  
  // Utilities
  ...utils,
  pricing,
  
  // Constants
  DEFAULT_CONFIG,
  NETWORKS,
  OPERATIONS,
  OPERATION_PRICES,
};
