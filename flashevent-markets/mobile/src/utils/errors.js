/**
 * Error handling utilities for FlashEvent Markets
 */

import { ERROR_MESSAGES } from './constants';

/**
 * Custom app error class
 */
export class AppError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error codes
 */
export const ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Auth errors
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  
  // Wallet errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  WALLET_REJECTED: 'WALLET_REJECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // Transaction errors
  TX_FAILED: 'TX_FAILED',
  TX_REJECTED: 'TX_REJECTED',
  TX_TIMEOUT: 'TX_TIMEOUT',
  GAS_ESTIMATION_FAILED: 'GAS_ESTIMATION_FAILED',
  
  // Market errors
  MARKET_NOT_FOUND: 'MARKET_NOT_FOUND',
  MARKET_ENDED: 'MARKET_ENDED',
  MARKET_RESOLVED: 'MARKET_RESOLVED',
  INVALID_BET: 'INVALID_BET',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Generic errors
  UNKNOWN: 'UNKNOWN',
};

/**
 * Parse error from various sources
 */
export const parseError = (error) => {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }
  
  // Network errors
  if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
    return new AppError(ERROR_MESSAGES.NETWORK_ERROR, ERROR_CODES.NETWORK_ERROR, error);
  }
  
  // Ethers.js errors
  if (error.code === 'CALL_EXCEPTION' || error.code === 'UNPREDICTABLE_GAS_LIMIT') {
    return new AppError(ERROR_MESSAGES.TRANSACTION_FAILED, ERROR_CODES.TX_FAILED, error);
  }
  
  if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
    return new AppError('Transaction rejected by user', ERROR_CODES.TX_REJECTED, error);
  }
  
  if (error.code === 'INSUFFICIENT_FUNDS') {
    return new AppError(ERROR_MESSAGES.INSUFFICIENT_BALANCE, ERROR_CODES.INSUFFICIENT_BALANCE, error);
  }
  
  // Server errors
  if (error.response?.status >= 500) {
    return new AppError('Server error. Please try again later.', ERROR_CODES.SERVER_ERROR, error);
  }
  
  if (error.response?.status === 401) {
    return new AppError(ERROR_MESSAGES.AUTH_FAILED, ERROR_CODES.AUTH_FAILED, error);
  }
  
  if (error.response?.status === 404) {
    return new AppError(ERROR_MESSAGES.MARKET_NOT_FOUND, ERROR_CODES.MARKET_NOT_FOUND, error);
  }
  
  // Contract errors
  if (error.reason) {
    const reason = error.reason.toLowerCase();
    
    if (reason.includes('market ended') || reason.includes('expired')) {
      return new AppError(ERROR_MESSAGES.MARKET_ENDED, ERROR_CODES.MARKET_ENDED, error);
    }
    
    if (reason.includes('already resolved')) {
      return new AppError('Market has already been resolved', ERROR_CODES.MARKET_RESOLVED, error);
    }
    
    if (reason.includes('insufficient')) {
      return new AppError(ERROR_MESSAGES.INSUFFICIENT_BALANCE, ERROR_CODES.INSUFFICIENT_BALANCE, error);
    }
    
    return new AppError(error.reason, ERROR_CODES.TX_FAILED, error);
  }
  
  // Default
  return new AppError(
    error.message || ERROR_MESSAGES.GENERIC_ERROR,
    ERROR_CODES.UNKNOWN,
    error
  );
};

/**
 * Get user-friendly error message
 */
export const getErrorMessage = (error) => {
  const parsed = parseError(error);
  return parsed.message;
};

/**
 * Check if error is recoverable
 */
export const isRecoverableError = (error) => {
  const parsed = parseError(error);
  
  const unrecoverableCodes = [
    ERROR_CODES.AUTH_EXPIRED,
    ERROR_CODES.MARKET_ENDED,
    ERROR_CODES.MARKET_RESOLVED,
  ];
  
  return !unrecoverableCodes.includes(parsed.code);
};

/**
 * Check if error requires re-authentication
 */
export const requiresReauth = (error) => {
  const parsed = parseError(error);
  return parsed.code === ERROR_CODES.AUTH_FAILED || parsed.code === ERROR_CODES.AUTH_EXPIRED;
};

/**
 * Log error for debugging
 * Uses console.warn for expected errors (timeouts, network) to avoid red error boxes
 */
export const logError = (error, context = {}) => {
  const parsed = parseError(error);
  const errorInfo = {
    message: parsed.message,
    code: parsed.code,
    timestamp: parsed.timestamp,
    context,
    originalError: parsed.originalError,
  };
  
  // Use console.warn for expected/non-critical errors to avoid red LogBox
  const isExpectedError = 
    parsed.message?.includes('timeout') ||
    parsed.message?.includes('Timeout') ||
    parsed.message?.includes('approval not received') ||
    parsed.message?.includes('Network Error') ||
    parsed.code === 'TIMEOUT' ||
    parsed.code === 'NETWORK_ERROR' ||
    context?.context?.includes('metamask');
  
  if (isExpectedError) {
    console.warn('[FlashEvent Warning]', JSON.stringify(errorInfo));
  } else {
    console.error('[FlashEvent Error]', JSON.stringify(errorInfo));
  }
  
  // In production, you would send this to an error tracking service
  // like Sentry, Bugsnag, etc.
};

/**
 * Create error handler for async functions
 */
export const createErrorHandler = (defaultMessage = ERROR_MESSAGES.GENERIC_ERROR) => {
  return (error) => {
    const parsed = parseError(error);
    logError(parsed);
    return { error: parsed, message: parsed.message || defaultMessage };
  };
};

/**
 * Wrap async function with error handling
 */
export const withErrorHandling = (fn, onError) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const parsed = parseError(error);
      logError(parsed);
      
      if (onError) {
        onError(parsed);
      }
      
      throw parsed;
    }
  };
};

export default {
  AppError,
  ERROR_CODES,
  parseError,
  getErrorMessage,
  isRecoverableError,
  requiresReauth,
  logError,
  createErrorHandler,
  withErrorHandling,
};
