const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const { generateToken, verifyToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const logger = require('../utils/logger');

// In-memory nonce store (use Redis in production)
const nonceStore = new Map();

// Nonce validity period (5 minutes)
const NONCE_VALIDITY_MS = 5 * 60 * 1000;

// Validation schemas
const getNonceSchema = z.object({
  query: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  }),
});

const verifySignatureSchema = z.object({
  body: z.object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
    signature: z.string(),
    message: z.string(),
  }),
});

/**
 * Generate a random nonce
 */
function generateNonce() {
  return `flashevent-auth-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Clean expired nonces periodically
 */
function cleanExpiredNonces() {
  const now = Date.now();
  for (const [address, data] of nonceStore.entries()) {
    if (now - data.timestamp > NONCE_VALIDITY_MS) {
      nonceStore.delete(address);
    }
  }
}

// Clean expired nonces every minute
setInterval(cleanExpiredNonces, 60000);

/**
 * @route GET /api/auth/nonce
 * @desc Get a nonce for wallet signature authentication
 */
router.get('/nonce', validate(getNonceSchema), (req, res) => {
  const { address } = req.query;
  const normalizedAddress = address.toLowerCase();
  
  const nonce = generateNonce();
  const message = `Sign this message to authenticate with FlashEvent Markets.\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
  
  // Store nonce with timestamp
  nonceStore.set(normalizedAddress, {
    nonce,
    message,
    timestamp: Date.now(),
  });
  
  logger.info('Generated auth nonce', { address: normalizedAddress });
  
  res.json({
    nonce,
    message,
    expiresIn: NONCE_VALIDITY_MS / 1000, // seconds
  });
});

/**
 * @route POST /api/auth/verify
 * @desc Verify wallet signature and return JWT token
 */
router.post('/verify', validate(verifySignatureSchema), async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;
    const normalizedAddress = address.toLowerCase();
    
    // Get stored nonce
    const storedData = nonceStore.get(normalizedAddress);
    
    if (!storedData) {
      return res.status(400).json({
        error: 'No nonce found. Please request a new nonce.',
        code: 'NONCE_NOT_FOUND',
      });
    }
    
    // Check nonce expiry
    if (Date.now() - storedData.timestamp > NONCE_VALIDITY_MS) {
      nonceStore.delete(normalizedAddress);
      return res.status(400).json({
        error: 'Nonce expired. Please request a new nonce.',
        code: 'NONCE_EXPIRED',
      });
    }
    
    // Verify the message matches
    if (message !== storedData.message) {
      return res.status(400).json({
        error: 'Message mismatch',
        code: 'MESSAGE_MISMATCH',
      });
    }
    
    // Verify signature using ethers
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch (error) {
      logger.error('Signature verification failed', { error: error.message });
      return res.status(400).json({
        error: 'Invalid signature',
        code: 'INVALID_SIGNATURE',
      });
    }
    
    // Check if recovered address matches
    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      logger.warn('Address mismatch', { 
        claimed: normalizedAddress, 
        recovered: recoveredAddress.toLowerCase() 
      });
      return res.status(400).json({
        error: 'Signature does not match address',
        code: 'ADDRESS_MISMATCH',
      });
    }
    
    // Clear used nonce
    nonceStore.delete(normalizedAddress);
    
    // Generate JWT token
    const token = generateToken({
      address: normalizedAddress,
      // Add placeholder FID - in production, link to Farcaster
      fid: null,
      username: `user_${normalizedAddress.slice(2, 8)}`,
    });
    
    logger.info('User authenticated successfully', { address: normalizedAddress });
    
    res.json({
      success: true,
      token,
      address: normalizedAddress,
      expiresIn: '7d',
    });
  } catch (error) {
    logger.error('Auth verification error', { error: error.message });
    next(error);
  }
});

/**
 * @route POST /api/auth/refresh
 * @desc Refresh JWT token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
        code: 'NO_TOKEN',
      });
    }
    
    const oldToken = authHeader.substring(7);
    
    try {
      const decoded = verifyToken(oldToken);
      
      // Generate new token
      const newToken = generateToken({
        address: decoded.address,
        fid: decoded.fid,
        username: decoded.username,
      });
      
      res.json({
        success: true,
        token: newToken,
        expiresIn: '7d',
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        // For expired tokens, require re-authentication
        return res.status(401).json({
          error: 'Token expired. Please re-authenticate.',
          code: 'TOKEN_EXPIRED',
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/auth/status
 * @desc Check authentication status
 */
router.get('/status', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({
      authenticated: false,
    });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = verifyToken(token);
    res.json({
      authenticated: true,
      address: decoded.address,
      fid: decoded.fid,
      username: decoded.username,
    });
  } catch (error) {
    res.json({
      authenticated: false,
      error: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
});

module.exports = router;
