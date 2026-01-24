/**
 * Format utilities for FlashEvent Markets
 */

/**
 * Format a number as currency
 */
export const formatCurrency = (value, decimals = 2) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format ETH amount
 */
export const formatETH = (value, decimals = 4) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.0000 ETH';
  }
  return `${value.toFixed(decimals)} ETH`;
};

/**
 * Format percentage
 */
export const formatPercent = (value, decimals = 0) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
};

/**
 * Shorten an address
 */
export const shortenAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

/**
 * Format large numbers (1K, 1M, etc.)
 */
export const formatCompact = (value) => {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

/**
 * Format relative time (e.g., "5 minutes ago")
 */
export const formatTimeAgo = (timestamp) => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  
  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

/**
 * Format countdown timer
 */
export const formatCountdown = (endTime) => {
  const now = Date.now();
  const diff = endTime - now;
  
  if (diff <= 0) return 'Ended';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

/**
 * Format date as readable string
 */
export const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format date and time
 */
export const formatDateTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Format odds as implied probability
 */
export const formatOdds = (yesPool, noPool) => {
  const total = yesPool + noPool;
  if (total === 0) return { yes: 50, no: 50 };
  
  const yes = Math.round((yesPool / total) * 100);
  const no = 100 - yes;
  
  return { yes, no };
};

/**
 * Calculate potential payout
 */
export const calculatePayout = (amount, odds) => {
  if (!amount || !odds || odds >= 100) return 0;
  return amount / (odds / 100);
};

/**
 * Format FID (Farcaster ID)
 */
export const formatFID = (fid) => {
  if (!fid) return 'N/A';
  return `#${fid}`;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Format market type
 */
export const formatMarketType = (type) => {
  const types = {
    0: 'Price Touch',
    1: 'On-chain Event',
    2: 'API Count',
  };
  return types[type] || 'Unknown';
};

/**
 * Format market status
 */
export const formatMarketStatus = (status) => {
  const statuses = {
    0: 'Active',
    1: 'Resolved',
    2: 'Cancelled',
    3: 'Disputed',
  };
  return statuses[status] || 'Unknown';
};

/**
 * Format ether value (handles string or number)
 */
export const formatEther = (value) => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  if (num >= 1000) return formatCompact(num);
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.01) return num.toFixed(3);
  return num.toFixed(4);
};

/**
 * Format address for display
 */
export const formatAddress = (address, chars = 4) => {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};
