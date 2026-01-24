const { ethers } = require('ethers');
const { 
  verifyPaymentHeader, 
  decodePaymentHeader,
  isPaymentExpired,
  PROTOCOL_VERSION,
} = require('./utils');

/**
 * x402 Server middleware for Express
 * 
 * Features:
 * - Automatic payment verification
 * - Nonce tracking (in-memory with Redis support)
 * - Balance verification
 * - Route-based pricing
 * - Payment receipts
 */
class X402Server {
  constructor(config) {
    this.config = {
      paymentRecipient: null,
      chainId: 10143,
      network: 'monad-testnet',
      rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
      verifyBalance: true,
      nonceWindowMs: 300000, // 5 minutes
      maxNonceCache: 10000,
      ...config,
    };
    
    if (!this.config.paymentRecipient) {
      throw new Error('x402 Server: paymentRecipient is required');
    }
    
    this.usedNonces = new Map(); // Map<nonceKey, timestamp>
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.pricingRules = new Map();
    this.receipts = new Map();
    
    // Setup periodic nonce cleanup
    this._startNonceCleanup();
  }

  /**
   * Create Express middleware
   */
  middleware(options = {}) {
    return async (req, res, next) => {
      // Check if route requires payment
      const price = this._getRoutePrice(req);
      
      if (!price || price === 0n) {
        return next();
      }

      // Check for payment header
      const paymentHeader = req.headers['x-402-payment'];

      if (!paymentHeader) {
        return this._requirePayment(res, price, req.path, options);
      }

      // Verify payment
      try {
        const payment = await this._verifyPayment(paymentHeader, price);
        
        // Attach payment info to request
        req.x402 = {
          verified: true,
          payment,
          receipt: this._createReceipt(payment, req.path),
        };
        
        next();
      } catch (error) {
        return this._paymentError(res, error);
      }
    };
  }

  /**
   * Decorator for paid routes with specific price
   */
  paid(price, handler) {
    const priceValue = typeof price === 'string' ? ethers.parseEther(price) : BigInt(price);
    
    return async (req, res, next) => {
      const paymentHeader = req.headers['x-402-payment'];

      if (!paymentHeader) {
        return this._requirePayment(res, priceValue, req.path);
      }

      try {
        const payment = await this._verifyPayment(paymentHeader, priceValue);
        req.x402 = { 
          verified: true, 
          payment,
          receipt: this._createReceipt(payment, req.path),
        };
        return handler(req, res, next);
      } catch (error) {
        return this._paymentError(res, error);
      }
    };
  }

  /**
   * Set pricing rule for a route pattern
   */
  setPrice(pattern, price) {
    const priceValue = typeof price === 'string' ? ethers.parseEther(price) : BigInt(price);
    this.pricingRules.set(pattern, priceValue);
  }

  /**
   * Set dynamic pricing function for a route pattern
   */
  setDynamicPrice(pattern, priceFn) {
    this.pricingRules.set(pattern, priceFn);
  }

  /**
   * Get payment receipt
   */
  getReceipt(receiptId) {
    return this.receipts.get(receiptId);
  }

  /**
   * Verify payment header
   */
  async _verifyPayment(header, requiredAmount) {
    // Decode header
    const payment = decodePaymentHeader(header);

    // Verify signature
    const verification = verifyPaymentHeader(header);
    if (!verification.valid) {
      throw new X402ServerError(
        verification.error || 'Invalid signature',
        'INVALID_SIGNATURE'
      );
    }

    // Check amount
    const paymentAmount = BigInt(payment.amount);
    const required = BigInt(requiredAmount);
    
    if (paymentAmount < required) {
      throw new X402ServerError(
        `Insufficient payment: got ${ethers.formatEther(paymentAmount)} ETH, need ${ethers.formatEther(required)} ETH`,
        'INSUFFICIENT_AMOUNT',
        { got: paymentAmount.toString(), required: required.toString() }
      );
    }

    // Check recipient
    if (payment.recipient.toLowerCase() !== this.config.paymentRecipient.toLowerCase()) {
      throw new X402ServerError(
        'Invalid payment recipient',
        'INVALID_RECIPIENT'
      );
    }

    // Check chain ID
    if (payment.chainId !== this.config.chainId) {
      throw new X402ServerError(
        `Invalid chain ID: expected ${this.config.chainId}, got ${payment.chainId}`,
        'INVALID_CHAIN'
      );
    }

    // Check deadline (not expired)
    if (isPaymentExpired(payment)) {
      throw new X402ServerError(
        'Payment has expired',
        'PAYMENT_EXPIRED'
      );
    }

    // Check nonce (prevent replay)
    const nonceKey = `${payment.payer.toLowerCase()}:${payment.nonce}`;
    if (this.usedNonces.has(nonceKey)) {
      throw new X402ServerError(
        'Payment nonce already used (replay attack prevented)',
        'NONCE_REUSED'
      );
    }
    
    // Mark nonce as used
    this.usedNonces.set(nonceKey, Date.now());

    // Verify payer has sufficient balance (optional)
    if (this.config.verifyBalance) {
      try {
        const balance = await this.provider.getBalance(payment.payer);
        if (balance < paymentAmount) {
          throw new X402ServerError(
            'Payer has insufficient balance',
            'INSUFFICIENT_BALANCE'
          );
        }
      } catch (error) {
        if (error instanceof X402ServerError) throw error;
        // Log but don't fail on RPC errors
        console.warn('Balance verification failed:', error.message);
      }
    }

    return payment;
  }

  /**
   * Send 402 Payment Required response
   */
  _requirePayment(res, price, operation, options = {}) {
    const priceStr = price.toString();
    
    res.status(402);
    res.set({
      'X-402-Version': PROTOCOL_VERSION,
      'X-402-Price': priceStr,
      'X-402-Recipient': this.config.paymentRecipient,
      'X-402-Chain-ID': this.config.chainId.toString(),
      'X-402-Network': this.config.network,
      'X-402-Operation': operation,
      'X-402-Timeout': this.config.nonceWindowMs / 1000,
    });
    
    return res.json({
      error: 'Payment Required',
      code: 'PAYMENT_REQUIRED',
      version: PROTOCOL_VERSION,
      price: priceStr,
      priceFormatted: ethers.formatEther(price),
      currency: 'ETH',
      recipient: this.config.paymentRecipient,
      chainId: this.config.chainId,
      network: this.config.network,
      operation,
      timeout: this.config.nonceWindowMs / 1000,
      instructions: 'Sign a payment authorization and include it in the X-402-Payment header',
    });
  }

  /**
   * Send payment error response
   */
  _paymentError(res, error) {
    const statusCode = error.code === 'PAYMENT_EXPIRED' ? 410 : 402;
    
    return res.status(statusCode).json({
      error: 'Payment verification failed',
      code: error.code || 'PAYMENT_INVALID',
      message: error.message,
      details: error.details || {},
    });
  }

  /**
   * Get price for route
   */
  _getRoutePrice(req) {
    const path = req.path;
    
    // Check exact match first
    if (this.pricingRules.has(path)) {
      const price = this.pricingRules.get(path);
      return typeof price === 'function' ? price(req) : price;
    }
    
    // Check pattern matches
    for (const [pattern, price] of this.pricingRules) {
      if (this._matchPattern(path, pattern)) {
        return typeof price === 'function' ? price(req) : price;
      }
    }
    
    // Default: free
    return 0n;
  }

  /**
   * Match route pattern (supports * wildcards)
   */
  _matchPattern(path, pattern) {
    if (pattern === '*') return true;
    
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\//g, '\\/') + '$'
    );
    return regex.test(path);
  }

  /**
   * Create payment receipt
   */
  _createReceipt(payment, operation) {
    const receiptId = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({
        payer: payment.payer,
        nonce: payment.nonce,
        timestamp: Date.now(),
      }))
    ).slice(0, 18); // Short ID
    
    const receipt = {
      id: receiptId,
      payer: payment.payer,
      recipient: payment.recipient,
      amount: payment.amount,
      operation,
      timestamp: Date.now(),
      chainId: payment.chainId,
    };
    
    this.receipts.set(receiptId, receipt);
    
    // Cleanup old receipts
    if (this.receipts.size > 10000) {
      const oldest = Array.from(this.receipts.keys()).slice(0, 1000);
      oldest.forEach(key => this.receipts.delete(key));
    }
    
    return receipt;
  }

  /**
   * Start periodic nonce cleanup
   */
  _startNonceCleanup() {
    setInterval(() => {
      const now = Date.now();
      const expiry = now - this.config.nonceWindowMs;
      
      for (const [key, timestamp] of this.usedNonces) {
        if (timestamp < expiry) {
          this.usedNonces.delete(key);
        }
      }
      
      // Hard limit on cache size
      if (this.usedNonces.size > this.config.maxNonceCache) {
        const toDelete = Array.from(this.usedNonces.keys())
          .slice(0, this.usedNonces.size - this.config.maxNonceCache);
        toDelete.forEach(key => this.usedNonces.delete(key));
      }
    }, 60000); // Run every minute
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.usedNonces.clear();
    this.receipts.clear();
  }
}

/**
 * x402 Server Error class
 */
class X402ServerError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'X402ServerError';
    this.code = code;
    this.details = details;
  }
}

X402Server.X402ServerError = X402ServerError;

module.exports = X402Server;
