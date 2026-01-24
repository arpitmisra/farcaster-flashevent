/**
 * Helper utilities for FlashEvent Markets
 */

import { Platform } from 'react-native';
import { PATTERNS, LIMITS } from './constants';

/**
 * Check if running on iOS
 */
export const isIOS = Platform.OS === 'ios';

/**
 * Check if running on Android
 */
export const isAndroid = Platform.OS === 'android';

/**
 * Validate Ethereum address
 */
export const isValidAddress = (address) => {
  if (!address) return false;
  return PATTERNS.ETH_ADDRESS.test(address);
};

/**
 * Validate transaction hash
 */
export const isValidTxHash = (hash) => {
  if (!hash) return false;
  return PATTERNS.TX_HASH.test(hash);
};

/**
 * Validate bet amount
 */
export const isValidBetAmount = (amount, balance = Infinity) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return false;
  if (num < LIMITS.MIN_BET) return false;
  if (num > LIMITS.MAX_BET) return false;
  if (num > balance) return false;
  return true;
};

/**
 * Validate username
 */
export const isValidUsername = (username) => {
  if (!username) return false;
  if (username.length > LIMITS.MAX_USERNAME_LENGTH) return false;
  return PATTERNS.USERNAME.test(username);
};

/**
 * Sleep/delay utility
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
 */
export const retry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i));
      }
    }
  }
  
  throw lastError;
};

/**
 * Debounce a function
 */
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle a function
 */
export const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Deep clone an object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj) => {
  if (!obj) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
};

/**
 * Generate a random ID
 */
export const generateId = (length = 8) => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
};

/**
 * Calculate odds from pool amounts
 */
export const calculateOdds = (yesPool, noPool) => {
  const total = yesPool + noPool;
  if (total === 0) return { yes: 50, no: 50 };
  
  const yes = Math.round((noPool / total) * 100); // Higher NO pool = higher YES odds
  const no = 100 - yes;
  
  return { yes: Math.max(1, Math.min(99, yes)), no: Math.max(1, Math.min(99, no)) };
};

/**
 * Calculate potential payout for a bet
 */
export const calculatePotentialPayout = (amount, side, yesPool, noPool) => {
  const total = yesPool + noPool + amount;
  const winPool = side === 'YES' ? yesPool + amount : noPool + amount;
  const losePool = side === 'YES' ? noPool : yesPool;
  
  // Your share of the losing pool + your original amount
  const share = (amount / winPool) * losePool;
  return amount + share;
};

/**
 * Parse Wei to ETH
 */
export const weiToEth = (wei) => {
  if (!wei) return 0;
  return parseFloat(wei) / 1e18;
};

/**
 * Parse ETH to Wei
 */
export const ethToWei = (eth) => {
  if (!eth) return '0';
  return (parseFloat(eth) * 1e18).toString();
};

/**
 * Get initials from a name
 */
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

/**
 * Generate a color from a string (for avatars)
 */
export const stringToColor = (str) => {
  if (!str) return '#8B5CF6';
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
  ];
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Check if a market has ended
 */
export const hasMarketEnded = (endTime) => {
  return Date.now() > endTime;
};

/**
 * Get time remaining for a market
 */
export const getTimeRemaining = (endTime) => {
  const diff = endTime - Date.now();
  if (diff <= 0) return { ended: true };
  
  return {
    ended: false,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
};

/**
 * Safe JSON parse
 */
export const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Open URL safely
 */
export const openURL = async (url) => {
  const { Linking } = require('react-native');
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text) => {
  const { Clipboard } = require('react-native');
  try {
    await Clipboard.setString(text);
    return true;
  } catch {
    return false;
  }
};

export default {
  isIOS,
  isAndroid,
  isValidAddress,
  isValidTxHash,
  isValidBetAmount,
  isValidUsername,
  sleep,
  retry,
  debounce,
  throttle,
  deepClone,
  isEmpty,
  generateId,
  calculateOdds,
  calculatePotentialPayout,
  weiToEth,
  ethToWei,
  getInitials,
  stringToColor,
  hasMarketEnded,
  getTimeRemaining,
  safeJsonParse,
  openURL,
  copyToClipboard,
};
