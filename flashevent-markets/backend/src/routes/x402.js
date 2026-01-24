const express = require('express');
const router = express.Router();
const x402Service = require('../services/x402Service');
const { requirePayment, optionalPayment } = require('../middleware/x402');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

// Validation schemas
const verifyPaymentSchema = z.object({
  headers: z.object({
    'x-402-payment': z.string(),
  }),
});

const priceQuerySchema = z.object({
  query: z.object({
    operation: z.string(),
    params: z.string().optional(),
  }),
});

/**
 * @route GET /api/x402/info
 * @desc Get x402 protocol information
 */
router.get('/info', (req, res) => {
  res.json({
    protocol: 'x402',
    version: '1.0',
    description: 'x402 Micropayments Protocol for FlashEvent Markets',
    chainId: parseInt(process.env.CHAIN_ID || '10143', 10),
    network: process.env.NETWORK || 'monad-testnet',
    recipient: process.env.X402_RECIPIENT || process.env.PLATFORM_ADDRESS,
    features: [
      'EIP-712 typed data signatures',
      'Nonce-based replay protection',
      'Automatic balance verification',
      'Payment receipts',
      'Dynamic pricing',
    ],
    documentation: 'https://docs.flashevent.markets/x402',
  });
});

/**
 * @route GET /api/x402/price
 * @desc Get price for an operation
 */
router.get('/price', async (req, res, next) => {
  try {
    const { operation, params } = req.query;
    
    if (!operation) {
      return res.status(400).json({
        error: 'Missing operation parameter',
        code: 'MISSING_PARAMETER',
      });
    }
    
    const price = await x402Service.getOperationPrice(
      operation,
      params ? JSON.parse(params) : {}
    );
    res.json(price);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/x402/verify
 * @desc Verify x402 payment header
 */
router.post('/verify', async (req, res, next) => {
  try {
    const paymentHeader = req.headers['x-402-payment'];
    
    if (!paymentHeader) {
      return res.status(400).json({
        error: 'Missing X-402-Payment header',
        code: 'MISSING_PAYMENT_HEADER',
      });
    }
    
    const result = await x402Service.verifyPayment(paymentHeader);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/x402/receipt/:receiptId
 * @desc Get payment receipt
 */
router.get('/receipt/:receiptId', async (req, res, next) => {
  try {
    const receipt = await x402Service.getReceipt(req.params.receiptId);
    
    if (!receipt) {
      return res.status(404).json({
        error: 'Receipt not found',
        code: 'RECEIPT_NOT_FOUND',
      });
    }
    
    res.json(receipt);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/x402/operations
 * @desc Get available paid operations
 */
router.get('/operations', async (req, res, next) => {
  try {
    const operations = await x402Service.getAvailableOperations();
    res.json({
      operations,
      total: operations.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/x402/test/free
 * @desc Test endpoint - free access
 */
router.get('/test/free', (req, res) => {
  res.json({
    message: 'This endpoint is free!',
    timestamp: Date.now(),
  });
});

/**
 * @route GET /api/x402/test/paid
 * @desc Test endpoint - requires payment
 */
router.get('/test/paid', requirePayment('API_ACCESS'), (req, res) => {
  res.json({
    message: 'Payment verified! You have access to this premium endpoint.',
    payment: req.x402,
    timestamp: Date.now(),
  });
});

/**
 * @route GET /api/x402/test/optional
 * @desc Test endpoint - payment optional but gives benefits
 */
router.get('/test/optional', optionalPayment('API_ACCESS'), (req, res) => {
  const isPaid = req.x402?.verified;
  
  res.json({
    message: isPaid 
      ? 'Premium response with full data!'
      : 'Basic response. Pay for premium features.',
    isPremium: isPaid,
    payment: req.x402,
    data: isPaid 
      ? { fullData: true, details: 'Complete information here' }
      : { fullData: false, details: 'Limited information' },
    timestamp: Date.now(),
  });
});

module.exports = router;
