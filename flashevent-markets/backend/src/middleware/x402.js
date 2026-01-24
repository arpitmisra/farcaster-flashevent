const x402Service = require('../services/x402Service');
const logger = require('../utils/logger');

/**
 * x402 Payment Middleware for Express
 * 
 * This middleware handles the x402 micropayment protocol:
 * 1. Checks if route requires payment
 * 2. Returns 402 Payment Required if no payment header
 * 3. Verifies payment header if present
 * 4. Attaches payment info to request for downstream use
 */

/**
 * Create x402 middleware for a specific operation
 * @param {string} operation - The operation type (e.g., 'CREATE_MARKET', 'PLACE_BET')
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function requirePayment(operation, options = {}) {
  const {
    customPrice = null,
    skipVerification = false,
    onPaymentVerified = null,
  } = options;

  return async (req, res, next) => {
    try {
      // Get payment header
      const paymentHeader = req.headers['x-402-payment'];

      // If no payment header, return 402 Payment Required
      if (!paymentHeader) {
        const price = await getOperationPrice(operation, req, customPrice);
        return sendPaymentRequired(res, operation, price);
      }

      // Skip verification in development mode if configured
      if (skipVerification && process.env.NODE_ENV === 'development') {
        req.x402 = { verified: true, skipped: true };
        return next();
      }

      // Get required price for verification
      const requiredPrice = await getOperationPrice(operation, req, customPrice);

      // Verify payment
      const verification = await x402Service.verifyPayment(
        paymentHeader,
        operation,
        requiredPrice
      );

      if (!verification.valid) {
        return res.status(402).json({
          error: 'Payment verification failed',
          code: verification.code || 'PAYMENT_INVALID',
          message: verification.error,
        });
      }

      // Attach payment info to request
      req.x402 = {
        verified: true,
        receiptId: verification.receiptId,
        payer: verification.payer,
        amount: verification.amount,
        amountFormatted: verification.amountFormatted,
        operation,
        timestamp: verification.timestamp,
      };

      // Call optional callback
      if (onPaymentVerified) {
        await onPaymentVerified(req, verification);
      }

      // Log successful payment
      logger.info(`x402 payment verified: ${operation} from ${verification.payer} for ${verification.amountFormatted} ETH`);

      next();
    } catch (error) {
      logger.error('x402 middleware error:', error);
      return res.status(500).json({
        error: 'Payment processing error',
        code: 'PROCESSING_ERROR',
        message: error.message,
      });
    }
  };
}

/**
 * Get operation price, supporting dynamic pricing
 */
async function getOperationPrice(operation, req, customPrice) {
  if (customPrice !== null) {
    return typeof customPrice === 'function' ? await customPrice(req) : customPrice;
  }

  const priceInfo = await x402Service.getOperationPrice(operation, {
    amount: req.body?.amount,
    demandMultiplier: req.body?.demandMultiplier,
  });

  return priceInfo.price;
}

/**
 * Send 402 Payment Required response
 */
function sendPaymentRequired(res, operation, price) {
  const headers = x402Service.getPaymentRequiredHeaders(operation, price);
  const body = x402Service.getPaymentRequiredBody(operation, price);

  res.status(402);
  Object.entries(headers).forEach(([key, value]) => {
    res.set(key, value);
  });

  return res.json(body);
}

/**
 * Optional payment middleware - allows requests without payment but records if payment is made
 */
function optionalPayment(operation) {
  return async (req, res, next) => {
    const paymentHeader = req.headers['x-402-payment'];

    if (!paymentHeader) {
      req.x402 = { verified: false, optional: true };
      return next();
    }

    try {
      const verification = await x402Service.verifyPayment(paymentHeader, operation);

      req.x402 = {
        verified: verification.valid,
        optional: true,
        receiptId: verification.receiptId,
        payer: verification.payer,
        amount: verification.amount,
        error: verification.error,
      };
    } catch (error) {
      req.x402 = { verified: false, optional: true, error: error.message };
    }

    next();
  };
}

/**
 * Check payment status middleware - just checks if payment is present and valid
 */
function checkPayment() {
  return async (req, res, next) => {
    const paymentHeader = req.headers['x-402-payment'];

    if (!paymentHeader) {
      req.x402 = { hasPayment: false };
      return next();
    }

    try {
      const verification = await x402Service.verifyPayment(paymentHeader);
      req.x402 = {
        hasPayment: true,
        verified: verification.valid,
        ...verification,
      };
    } catch (error) {
      req.x402 = { hasPayment: true, verified: false, error: error.message };
    }

    next();
  };
}

/**
 * Dynamic pricing middleware
 * @param {Function} priceFn - Function that returns price based on request: (req) => price
 */
function dynamicPayment(priceFn, operation = 'DYNAMIC') {
  return async (req, res, next) => {
    try {
      const paymentHeader = req.headers['x-402-payment'];
      const price = await priceFn(req);

      if (!paymentHeader) {
        return sendPaymentRequired(res, operation, price);
      }

      const verification = await x402Service.verifyPayment(paymentHeader, operation, price);

      if (!verification.valid) {
        return res.status(402).json({
          error: 'Payment verification failed',
          code: verification.code || 'PAYMENT_INVALID',
          message: verification.error,
        });
      }

      req.x402 = {
        verified: true,
        receiptId: verification.receiptId,
        payer: verification.payer,
        amount: verification.amount,
        requiredAmount: price.toString(),
      };

      next();
    } catch (error) {
      logger.error('Dynamic payment middleware error:', error);
      return res.status(500).json({
        error: 'Payment processing error',
        message: error.message,
      });
    }
  };
}

/**
 * Rate limiting with payment bypass
 * Allows unlimited requests if payment is made
 */
function paidRateLimit(freeLimit, operation, windowMs = 60000) {
  const requests = new Map();

  return async (req, res, next) => {
    const identifier = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    // Check for payment header - paid requests bypass rate limit
    const paymentHeader = req.headers['x-402-payment'];
    if (paymentHeader) {
      try {
        const verification = await x402Service.verifyPayment(paymentHeader, operation);
        if (verification.valid) {
          req.x402 = { verified: true, ...verification, bypassedRateLimit: true };
          return next();
        }
      } catch (error) {
        // Payment verification failed, fall through to rate limiting
      }
    }

    // Clean old entries
    for (const [key, data] of requests) {
      if (data.windowStart < now - windowMs) {
        requests.delete(key);
      }
    }

    // Check rate limit
    let userData = requests.get(identifier);
    if (!userData || userData.windowStart < now - windowMs) {
      userData = { count: 0, windowStart: now };
    }

    userData.count++;
    requests.set(identifier, userData);

    if (userData.count > freeLimit) {
      // Return 402 with rate limit info
      const price = await x402Service.getOperationPrice(operation);
      res.set('X-RateLimit-Limit', freeLimit.toString());
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', Math.ceil((userData.windowStart + windowMs) / 1000).toString());
      return sendPaymentRequired(res, operation, price.price);
    }

    req.x402 = { verified: false, rateLimit: { remaining: freeLimit - userData.count } };
    next();
  };
}

module.exports = {
  requirePayment,
  optionalPayment,
  checkPayment,
  dynamicPayment,
  paidRateLimit,
  sendPaymentRequired,
};
