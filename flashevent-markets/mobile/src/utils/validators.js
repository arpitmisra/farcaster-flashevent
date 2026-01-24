/**
 * Validation utilities for FlashEvent Markets
 */

import { PATTERNS, LIMITS } from './constants';

/**
 * Validate Ethereum address
 */
export const validateAddress = (address) => {
  if (!address) {
    return { valid: false, error: 'Address is required' };
  }
  if (!PATTERNS.ETH_ADDRESS.test(address)) {
    return { valid: false, error: 'Invalid Ethereum address format' };
  }
  return { valid: true, error: null };
};

/**
 * Validate bet amount
 */
export const validateBetAmount = (amount, balance = Infinity) => {
  if (!amount && amount !== 0) {
    return { valid: false, error: 'Amount is required' };
  }
  
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid amount' };
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' };
  }
  
  if (num < LIMITS.MIN_BET) {
    return { valid: false, error: `Minimum bet is ${LIMITS.MIN_BET} ETH` };
  }
  
  if (num > LIMITS.MAX_BET) {
    return { valid: false, error: `Maximum bet is ${LIMITS.MAX_BET} ETH` };
  }
  
  if (num > balance) {
    return { valid: false, error: 'Insufficient balance' };
  }
  
  return { valid: true, error: null, value: num };
};

/**
 * Validate market question
 */
export const validateMarketQuestion = (question) => {
  if (!question) {
    return { valid: false, error: 'Question is required' };
  }
  
  if (question.length < 10) {
    return { valid: false, error: 'Question must be at least 10 characters' };
  }
  
  if (question.length > LIMITS.MAX_QUESTION_LENGTH) {
    return { valid: false, error: `Question must be less than ${LIMITS.MAX_QUESTION_LENGTH} characters` };
  }
  
  if (!question.includes('?')) {
    return { valid: false, error: 'Question should end with ?' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate price for price touch markets
 */
export const validateTargetPrice = (price, asset = 'ETH') => {
  if (!price && price !== 0) {
    return { valid: false, error: 'Target price is required' };
  }
  
  const num = parseFloat(price);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid price' };
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Price must be greater than 0' };
  }
  
  // Asset-specific limits
  const limits = {
    ETH: { min: 100, max: 100000 },
    BTC: { min: 1000, max: 1000000 },
    SOL: { min: 1, max: 10000 },
    MONAD: { min: 0.01, max: 1000 },
  };
  
  const assetLimits = limits[asset] || { min: 0, max: Infinity };
  
  if (num < assetLimits.min) {
    return { valid: false, error: `Price too low for ${asset}` };
  }
  
  if (num > assetLimits.max) {
    return { valid: false, error: `Price too high for ${asset}` };
  }
  
  return { valid: true, error: null, value: num };
};

/**
 * Validate market duration
 */
export const validateDuration = (duration) => {
  if (!duration) {
    return { valid: false, error: 'Duration is required' };
  }
  
  const validDurations = [3600, 14400, 86400, 259200, 604800];
  
  if (!validDurations.includes(duration)) {
    return { valid: false, error: 'Invalid duration' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate Twitter username
 */
export const validateTwitterUsername = (username) => {
  if (!username) {
    return { valid: false, error: 'Username is required' };
  }
  
  // Remove @ if present
  const cleanUsername = username.replace(/^@/, '');
  
  if (cleanUsername.length < 1) {
    return { valid: false, error: 'Username is required' };
  }
  
  if (cleanUsername.length > 15) {
    return { valid: false, error: 'Twitter usernames must be 15 characters or less' };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }
  
  return { valid: true, error: null, value: cleanUsername };
};

/**
 * Validate tweet count
 */
export const validateTweetCount = (count) => {
  if (!count && count !== 0) {
    return { valid: false, error: 'Tweet count is required' };
  }
  
  const num = parseInt(count, 10);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid count' };
  }
  
  if (num < 1) {
    return { valid: false, error: 'Count must be at least 1' };
  }
  
  if (num > 1000) {
    return { valid: false, error: 'Count cannot exceed 1000' };
  }
  
  return { valid: true, error: null, value: num };
};

/**
 * Validate market creation form
 */
export const validateMarketForm = (type, formData) => {
  const errors = {};
  
  switch (type) {
    case 0: // PRICE_TOUCH
      if (!formData.asset) {
        errors.asset = 'Asset is required';
      }
      
      const priceValidation = validateTargetPrice(formData.price, formData.asset);
      if (!priceValidation.valid) {
        errors.price = priceValidation.error;
      }
      
      if (!formData.duration) {
        errors.duration = 'Duration is required';
      }
      break;
      
    case 1: // ONCHAIN_EVENT
      const addressValidation = validateAddress(formData.address);
      if (!addressValidation.valid) {
        errors.address = addressValidation.error;
      }
      
      if (!formData.action) {
        errors.action = 'Action is required';
      }
      
      if (!formData.duration) {
        errors.duration = 'Duration is required';
      }
      break;
      
    case 2: // API_COUNT
      const usernameValidation = validateTwitterUsername(formData.username);
      if (!usernameValidation.valid) {
        errors.username = usernameValidation.error;
      }
      
      const countValidation = validateTweetCount(formData.count);
      if (!countValidation.valid) {
        errors.count = countValidation.error;
      }
      
      if (!formData.duration) {
        errors.duration = 'Duration is required';
      }
      break;
  }
  
  const isValid = Object.keys(errors).length === 0;
  return { valid: isValid, errors };
};

/**
 * Validate transaction hash
 */
export const validateTxHash = (hash) => {
  if (!hash) {
    return { valid: false, error: 'Transaction hash is required' };
  }
  
  if (!PATTERNS.TX_HASH.test(hash)) {
    return { valid: false, error: 'Invalid transaction hash format' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate FID
 */
export const validateFID = (fid) => {
  if (!fid && fid !== 0) {
    return { valid: false, error: 'FID is required' };
  }
  
  const num = parseInt(fid, 10);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Invalid FID' };
  }
  
  if (num < 1) {
    return { valid: false, error: 'Invalid FID' };
  }
  
  return { valid: true, error: null, value: num };
};

export default {
  validateAddress,
  validateBetAmount,
  validateMarketQuestion,
  validateTargetPrice,
  validateDuration,
  validateTwitterUsername,
  validateTweetCount,
  validateMarketForm,
  validateTxHash,
  validateFID,
};
