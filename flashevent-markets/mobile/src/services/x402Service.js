/**
 * x402 Service - Micropayments integration for FlashEvent Markets
 * 
 * Implements the x402 protocol with ONE-TIME PRE-AUTHORIZATION:
 * 1. User connects wallet
 * 2. User signs ONE pre-authorization (valid for 24 hours, up to limit)
 * 3. All subsequent requests automatically use the pre-auth signature
 * 4. No need to approve each transaction individually!
 * 
 * This is the key benefit of x402 - sign once, pay automatically.
 */

import { ethers } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import walletService from './walletService';
import metamaskService from './metamaskService';

// Protocol version
const PROTOCOL_VERSION = '1.0';

// Chain configuration - Using Monad Testnet
const CHAIN_CONFIG = {
  chainId: 10143,
  network: 'monad',
};

// Default treasury/recipient address (receives x402 payments)
const DEFAULT_RECIPIENT = '0xBb689Fd2A92b6EB905e56C3726Bf090fA2D3a6a4';

// Pre-authorization validity period (24 hours in seconds)
const PREAUTH_VALIDITY_SECONDS = 24 * 60 * 60;

// Default spending limit for pre-authorization (0.01 MON on Monad Testnet)
const DEFAULT_SPENDING_LIMIT = ethers.parseEther('0.01');

// Storage keys
const STORAGE_KEYS = {
  PREAUTH: 'x402_preauth',
  PREAUTH_META: 'x402_preauth_meta',
};

// EIP-712 Domain for x402 payments
// NOTE: chainId is omitted from domain to avoid conflicts with WalletConnect routing
// The actual target chain (Monad) is specified in the message data
const EIP712_DOMAIN = {
  name: 'FlashEvent x402',
  version: '1',
  // chainId intentionally omitted - will be set dynamically based on WalletConnect session
};

// EIP-712 Pre-Authorization type (for one-time signing)
const PREAUTH_TYPES = {
  PreAuthorization: [
    { name: 'payer', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'maxAmount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
};

// EIP-712 Payment type (for individual payments using pre-auth)
const PAYMENT_TYPES = {
  Payment: [
    { name: 'payer', type: 'address' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'string' },
    { name: 'operation', type: 'string' },
  ],
};

class X402Service {
  constructor() {
    this.apiUrl = config.API_URL || 'http://10.0.2.2:3001/api';
    this.nonce = 0;
    this.pendingPayments = new Map();
    
    // Pre-authorization state
    this.preAuth = null;           // Stored pre-authorization
    this.preAuthMeta = null;       // Metadata (spent amount, etc.)
    this.isInitialized = false;
    
    // Retry configuration
    this.maxRetries = 2;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Initialize service - load stored pre-authorization
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      const storedPreAuth = await AsyncStorage.getItem(STORAGE_KEYS.PREAUTH);
      const storedMeta = await AsyncStorage.getItem(STORAGE_KEYS.PREAUTH_META);
      
      if (storedPreAuth) {
        this.preAuth = JSON.parse(storedPreAuth);
        this.preAuthMeta = storedMeta ? JSON.parse(storedMeta) : { spent: '0' };
        
        // Check if pre-auth is still valid
        if (this.isPreAuthValid()) {
          console.log('✅ Loaded valid x402 pre-authorization');
        } else {
          console.log('⏰ Pre-authorization expired, clearing...');
          await this.clearPreAuth();
        }
      }
    } catch (error) {
      console.warn('Failed to load pre-authorization:', error);
    }
    
    this.isInitialized = true;
  }

  /**
   * Check if current pre-authorization is valid
   */
  isPreAuthValid() {
    if (!this.preAuth) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const isNotExpired = this.preAuth.validUntil > now;
    const spentAmount = BigInt(this.preAuthMeta?.spent || '0');
    const maxAmount = BigInt(this.preAuth.maxAmount);
    const hasRemainingLimit = spentAmount < maxAmount;
    
    return isNotExpired && hasRemainingLimit;
  }

  /**
   * Check if user has signed a pre-authorization
   */
  hasPreAuth() {
    return this.isPreAuthValid();
  }

  /**
   * Get pre-authorization status
   */
  getPreAuthStatus() {
    if (!this.preAuth) {
      return { authorized: false, reason: 'No pre-authorization signed' };
    }
    
    const now = Math.floor(Date.now() / 1000);
    if (this.preAuth.validUntil <= now) {
      return { authorized: false, reason: 'Pre-authorization expired' };
    }
    
    const spentAmount = BigInt(this.preAuthMeta?.spent || '0');
    const maxAmount = BigInt(this.preAuth.maxAmount);
    
    if (spentAmount >= maxAmount) {
      return { authorized: false, reason: 'Spending limit reached' };
    }
    
    const remaining = maxAmount - spentAmount;
    const expiresIn = this.preAuth.validUntil - now;
    
    return {
      authorized: true,
      payer: this.preAuth.payer,
      spent: ethers.formatEther(spentAmount),
      remaining: ethers.formatEther(remaining),
      maxAmount: ethers.formatEther(maxAmount),
      expiresIn,
      expiresAt: new Date(this.preAuth.validUntil * 1000).toISOString(),
    };
  }

  /**
   * MAIN METHOD: Sign pre-authorization (ONE TIME)
   * This is what the user signs when clicking "Authorize x402"
   * After this, all payments are automatic!
   */
  async signPreAuthorization(options = {}) {
    const { 
      maxAmount = DEFAULT_SPENDING_LIMIT,
      validitySeconds = PREAUTH_VALIDITY_SECONDS,
      recipient = DEFAULT_RECIPIENT,
    } = options;

    // Get payer address
    const payerAddress = await this.getPayerAddress();
    if (!payerAddress) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    // CRITICAL: Validate payer and recipient are different
    const normalizedPayer = payerAddress.toLowerCase();
    const normalizedRecipient = recipient.toLowerCase();
    
    // if (normalizedPayer === normalizedRecipient) {
    //   throw new Error(
    //     `❌ INVALID CONFIGURATION: Payer and recipient cannot be the same!\n\n` +
    //     `Payer: ${payerAddress}\n` +
    //     `Recipient: ${recipient}\n\n` +
    //     `The recipient should be the treasury address, not your wallet.\n` +
    //     `Please check the x402 configuration.`
    //   );
    // }

    console.log('\n' + '='.repeat(70));
    console.log('📋 X402 PRE-AUTHORIZATION DETAILS');
    console.log('='.repeat(70));
    console.log('👤 Payer (your wallet):', payerAddress);
    console.log('💰 Recipient (treasury):', recipient);
    console.log('📊 Max Amount:', ethers.formatEther(maxAmount));
    console.log('⏰ Valid for:', Math.round(validitySeconds / 3600), 'hours');
    console.log('='.repeat(70) + '\n');

    const validUntil = Math.floor(Date.now() / 1000) + validitySeconds;
    const nonce = this.generateNonce();

    // Create pre-authorization data
    const preAuthData = {
      payer: payerAddress,
      recipient,
      maxAmount: maxAmount.toString(),
      chainId: CHAIN_CONFIG.chainId,
      validUntil,
      nonce,
    };

    // Create EIP-712 typed data for pre-authorization
    const typedData = {
      types: PREAUTH_TYPES,
      primaryType: 'PreAuthorization',
      domain: {
        ...EIP712_DOMAIN,
        chainId: CHAIN_CONFIG.chainId,
      },
      message: {
        payer: preAuthData.payer,
        recipient: preAuthData.recipient,
        maxAmount: preAuthData.maxAmount,
        chainId: preAuthData.chainId.toString(),
        validUntil: preAuthData.validUntil.toString(),
        nonce: preAuthData.nonce,
      },
    };

    console.log('📝 Requesting x402 pre-authorization signature...');
    console.log('   Max Amount:', ethers.formatEther(maxAmount), 'ETH');
    console.log('   Valid for:', Math.round(validitySeconds / 3600), 'hours');
    console.log('   📤 Payer:', preAuthData.payer);
    console.log('   📥 Recipient:', preAuthData.recipient);

    // Log session info for debugging
    const sessionInfo = metamaskService.getSessionInfo();
    console.log('📋 Session info:', JSON.stringify(sessionInfo, null, 2));

    // Sign using MetaMask with retry logic
    let signature;
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        if (!metamaskService.isConnected()) {
          throw new Error('MetaMask not connected. Please connect your wallet first.');
        }
        
        console.log(`🔐 Sending signature request to MetaMask (attempt ${attempt}/${this.maxRetries})...`);
        console.log('   Using EIP-712 typed data signing');
        console.log('   Session chain:', sessionInfo?.chainId);
        
        // Pass timeout option for better control
        signature = await metamaskService.signTypedData(typedData, { 
          timeout: 120000, // 2 minutes
          retries: 0 // Let us handle retries here
        });
        
        console.log('✅ Signature received!');
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error;
        console.error(`❌ Pre-authorization signing failed (attempt ${attempt}):`, error);
        console.error('   Error code:', error.code);
        console.error('   Error message:', error.message);
        
        // Check for user rejection - don't retry
        if (error.message?.includes('reject') || 
            error.message?.includes('denied') || 
            error.code === 4001) {
          throw new Error('Signature request was rejected. Please approve in MetaMask to continue.');
        }
        
        // Check for timeout/expired errors - can retry
        const isRetryable = error.message?.toLowerCase().includes('expired') ||
                          error.message?.toLowerCase().includes('timeout') ||
                          error.message?.includes('Missing or invalid') ||
                          error.message?.includes('chainId') ||
                          error.code === -32602;
        
        if (isRetryable && attempt < this.maxRetries) {
          console.log(`⏱️ Retrying in ${this.retryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          
          // Try to reconnect if session error
          if (error.message?.includes('Missing or invalid') || 
              error.message?.includes('chainId') || 
              error.code === -32602) {
            try {
              console.log('🔄 Attempting wallet reconnection...');
              await metamaskService.forceReconnect?.();
            } catch (reconnectError) {
              console.log('⚠️ Reconnect attempt failed:', reconnectError.message);
            }
          }
          continue;
        }
        
        // No more retries, throw appropriate error
        if (isRetryable) {
          throw new Error(
            'Signing request timed out. Please check MetaMask app.\n\n' +
            'Tips:\n' +
            '• Make sure MetaMask app is open\n' +
            '• Check for pending signature requests\n' +
            '• Try disconnecting and reconnecting your wallet'
          );
        }
        
        throw new Error(`Failed to sign pre-authorization: ${error.message}`);
      }
    }
    
    // If no signature after retries, throw the last error
    if (!signature) {
      throw lastError || new Error('Failed to get signature after multiple attempts');
    }

    // Store pre-authorization
    this.preAuth = {
      ...preAuthData,
      signature,
      signedAt: Date.now(),
    };
    
    this.preAuthMeta = {
      spent: '0',
      paymentCount: 0,
    };

    // Persist to storage
    await AsyncStorage.setItem(STORAGE_KEYS.PREAUTH, JSON.stringify(this.preAuth));
    await AsyncStorage.setItem(STORAGE_KEYS.PREAUTH_META, JSON.stringify(this.preAuthMeta));

    console.log('\n✅ Pre-authorization signed and stored!');
    console.log('\n' + '='.repeat(70));
    console.log('📜 STORED AUTHORIZATION:');
    console.log('='.repeat(70));
    console.log('👤 Payer:', this.preAuth.payer);
    console.log('💰 Recipient:', this.preAuth.recipient);
    console.log('📊 Max Amount:', ethers.formatEther(this.preAuth.maxAmount));
    console.log('✓ Signature:', this.preAuth.signature.substring(0, 20) + '...');
    console.log('='.repeat(70) + '\n');
    
    return {
      success: true,
      preAuth: this.getPreAuthStatus(),
    };
  }

  /**
   * Clear pre-authorization (revoke)
   */
  async clearPreAuth() {
    this.preAuth = null;
    this.preAuthMeta = null;
    await AsyncStorage.removeItem(STORAGE_KEYS.PREAUTH);
    await AsyncStorage.removeItem(STORAGE_KEYS.PREAUTH_META);
    console.log('🗑️ Pre-authorization cleared');
  }

  /**
   * Get the backend API URL for x402
   */
  getX402Url(path = '') {
    return `${this.apiUrl}/x402${path}`;
  }

  /**
   * Generate unique nonce
   */
  generateNonce() {
    return `${Date.now()}-${++this.nonce}`;
  }

  /**
   * Calculate deadline (5 minutes from now)
   */
  calculateDeadline(validitySeconds = 300) {
    return Math.floor(Date.now() / 1000) + validitySeconds;
  }

  /**
   * Create payment header from pre-authorization
   * This is AUTOMATIC - no user interaction needed!
   */
  createPaymentFromPreAuth(amount, operation = 'default') {
    if (!this.isPreAuthValid()) {
      throw new Error('No valid pre-authorization. Please sign authorization first.');
    }

    // Validate pre-auth has correct payer/recipient
    if (!this.preAuth.payer || !this.preAuth.recipient) {
      throw new Error('Invalid pre-authorization data: missing payer or recipient');
    }

    const normalizedPayer = this.preAuth.payer.toLowerCase();
    const normalizedRecipient = this.preAuth.recipient.toLowerCase();
    
    if (normalizedPayer === normalizedRecipient) {
      throw new Error(
        `❌ CRITICAL ERROR: Pre-auth has invalid payer/recipient!\n\n` +
        `Both are set to: ${this.preAuth.payer}\n\n` +
        `Please revoke this authorization and sign a new one.`
      );
    }

    const payment = {
      payer: this.preAuth.payer,
      recipient: this.preAuth.recipient,
      amount: amount.toString(),
      chainId: CHAIN_CONFIG.chainId,
      deadline: this.preAuth.validUntil, // Use pre-auth validity
      nonce: this.generateNonce(),
      operation,
      preAuthSignature: this.preAuth.signature,
      preAuthNonce: this.preAuth.nonce,
    };

    console.log('💳 Creating payment from pre-auth:');
    console.log('   From:', payment.payer);
    console.log('   To:', payment.recipient);
    console.log('   Amount:', ethers.formatEther(amount));

    return this.createPaymentHeader(payment, this.preAuth.signature);
  }

  /**
   * Create EIP-712 typed data for signing
   */
  createTypedData(payment) {
    return {
      types: PAYMENT_TYPES,
      primaryType: 'Payment',
      domain: EIP712_DOMAIN,
      message: {
        payer: payment.payer,
        recipient: payment.recipient,
        amount: payment.amount.toString(),
        chainId: CHAIN_CONFIG.chainId.toString(),
        deadline: payment.deadline.toString(),
        nonce: payment.nonce.toString(),
        operation: payment.operation || 'default',
      },
    };
  }

  /**
   * Create x402 payment header
   */
  createPaymentHeader(payment, signature) {
    const data = {
      v: PROTOCOL_VERSION,
      payer: payment.payer,
      recipient: payment.recipient,
      amount: payment.amount.toString(),
      chainId: CHAIN_CONFIG.chainId,
      deadline: payment.deadline,
      nonce: payment.nonce,
      operation: payment.operation || 'default',
      signature,
      timestamp: Date.now(),
    };
    
    // Base64URL encode
    return btoa(JSON.stringify(data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Sign payment using MetaMask or wallet service
   */
  async signPayment(payment) {
    const typedData = this.createTypedData(payment);
    
    try {
      // Try MetaMask first
      if (metamaskService.isConnected()) {
        const signature = await metamaskService.signTypedData(typedData);
        return signature;
      }
      
      // Fall back to wallet service (uses separate parameters)
      const signature = await walletService.signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      return signature;
    } catch (error) {
      console.error('Failed to sign payment:', error);
      throw new Error(`Payment signing failed: ${error.message}`);
    }
  }

  /**
   * Parse 402 Payment Required response
   */
  parsePaymentRequired(response) {
    const headers = response.headers;
    
    // Try to get from headers
    const price = headers.get('x-402-price');
    const recipient = headers.get('x-402-recipient');
    const operation = headers.get('x-402-operation');
    const chainId = headers.get('x-402-chain-id');
    
    if (price && recipient) {
      return {
        price,
        priceFormatted: ethers.formatEther(price),
        recipient,
        operation: operation || 'default',
        chainId: chainId ? parseInt(chainId, 10) : CHAIN_CONFIG.chainId,
      };
    }
    
    return null;
  }

  /**
   * Make a paid request with automatic 402 handling
   * Uses PRE-AUTHORIZATION - no signing needed per request!
   */
  async paidRequest(url, options = {}) {
    const { 
      method = 'GET', 
      body, 
      headers = {},
      payer,
      requirePreAuth = true,  // Set to false to force per-request signing
    } = options;

    // Initialize if needed
    await this.init();

    // Get payer address
    const payerAddress = payer || await this.getPayerAddress();
    if (!payerAddress) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    // Check if we have valid pre-authorization
    if (requirePreAuth && !this.isPreAuthValid()) {
      throw new Error('NO_PREAUTH: Please authorize x402 payments first by signing the pre-authorization.');
    }

    // First request - include pre-auth header if available
    const initialHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Add pre-authorization header for premium handling
    if (this.isPreAuthValid()) {
      initialHeaders['X-402-PreAuth'] = this.createPreAuthHeader();
    }

    let response = await fetch(url, {
      method,
      headers: initialHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // If not 402, return response
    if (response.status !== 402) {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }
      return {
        data: await response.json(),
        paid: false,
      };
    }

    // Parse payment requirements
    let paymentInfo = this.parsePaymentRequired(response);
    if (!paymentInfo) {
      // Try to get from body
      const respBody = await response.json().catch(() => null);
      if (respBody?.price && respBody?.recipient) {
        paymentInfo = respBody;
      } else {
        throw new Error('Invalid 402 response: missing payment requirements');
      }
    }

    // Create payment header using pre-authorization (NO SIGNING!)
    let paymentHeader;
    if (this.isPreAuthValid()) {
      // Use pre-auth - automatic, no user interaction
      paymentHeader = this.createPaymentFromPreAuth(
        paymentInfo.price, 
        paymentInfo.operation
      );
      console.log('💳 Using pre-authorization for payment (automatic)');
    } else if (!requirePreAuth) {
      // Fall back to per-request signing (requires MetaMask approval)
      const payment = {
        payer: payerAddress,
        recipient: paymentInfo.recipient,
        amount: paymentInfo.price,
        chainId: paymentInfo.chainId || CHAIN_CONFIG.chainId,
        deadline: this.calculateDeadline(),
        nonce: this.generateNonce(),
        operation: paymentInfo.operation,
      };
      
      // This requires user to approve in MetaMask
      console.log('⚠️ No pre-auth, requiring manual signature...');
      const signature = await this.signPayment(payment);
      paymentHeader = this.createPaymentHeader(payment, signature);
    } else {
      throw new Error('NO_PREAUTH: Please authorize x402 payments first.');
    }

    // Retry with payment header
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-402-Payment': paymentHeader,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Payment failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Update spent amount in pre-auth meta
    if (this.preAuthMeta) {
      const spent = BigInt(this.preAuthMeta.spent || '0');
      const newSpent = spent + BigInt(paymentInfo.price);
      this.preAuthMeta.spent = newSpent.toString();
      this.preAuthMeta.paymentCount = (this.preAuthMeta.paymentCount || 0) + 1;
      await AsyncStorage.setItem(STORAGE_KEYS.PREAUTH_META, JSON.stringify(this.preAuthMeta));
    }
    
    // Store payment info
    this.pendingPayments.set(url, {
      amount: paymentInfo.price,
      timestamp: Date.now(),
      receipt: data.receipt,
    });

    return {
      data,
      paid: true,
      paymentInfo: {
        amount: paymentInfo.price,
        amountFormatted: paymentInfo.priceFormatted || ethers.formatEther(paymentInfo.price),
        recipient: paymentInfo.recipient,
        operation: paymentInfo.operation,
      },
    };
  }

  /**
   * Create pre-auth header for requests
   */
  createPreAuthHeader() {
    if (!this.preAuth) return null;
    
    const data = {
      payer: this.preAuth.payer,
      recipient: this.preAuth.recipient,
      maxAmount: this.preAuth.maxAmount,
      validUntil: this.preAuth.validUntil,
      nonce: this.preAuth.nonce,
      signature: this.preAuth.signature,
    };
    
    return btoa(JSON.stringify(data))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Get current payer address
   */
  async getPayerAddress() {
    // Try MetaMask first
    if (metamaskService.isConnected()) {
      return metamaskService.getAddress();
    }
    
    // Fall back to wallet service
    return walletService.getAddress();
  }

  // ============================================
  // API Methods
  // ============================================

  /**
   * Get x402 protocol info
   */
  async getInfo() {
    const response = await fetch(this.getX402Url('/info'));
    if (!response.ok) {
      throw new Error('Failed to fetch x402 info');
    }
    return response.json();
  }

  /**
   * Get available operations and prices
   */
  async getOperations() {
    const response = await fetch(this.getX402Url('/operations'));
    if (!response.ok) {
      throw new Error('Failed to fetch operations');
    }
    const data = await response.json();
    return data.operations || data;
  }

  /**
   * Get price for a specific operation
   */
  async getPrice(operation, params = {}) {
    const queryParams = new URLSearchParams({ 
      operation, 
      params: JSON.stringify(params) 
    });
    const response = await fetch(this.getX402Url(`/price?${queryParams}`));
    if (!response.ok) {
      throw new Error('Failed to fetch price');
    }
    return response.json();
  }

  /**
   * Get payment receipt
   */
  async getReceipt(receiptId) {
    const response = await fetch(this.getX402Url(`/receipt/${receiptId}`));
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch receipt');
    }
    return response.json();
  }

  /**
   * Verify a payment header
   */
  async verifyPayment(paymentHeader) {
    const response = await fetch(this.getX402Url('/verify'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-402-Payment': paymentHeader,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { valid: false, error: error.message };
    }
    return response.json();
  }

  // ============================================
  // Convenience Methods
  // ============================================

  /**
   * Make a paid GET request
   */
  async get(url, options = {}) {
    return this.paidRequest(url, { ...options, method: 'GET' });
  }

  /**
   * Make a paid POST request
   */
  async post(url, body, options = {}) {
    return this.paidRequest(url, { ...options, method: 'POST', body });
  }

  /**
   * Pay for premium analytics
   */
  async payForAnalytics(marketId) {
    const payer = await this.getPayerAddress();
    return this.paidRequest(`${this.apiUrl}/markets/${marketId}/analytics`, {
      method: 'GET',
      payer,
    });
  }

  /**
   * Pay for market creation
   */
  async payForMarketCreation(marketData) {
    const payer = await this.getPayerAddress();
    return this.paidRequest(`${this.apiUrl}/markets`, {
      method: 'POST',
      body: marketData,
      payer,
    });
  }

  /**
   * Pay for priority resolution
   */
  async payForPriorityResolution(marketId) {
    const payer = await this.getPayerAddress();
    return this.paidRequest(`${this.apiUrl}/resolver/priority/${marketId}`, {
      method: 'POST',
      payer,
    });
  }

  /**
   * Create a payment header for a specific operation
   * Returns the header string ready to be sent with a request
   * 
   * @param {string} operation - Operation type (e.g., 'CREATE_MARKET', 'PLACE_BET')
   * @param {Object} params - Additional parameters for the operation
   * @returns {string} Base64-encoded payment header
   */
  async createPaymentHeader(operation, params = {}) {
    await this.init();
    
    if (!this.isPreAuthValid()) {
      throw new Error('No valid pre-authorization. Please authorize x402 payments first.');
    }
    
    // Get operation price from backend or use default
    let price;
    try {
      const priceResponse = await fetch(
        `${this.apiUrl}/x402/price?operation=${encodeURIComponent(operation)}&params=${encodeURIComponent(JSON.stringify(params))}`
      );
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        price = priceData.price || priceData.amount;
      }
    } catch (e) {
      console.warn('Could not fetch operation price, using default');
    }
    
    // Default prices for common operations
    if (!price) {
      const DEFAULT_PRICES = {
        CREATE_MARKET: ethers.parseEther('0.001').toString(),
        PLACE_BET: ethers.parseEther('0.0001').toString(),
        PREMIUM_ANALYTICS: ethers.parseEther('0.0005').toString(),
        API_ACCESS: ethers.parseEther('0.0001').toString(),
      };
      price = DEFAULT_PRICES[operation] || ethers.parseEther('0.0001').toString();
    }
    
    // Validate amount doesn't exceed remaining pre-auth limit
    const spent = BigInt(this.preAuthMeta?.spent || '0');
    const maxAmount = BigInt(this.preAuth.maxAmount);
    const paymentAmount = BigInt(price);
    
    if (spent + paymentAmount > maxAmount) {
      throw new Error(
        `Payment would exceed pre-authorization limit. ` +
        `Remaining: ${ethers.formatEther(maxAmount - spent)} MON, ` +
        `Required: ${ethers.formatEther(paymentAmount)} MON`
      );
    }
    
    // Create payment data
    const payment = {
      v: PROTOCOL_VERSION,
      payer: this.preAuth.payer,
      recipient: this.preAuth.recipient,
      amount: price.toString(),
      chainId: CHAIN_CONFIG.chainId,
      deadline: this.preAuth.validUntil,
      nonce: this.generateNonce(),
      operation,
      preAuthSignature: this.preAuth.signature,
      preAuthNonce: this.preAuth.nonce,
      timestamp: Date.now(),
    };
    
    console.log(`💳 Created payment header for ${operation}:`);
    console.log(`   Amount: ${ethers.formatEther(price)} MON`);
    console.log(`   Payer: ${payment.payer}`);
    console.log(`   Recipient: ${payment.recipient}`);
    
    // Base64URL encode
    const header = btoa(JSON.stringify(payment))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return header;
  }

  /**
   * Update spent amount after successful payment
   */
  async recordPayment(amount) {
    if (!this.preAuthMeta) {
      this.preAuthMeta = { spent: '0', paymentCount: 0 };
    }
    
    const currentSpent = BigInt(this.preAuthMeta.spent);
    const paymentAmount = BigInt(amount);
    
    this.preAuthMeta.spent = (currentSpent + paymentAmount).toString();
    this.preAuthMeta.paymentCount = (this.preAuthMeta.paymentCount || 0) + 1;
    
    await AsyncStorage.setItem(STORAGE_KEYS.PREAUTH_META, JSON.stringify(this.preAuthMeta));
    
    console.log(`📊 Payment recorded: ${ethers.formatEther(paymentAmount)} MON`);
    console.log(`   Total spent: ${ethers.formatEther(this.preAuthMeta.spent)} MON`);
  }

  /**
   * Test paid endpoint
   */
  async testPaidEndpoint() {
    return this.paidRequest(this.getX402Url('/test/paid'));
  }

  /**
   * Get pending payments
   */
  getPendingPayments() {
    return Array.from(this.pendingPayments.entries()).map(([url, info]) => ({
      url,
      ...info,
    }));
  }

  /**
   * Clear pending payments
   */
  clearPendingPayments() {
    this.pendingPayments.clear();
  }
}

export default new X402Service();
