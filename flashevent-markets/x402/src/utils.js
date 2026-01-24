const { ethers } = require('ethers');

/**
 * x402 Protocol Version
 */
const PROTOCOL_VERSION = '1.0';

/**
 * EIP-712 Domain for x402 payments
 */
const EIP712_DOMAIN = {
  name: 'FlashEvent x402',
  version: '1',
  chainId: 10143, // Monad testnet - will be overridden
};

/**
 * EIP-712 Payment type definition
 */
const PAYMENT_TYPE = {
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

/**
 * Create EIP-712 typed data for signing
 */
function createTypedData(payment, chainId) {
  return {
    types: PAYMENT_TYPE,
    primaryType: 'Payment',
    domain: {
      ...EIP712_DOMAIN,
      chainId: chainId || payment.chainId,
    },
    message: {
      payer: payment.payer,
      recipient: payment.recipient,
      amount: payment.amount.toString(),
      chainId: (chainId || payment.chainId).toString(),
      deadline: payment.deadline.toString(),
      nonce: payment.nonce.toString(),
      operation: payment.operation || 'default',
    },
  };
}

/**
 * Create payment header with enhanced format
 */
function createPaymentHeader(payment, signature) {
  const data = {
    v: PROTOCOL_VERSION,
    payer: payment.payer,
    recipient: payment.recipient,
    amount: payment.amount.toString(),
    chainId: payment.chainId,
    deadline: payment.deadline,
    nonce: payment.nonce,
    operation: payment.operation || 'default',
    signature,
    timestamp: Date.now(),
  };
  
  // Use URL-safe base64 encoding
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode payment header with validation
 */
function decodePaymentHeader(header) {
  if (!header || typeof header !== 'string') {
    throw new Error('Invalid payment header: must be a non-empty string');
  }

  try {
    // Support both base64 and base64url encoding
    const decoded = JSON.parse(
      Buffer.from(header, 'base64url').toString('utf8')
    );
    
    // Validate required fields
    const requiredFields = ['payer', 'recipient', 'amount', 'chainId', 'deadline', 'nonce', 'signature'];
    for (const field of requiredFields) {
      if (decoded[field] === undefined || decoded[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
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
    if (error.message.includes('Missing required field')) {
      throw error;
    }
    throw new Error(`Invalid payment header format: ${error.message}`);
  }
}

/**
 * Encode payment data for signing (legacy method)
 */
function encodePaymentData(payment) {
  return JSON.stringify({
    payer: payment.payer,
    recipient: payment.recipient,
    amount: payment.amount.toString(),
    chainId: payment.chainId,
    deadline: payment.deadline,
    nonce: payment.nonce,
    operation: payment.operation || 'default',
  });
}

/**
 * Create message hash for signing (legacy Ethereum signed message)
 */
function createPaymentMessage(payment) {
  return ethers.solidityPackedKeccak256(
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
}

/**
 * Verify payment header signature (supports both legacy and EIP-712)
 */
function verifyPaymentHeader(header, options = {}) {
  const payment = typeof header === 'string' ? decodePaymentHeader(header) : header;
  
  if (!payment.signature) {
    return { valid: false, error: 'Missing signature' };
  }

  try {
    // Try EIP-712 verification first
    if (options.useEIP712 !== false) {
      const typedData = createTypedData(payment, payment.chainId);
      const recoveredAddress = ethers.verifyTypedData(
        typedData.domain,
        typedData.types,
        typedData.message,
        payment.signature
      );
      
      if (recoveredAddress.toLowerCase() === payment.payer.toLowerCase()) {
        return { valid: true, method: 'EIP-712', payer: recoveredAddress };
      }
    }
    
    // Fall back to legacy signed message
    const message = createPaymentMessage(payment);
    const recoveredAddress = ethers.verifyMessage(
      ethers.getBytes(message),
      payment.signature
    );
    
    if (recoveredAddress.toLowerCase() === payment.payer.toLowerCase()) {
      return { valid: true, method: 'legacy', payer: recoveredAddress };
    }
    
    return { valid: false, error: 'Signature mismatch' };
  } catch (error) {
    return { valid: false, error: `Signature verification failed: ${error.message}` };
  }
}

/**
 * Generate cryptographically secure unique nonce
 */
function generateNonce() {
  const timestamp = Date.now().toString(36);
  const random = ethers.hexlify(ethers.randomBytes(16)).slice(2);
  return `${timestamp}-${random}`;
}

/**
 * Calculate deadline (timestamp)
 */
function calculateDeadline(validitySeconds = 300) {
  return Math.floor(Date.now() / 1000) + validitySeconds;
}

/**
 * Check if payment is expired
 */
function isPaymentExpired(payment) {
  const now = Math.floor(Date.now() / 1000);
  return payment.deadline < now;
}

/**
 * Parse price from 402 response headers
 */
function parsePaymentRequired(response) {
  const price = response.headers.get('x-402-price');
  const recipient = response.headers.get('x-402-recipient');
  const chainId = response.headers.get('x-402-chain-id');
  const network = response.headers.get('x-402-network');
  const operation = response.headers.get('x-402-operation');

  if (!price || !recipient) {
    throw new Error('Invalid 402 response: missing required headers');
  }

  return {
    price: BigInt(price),
    priceFormatted: ethers.formatEther(price),
    recipient,
    chainId: chainId ? parseInt(chainId, 10) : null,
    network: network || 'unknown',
    operation: operation || 'unknown',
  };
}

/**
 * Format price for display
 */
function formatPrice(amount, decimals = 18) {
  return ethers.formatUnits(amount, decimals);
}

/**
 * Parse price from string
 */
function parsePrice(amount, decimals = 18) {
  return ethers.parseUnits(amount.toString(), decimals);
}

/**
 * Convert USD to ETH (simple conversion)
 */
function usdToEth(usdAmount, ethPrice) {
  const eth = usdAmount / ethPrice;
  return parsePrice(eth.toFixed(18));
}

/**
 * Convert ETH to USD
 */
function ethToUsd(ethAmount, ethPrice) {
  const eth = parseFloat(formatPrice(ethAmount));
  return eth * ethPrice;
}

/**
 * Validate Ethereum address
 */
function isValidAddress(address) {
  return ethers.isAddress(address);
}

/**
 * Validate payment object
 */
function validatePayment(payment) {
  const required = ['payer', 'recipient', 'amount', 'chainId', 'deadline', 'nonce'];
  
  for (const field of required) {
    if (payment[field] === undefined || payment[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!isValidAddress(payment.payer)) {
    throw new Error('Invalid payer address');
  }

  if (!isValidAddress(payment.recipient)) {
    throw new Error('Invalid recipient address');
  }

  if (BigInt(payment.amount) <= 0n) {
    throw new Error('Amount must be greater than 0');
  }

  if (payment.deadline < Math.floor(Date.now() / 1000)) {
    throw new Error('Deadline must be in the future');
  }

  return true;
}

/**
 * Create API pricing config
 */
function createPricingConfig(prices) {
  return {
    getPrice: (operation) => {
      return prices[operation] || 0n;
    },
    setPrice: (operation, price) => {
      prices[operation] = BigInt(price);
    },
    prices,
  };
}

/**
 * Estimate gas cost
 */
async function estimateGasCost(provider) {
  const feeData = await provider.getFeeData();
  // Estimate for a simple transfer
  const gasLimit = 21000n;
  const gasPrice = feeData.gasPrice || 0n;
  return gasLimit * gasPrice;
}

module.exports = {
  // Core functions
  PROTOCOL_VERSION,
  EIP712_DOMAIN,
  PAYMENT_TYPE,
  createTypedData,
  createPaymentHeader,
  decodePaymentHeader,
  encodePaymentData,
  createPaymentMessage,
  verifyPaymentHeader,
  
  // Nonce and timing
  generateNonce,
  calculateDeadline,
  isPaymentExpired,
  
  // Parsing and formatting
  parsePaymentRequired,
  formatPrice,
  parsePrice,
  usdToEth,
  ethToUsd,
  
  // Validation
  isValidAddress,
  validatePayment,
  
  // Configuration
  createPricingConfig,
  
  // Utilities
  estimateGasCost,
};
