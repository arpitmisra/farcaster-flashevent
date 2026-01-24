/**
 * App constants for FlashEvent Markets
 */

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'flashevent_auth_token',
  AUTH_USER: 'flashevent_auth_user',
  WALLET_ADDRESS: 'flashevent_wallet_address',
  WALLET_PRIVATE_KEY: 'flashevent_wallet_pk',
  SETTINGS: 'flashevent_settings',
  CACHE_MARKETS: 'flashevent_cache_markets',
  LAST_SYNC: 'flashevent_last_sync',
};

// Query keys for React Query
export const QUERY_KEYS = {
  MARKETS: 'markets',
  MARKET_DETAIL: 'marketDetail',
  MY_BETS: 'myBets',
  BET_DETAIL: 'betDetail',
  USER_PROFILE: 'userProfile',
  USER_STATS: 'userStats',
  SOCIAL_FEED: 'socialFeed',
  TRENDING: 'trending',
  FOLLOWING: 'following',
  WALLET_BALANCE: 'walletBalance',
  NOTIFICATIONS: 'notifications',
};

// Market types
export const MARKET_TYPES = {
  PRICE_TOUCH: 0,
  ONCHAIN_EVENT: 1,
  API_COUNT: 2,
};

// Market statuses
export const MARKET_STATUS = {
  ACTIVE: 0,
  RESOLVED: 1,
  CANCELLED: 2,
  DISPUTED: 3,
};

// Bet sides
export const BET_SIDES = {
  YES: 'YES',
  NO: 'NO',
};

// Transaction types
export const TX_TYPES = {
  BET: 'bet',
  CREATE_MARKET: 'create_market',
  CLAIM: 'claim',
  WITHDRAW: 'withdraw',
};

// Animation durations (ms)
export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  SPLASH: 2000,
};

// API endpoints
export const ENDPOINTS = {
  MARKETS: '/markets',
  MARKET: '/markets/:id',
  BETS: '/bets',
  BET: '/bets/:id',
  USERS: '/users',
  USER: '/users/:id',
  FEED: '/feed',
  RESOLVE: '/resolve',
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction.',
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  MARKET_NOT_FOUND: 'Market not found.',
  BET_FAILED: 'Failed to place bet. Please try again.',
  INVALID_AMOUNT: 'Please enter a valid amount.',
  MARKET_ENDED: 'This market has ended.',
  ALREADY_CLAIMED: 'You have already claimed your winnings.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
};

// Supported assets for price markets
export const SUPPORTED_ASSETS = [
  { symbol: 'ETH', icon: '⟠', name: 'Ethereum' },
  { symbol: 'BTC', icon: '₿', name: 'Bitcoin' },
  { symbol: 'SOL', icon: '◎', name: 'Solana' },
  { symbol: 'MONAD', icon: 'Ⓜ️', name: 'Monad' },
];

// Market durations
export const MARKET_DURATIONS = [
  { label: '1h', value: 3600 },
  { label: '4h', value: 14400 },
  { label: '24h', value: 86400 },
  { label: '3d', value: 259200 },
  { label: '1w', value: 604800 },
];

// Bet amount presets
export const BET_PRESETS = [
  { label: '0.01', value: 0.01 },
  { label: '0.05', value: 0.05 },
  { label: '0.1', value: 0.1 },
  { label: '0.5', value: 0.5 },
  { label: '1', value: 1 },
];

// Deep link routes
export const DEEP_LINKS = {
  MARKET: 'market/:id',
  PROFILE: 'profile/:fid',
  CREATE: 'create',
  SETTINGS: 'settings',
};

// Feature flags
export const FEATURES = {
  ZK_PROOFS: true,
  X402_PAYMENTS: true,
  FARCASTER_FRAMES: true,
  SOCIAL_FEED: true,
  DARK_MODE: true,
  BIOMETRICS: false,
};

// Regex patterns
export const PATTERNS = {
  ETH_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TX_HASH: /^0x[a-fA-F0-9]{64}$/,
  USERNAME: /^[a-zA-Z0-9_.]+$/,
  AMOUNT: /^\d*\.?\d+$/,
};

// Limits
export const LIMITS = {
  MIN_BET: 0.001,
  MAX_BET: 100,
  MIN_CREATION_FEE: 0.01,
  MAX_QUESTION_LENGTH: 280,
  MAX_USERNAME_LENGTH: 20,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  REFRESH_INTERVAL: 30 * 1000, // 30 seconds
};

// Social actions
export const SOCIAL_ACTIONS = {
  LIKE: 'like',
  RECAST: 'recast',
  REPLY: 'reply',
  SHARE: 'share',
};

export default {
  STORAGE_KEYS,
  QUERY_KEYS,
  MARKET_TYPES,
  MARKET_STATUS,
  BET_SIDES,
  TX_TYPES,
  ANIMATION,
  ENDPOINTS,
  ERROR_MESSAGES,
  SUPPORTED_ASSETS,
  MARKET_DURATIONS,
  BET_PRESETS,
  DEEP_LINKS,
  FEATURES,
  PATTERNS,
  LIMITS,
  SOCIAL_ACTIONS,
};
