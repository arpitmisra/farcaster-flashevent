const { ethers } = require('ethers');
const axios = require('axios');
const { 
  createPaymentHeader, 
  encodePaymentData, 
  createTypedData,
  generateNonce,
  calculateDeadline,
  isPaymentExpired,
  validatePayment,
} = require('./utils');

/**
 * x402 Client Error class
 */
class X402Error extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'X402Error';
    this.code = code;
    this.details = details;
  }
}

/**
 * x402 Client for making paid HTTP requests
 * 
 * Features:
 * - Automatic retry with exponential backoff
 * - EIP-712 typed data signing
 * - Payment pre-authorization
 * - Balance checking
 * - Request caching
 */
class X402Client {
  constructor(config) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      paymentTimeout: 300,
      useEIP712: true,
      ...config,
    };
    this.wallet = null;
    this.provider = null;
    this.nonce = 0;
    this.cache = new Map();
    this.pendingPayments = new Map();
  }

  /**
   * Initialize client with wallet
   */
  async init(privateKey) {
    if (!privateKey) {
      throw new X402Error('Private key required', 'INIT_ERROR');
    }
    
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Verify connection
    try {
      await this.provider.getNetwork();
    } catch (error) {
      throw new X402Error(
        `Failed to connect to RPC: ${error.message}`,
        'RPC_ERROR'
      );
    }
    
    return this;
  }

  /**
   * Initialize from browser wallet (MetaMask, WalletConnect, etc.)
   */
  async initFromSigner(signer) {
    if (!signer) {
      throw new X402Error('Signer required', 'INIT_ERROR');
    }
    
    this.wallet = signer;
    this.provider = signer.provider;
    
    // Verify signer has an address
    try {
      await signer.getAddress();
    } catch (error) {
      throw new X402Error(
        `Invalid signer: ${error.message}`,
        'SIGNER_ERROR'
      );
    }
    
    return this;
  }

  /**
   * Make a paid request with automatic payment handling
   */
  async paidRequest(url, options = {}) {
    const { 
      method = 'GET', 
      data, 
      headers = {},
      skipPayment = false,
      maxRetries = this.config.maxRetries,
    } = options;

    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // First request to check if payment is needed
        const response = await this._makeRequest(url, { method, data, headers });

        // If not 402, return response
        if (response.status !== 402) {
          return response;
        }

        if (skipPayment) {
          throw new X402Error('Payment required', 'PAYMENT_REQUIRED', response.data);
        }

        // Get payment details from response
        const paymentInfo = this._parsePaymentRequired(response);
        
        // Check if we can afford the payment
        await this._checkBalance(paymentInfo.amount);
        
        // Create payment header
        const paymentHeader = await this._createPayment(paymentInfo);

        // Retry with payment
        const paidResponse = await this._makeRequest(url, {
          method,
          data,
          headers: {
            ...headers,
            'X-402-Payment': paymentHeader,
          },
        });
        
        // Store successful payment
        this.pendingPayments.set(url, {
          paymentHeader,
          timestamp: Date.now(),
          amount: paymentInfo.amount,
        });
        
        return paidResponse;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry certain errors
        if (error.code === 'INSUFFICIENT_BALANCE' || 
            error.code === 'WALLET_NOT_INITIALIZED' ||
            error.code === 'PAYMENT_INVALID') {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await this._sleep(delay);
        }
      }
    }
    
    throw lastError || new X402Error('Request failed', 'REQUEST_FAILED');
  }

  /**
   * GET request with payment
   */
  async get(url, headers = {}) {
    return this.paidRequest(url, { method: 'GET', headers });
  }

  /**
   * POST request with payment
   */
  async post(url, data, headers = {}) {
    return this.paidRequest(url, { method: 'POST', data, headers });
  }

  /**
   * PUT request with payment
   */
  async put(url, data, headers = {}) {
    return this.paidRequest(url, { method: 'PUT', data, headers });
  }

  /**
   * DELETE request with payment
   */
  async delete(url, headers = {}) {
    return this.paidRequest(url, { method: 'DELETE', headers });
  }

  /**
   * Pre-authorize a payment (sign without sending)
   */
  async preAuthorize(amount, recipient, operation, validitySeconds) {
    if (!this.wallet) {
      throw new X402Error('Wallet not initialized', 'WALLET_NOT_INITIALIZED');
    }

    const deadline = calculateDeadline(validitySeconds || this.config.paymentTimeout);
    const nonce = this._getNextNonce();
    const payerAddress = await this.wallet.getAddress();

    const paymentData = {
      payer: payerAddress,
      recipient,
      amount: amount.toString(),
      chainId: this.config.chainId,
      nonce,
      deadline,
      operation: operation || 'default',
    };

    // Validate payment data
    validatePayment(paymentData);

    // Sign using EIP-712 if enabled
    let signature;
    if (this.config.useEIP712) {
      const typedData = createTypedData(paymentData, this.config.chainId);
      signature = await this.wallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
    } else {
      const message = encodePaymentData(paymentData);
      signature = await this.wallet.signMessage(message);
    }

    return createPaymentHeader(paymentData, signature);
  }

  /**
   * Get current wallet address
   */
  async getAddress() {
    if (!this.wallet) return null;
    return await this.wallet.getAddress();
  }

  /**
   * Get wallet balance
   */
  async getBalance() {
    if (!this.wallet) return 0n;
    const address = await this.wallet.getAddress();
    return await this.provider.getBalance(address);
  }

  /**
   * Get formatted balance
   */
  async getFormattedBalance() {
    const balance = await this.getBalance();
    return ethers.formatEther(balance);
  }

  /**
   * Check if wallet has sufficient balance
   */
  async hasSufficientBalance(amount) {
    const balance = await this.getBalance();
    return balance >= BigInt(amount);
  }

  /**
   * Get pending payments
   */
  getPendingPayments() {
    return Array.from(this.pendingPayments.entries()).map(([url, payment]) => ({
      url,
      ...payment,
    }));
  }

  /**
   * Clear payment cache
   */
  clearCache() {
    this.cache.clear();
    this.pendingPayments.clear();
  }

  // Private methods

  async _makeRequest(url, options) {
    const { method, data, headers } = options;
    
    try {
      return await axios({
        url,
        method,
        data,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        validateStatus: (status) => status < 500,
        timeout: 30000,
      });
    } catch (error) {
      if (error.response) {
        return error.response;
      }
      throw new X402Error(
        `Network error: ${error.message}`,
        'NETWORK_ERROR',
        { originalError: error.message }
      );
    }
  }

  _parsePaymentRequired(response) {
    const headers = response.headers;
    
    const amount = headers['x-402-price'] || headers['x-payment-amount'];
    const recipient = headers['x-402-recipient'] || headers['x-payment-recipient'];
    
    if (!amount || !recipient) {
      throw new X402Error(
        'Invalid 402 response: missing price or recipient',
        'INVALID_402_RESPONSE'
      );
    }
    
    return {
      amount,
      recipient,
      operation: headers['x-402-operation'] || 'default',
      chainId: parseInt(headers['x-402-chain-id'] || this.config.chainId, 10),
      network: headers['x-402-network'] || this.config.network,
    };
  }

  async _createPayment(paymentInfo) {
    if (!this.wallet) {
      throw new X402Error('Wallet not initialized', 'WALLET_NOT_INITIALIZED');
    }

    const deadline = calculateDeadline(this.config.paymentTimeout);
    const nonce = this._getNextNonce();
    const payerAddress = await this.wallet.getAddress();

    const paymentData = {
      payer: payerAddress,
      recipient: paymentInfo.recipient,
      amount: paymentInfo.amount,
      chainId: paymentInfo.chainId,
      nonce,
      deadline,
      operation: paymentInfo.operation,
    };

    // Sign using EIP-712 if enabled
    let signature;
    if (this.config.useEIP712) {
      const typedData = createTypedData(paymentData, paymentInfo.chainId);
      signature = await this.wallet.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
    } else {
      const message = encodePaymentData(paymentData);
      signature = await this.wallet.signMessage(message);
    }

    return createPaymentHeader(paymentData, signature);
  }

  async _checkBalance(requiredAmount) {
    const balance = await this.getBalance();
    const required = BigInt(requiredAmount);
    
    if (balance < required) {
      throw new X402Error(
        `Insufficient balance: have ${ethers.formatEther(balance)} ETH, need ${ethers.formatEther(required)} ETH`,
        'INSUFFICIENT_BALANCE',
        {
          balance: balance.toString(),
          required: required.toString(),
        }
      );
    }
  }

  _getNextNonce() {
    return `${Date.now()}-${++this.nonce}`;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export both the class and error class
X402Client.X402Error = X402Error;

module.exports = X402Client;
