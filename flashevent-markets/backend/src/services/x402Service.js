const { ethers } = require('ethers');
const { redis } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * x402 Protocol Version
 */
const PROTOCOL_VERSION = '1.0';

/**
 * x402 operation prices (in wei)
 */
const OPERATION_PRICES = {
  CREATE_MARKET: ethers.parseEther('0.01'),
  PLACE_BET: ethers.parseEther('0.001'),
  PREMIUM_ANALYTICS: ethers.parseEther('0.005'),
  PRIORITY_RESOLUTION: ethers.parseEther('0.02'),
  API_ACCESS: ethers.parseEther('0.0001'),
};

/**
 * EIP-712 Domain for x402 payments
 */
const EIP712_DOMAIN = {
  name: 'FlashEvent x402',
  version: '1',
  chainId: parseInt(process.env.CHAIN_ID || '10143', 10),
};

/**
 * EIP-712 Payment type definition
 */
const PAYMENT_TYPES = {
  Payment: [
    { name: 'payer', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'operation', type: 'string' },
  ],
};

class X402Service {
  constructor() {
    this.provider = null;
    this.recipient = process.env.X402_RECIPIENT || process.env.PLATFORM_ADDRESS;
    this.chainId = parseInt(process.env.CHAIN_ID || '10143', 10);
    this.network = process.env.NETWORK || 'monad-testnet';
    this.rpcUrl = process.env.MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5';
  }

  /**
   * Initialize the provider
   */
  _getProvider() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    }
    return this.provider;
  }

  /**
   * Get price for an operation
   */
  async getOperationPrice(operation, params = {}) {
    const basePrice = OPERATION_PRICES[operation];
    
    if (!basePrice) {
      return {
        operation,
        price: '0',
        priceFormatted: '0',
        currency: 'ETH',
        supported: false,
        message: `Unknown operation: ${operation}`,
      };
    }
    
    // Apply dynamic pricing based on params
    let finalPrice = basePrice;
    
    if (operation === 'PLACE_BET' && params.amount) {
      // Scale fee with bet size (0.1% of bet amount)
      const betAmount = BigInt(params.amount);
      const percentageFee = (betAmount * 10n) / 10000n;
      finalPrice = percentageFee > basePrice ? percentageFee : basePrice;
    }
    
    // Apply demand multiplier if available
    if (params.demandMultiplier && params.demandMultiplier > 1) {
      const multiplier = BigInt(Math.floor(params.demandMultiplier * 100));
      finalPrice = (finalPrice * multiplier) / 100n;
    }
    
    return {
      operation,
      price: finalPrice.toString(),
      priceFormatted: ethers.formatEther(finalPrice),
      currency: 'ETH',
      supported: true,
      network: this.network,
      chainId: this.chainId,
      recipient: this.recipient,
      version: PROTOCOL_VERSION,
    };
  }
  
  /**
   * Verify x402 payment header with full validation
   */
  async verifyPayment(paymentHeader, requiredOperation = null, requiredAmount = null) {
    try {
      // Decode the payment header
      const decoded = this._decodePaymentHeader(paymentHeader);
      
      // Validate required fields
      this._validatePaymentFields(decoded);
      
      // Verify signature (EIP-712 or legacy)
      const signatureResult = await this._verifySignature(decoded);
      if (!signatureResult.valid) {
        return { 
          valid: false, 
          error: signatureResult.error || 'Invalid signature',
          code: 'INVALID_SIGNATURE',
        };
      }
      
      // Check recipient
      if (this.recipient && decoded.recipient.toLowerCase() !== this.recipient.toLowerCase()) {
        return { 
          valid: false, 
          error: 'Invalid recipient',
          code: 'INVALID_RECIPIENT',
        };
      }
      
      // Check chain ID
      if (decoded.chainId !== this.chainId) {
        return { 
          valid: false, 
          error: `Invalid chain ID: expected ${this.chainId}, got ${decoded.chainId}`,
          code: 'INVALID_CHAIN',
        };
      }
      
      // Check deadline
      const now = Math.floor(Date.now() / 1000);
      if (decoded.deadline < now) {
        return { 
          valid: false, 
          error: 'Payment expired',
          code: 'PAYMENT_EXPIRED',
        };
      }
      
      // Check required amount if specified
      if (requiredAmount) {
        const paymentAmount = BigInt(decoded.amount);
        const required = BigInt(requiredAmount);
        if (paymentAmount < required) {
          return { 
            valid: false, 
            error: `Insufficient amount: got ${ethers.formatEther(paymentAmount)}, need ${ethers.formatEther(required)}`,
            code: 'INSUFFICIENT_AMOUNT',
          };
        }
      }
      
      // Check if nonce has been used (prevent replay attacks)
      const nonceKey = `x402:nonce:${decoded.payer.toLowerCase()}:${decoded.nonce}`;
      const nonceUsed = await this._checkAndSetNonce(nonceKey);
      if (nonceUsed) {
        return { 
          valid: false, 
          error: 'Payment nonce already used',
          code: 'NONCE_REUSED',
        };
      }
      
      // Verify payer balance (optional, can be disabled for performance)
      if (process.env.X402_VERIFY_BALANCE !== 'false') {
        const balanceValid = await this._verifyBalance(decoded.payer, decoded.amount);
        if (!balanceValid) {
          return { 
            valid: false, 
            error: 'Insufficient payer balance',
            code: 'INSUFFICIENT_BALANCE',
          };
        }
      }
      
      // Create receipt
      const receiptId = this._generateReceiptId(decoded);
      await this._storeReceipt(receiptId, decoded);
      
      return {
        valid: true,
        receiptId,
        payer: decoded.payer,
        recipient: decoded.recipient,
        amount: decoded.amount,
        amountFormatted: ethers.formatEther(decoded.amount),
        operation: decoded.operation,
        timestamp: Date.now(),
        signatureMethod: signatureResult.method,
      };
    } catch (error) {
      logger.error('Payment verification failed:', error);
      return { 
        valid: false, 
        error: error.message,
        code: 'VERIFICATION_ERROR',
      };
    }
  }
  
  /**
   * Get payment receipt
   */
  async getReceipt(receiptId) {
    try {
      // Try cache first
      const cached = await this._getFromCache(`x402:receipt:${receiptId}`);
      if (cached) {
        return cached;
      }
      
      return null;
    } catch (error) {
      logger.error('Receipt fetch failed:', error);
      throw error;
    }
  }
  
  /**
   * Get available paid operations
   */
  async getAvailableOperations() {
    return Object.entries(OPERATION_PRICES).map(([operation, price]) => ({
      operation,
      price: price.toString(),
      priceFormatted: ethers.formatEther(price),
      currency: 'ETH',
      description: this._getOperationDescription(operation),
      network: this.network,
      chainId: this.chainId,
    }));
  }
  
  /**
   * Create payment required response headers
   */
  getPaymentRequiredHeaders(operation, customPrice = null) {
    const price = customPrice || OPERATION_PRICES[operation] || OPERATION_PRICES.API_ACCESS;
    
    return {
      'X-402-Version': PROTOCOL_VERSION,
      'X-402-Price': price.toString(),
      'X-402-Recipient': this.recipient,
      'X-402-Chain-ID': this.chainId.toString(),
      'X-402-Network': this.network,
      'X-402-Operation': operation,
      'X-402-Timeout': '300',
    };
  }
  
  /**
   * Create payment required response body
   */
  getPaymentRequiredBody(operation, customPrice = null) {
    const price = customPrice || OPERATION_PRICES[operation] || OPERATION_PRICES.API_ACCESS;
    
    return {
      error: 'Payment Required',
      code: 'PAYMENT_REQUIRED',
      version: PROTOCOL_VERSION,
      price: price.toString(),
      priceFormatted: ethers.formatEther(price),
      currency: 'ETH',
      recipient: this.recipient,
      chainId: this.chainId,
      network: this.network,
      operation,
      timeout: 300,
      instructions: 'Sign a payment authorization and include it in the X-402-Payment header',
    };
  }

  // Private methods
  
  _decodePaymentHeader(header) {
    if (!header || typeof header !== 'string') {
      throw new Error('Invalid payment header: must be a non-empty string');
    }
    
    try {
      // Support both base64 and base64url encoding
      let decoded;
      try {
        decoded = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
      } catch {
        decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
      }
      
      return {
        version: decoded.v || '1',
        payer: decoded.payer,
        recipient: decoded.recipient,
        amount: decoded.amount,
        chainId: parseInt(decoded.chainId, 10),
        deadline: parseInt(decoded.deadline, 10),
        nonce: decoded.nonce,
        signature: decoded.signature,
        operation: decoded.operation || 'default',
        timestamp: decoded.timestamp,
      };
    } catch (error) {
      throw new Error(`Failed to decode payment header: ${error.message}`);
    }
  }
  
  _validatePaymentFields(payment) {
    const required = ['payer', 'recipient', 'amount', 'chainId', 'deadline', 'nonce', 'signature'];
    
    for (const field of required) {
      if (payment[field] === undefined || payment[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!ethers.isAddress(payment.payer)) {
      throw new Error('Invalid payer address');
    }
    
    if (!ethers.isAddress(payment.recipient)) {
      throw new Error('Invalid recipient address');
    }
    
    if (BigInt(payment.amount) <= 0n) {
      throw new Error('Amount must be greater than 0');
    }
  }
  
  async _verifySignature(payment) {
    try {
      // Try EIP-712 verification first
      const typedData = {
        types: PAYMENT_TYPES,
        primaryType: 'Payment',
        domain: { ...EIP712_DOMAIN, chainId: payment.chainId },
        message: {
          payer: payment.payer,
          recipient: payment.recipient,
          amount: payment.amount.toString(),
          chainId: payment.chainId.toString(),
          deadline: payment.deadline.toString(),
          nonce: payment.nonce.toString(),
          operation: payment.operation || 'default',
        },
      };
      
      try {
        const recoveredAddress = ethers.verifyTypedData(
          typedData.domain,
          typedData.types,
          typedData.message,
          payment.signature
        );
        
        if (recoveredAddress.toLowerCase() === payment.payer.toLowerCase()) {
          return { valid: true, method: 'EIP-712' };
        }
      } catch (e) {
        // EIP-712 failed, try legacy
      }
      
      // Try legacy Ethereum signed message
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'string'],
        [
          payment.payer,
          payment.recipient,
          BigInt(payment.amount),
          BigInt(payment.chainId),
          BigInt(payment.deadline),
          BigInt(payment.nonce),
          payment.operation || 'default',
        ]
      );
      
      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(messageHash),
        payment.signature
      );
      
      if (recoveredAddress.toLowerCase() === payment.payer.toLowerCase()) {
        return { valid: true, method: 'legacy' };
      }
      
      return { valid: false, error: 'Signature does not match payer' };
    } catch (error) {
      return { valid: false, error: `Signature verification failed: ${error.message}` };
    }
  }
  
  async _checkAndSetNonce(nonceKey) {
    try {
      // Try Redis first
      if (redis && redis.status === 'ready') {
        const exists = await redis.get(nonceKey);
        if (exists) return true;
        
        // Set with 24 hour expiry
        await redis.setex(nonceKey, 86400, 'used');
        return false;
      }
      
      // Fallback to in-memory (not recommended for production)
      if (!this._nonceCache) {
        this._nonceCache = new Map();
      }
      
      if (this._nonceCache.has(nonceKey)) return true;
      
      this._nonceCache.set(nonceKey, Date.now());
      
      // Clean old entries
      if (this._nonceCache.size > 10000) {
        const entries = Array.from(this._nonceCache.entries());
        entries.slice(0, 5000).forEach(([key]) => this._nonceCache.delete(key));
      }
      
      return false;
    } catch (error) {
      logger.warn('Nonce check failed, allowing payment:', error.message);
      return false;
    }
  }
  
  async _verifyBalance(address, amount) {
    try {
      const provider = this._getProvider();
      const balance = await provider.getBalance(address);
      return balance >= BigInt(amount);
    } catch (error) {
      logger.warn('Balance verification failed:', error.message);
      return true; // Allow if we can't verify
    }
  }
  
  _generateReceiptId(payment) {
    return ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        payer: payment.payer,
        nonce: payment.nonce,
        timestamp: Date.now(),
      }))
    ).slice(0, 18);
  }
  
  async _storeReceipt(receiptId, payment) {
    const receipt = {
      id: receiptId,
      payer: payment.payer,
      recipient: payment.recipient,
      amount: payment.amount,
      amountFormatted: ethers.formatEther(payment.amount),
      operation: payment.operation,
      chainId: payment.chainId,
      timestamp: Date.now(),
      status: 'verified',
    };
    
    try {
      if (redis && redis.status === 'ready') {
        await redis.setex(
          `x402:receipt:${receiptId}`,
          86400 * 7, // 7 days
          JSON.stringify(receipt)
        );
      }
    } catch (error) {
      logger.warn('Failed to store receipt:', error.message);
    }
    
    return receipt;
  }
  
  async _getFromCache(key) {
    try {
      if (redis && redis.status === 'ready') {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
      }
    } catch (error) {
      logger.warn('Cache read failed:', error.message);
    }
    return null;
  }
  
  _getOperationDescription(operation) {
    const descriptions = {
      CREATE_MARKET: 'Create a new prediction market',
      PLACE_BET: 'Place a bet on a market outcome',
      PREMIUM_ANALYTICS: 'Access premium market analytics and insights',
      PRIORITY_RESOLUTION: 'Priority processing for market resolution',
      API_ACCESS: 'General API access for premium features',
    };
    return descriptions[operation] || 'Unknown operation';
  }
}

module.exports = new X402Service();
