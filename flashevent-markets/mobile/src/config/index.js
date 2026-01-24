import { MONAD_TESTNET } from './chains';
import { CONTRACT_ADDRESSES } from './contracts';

// Get local network IP - for real device testing, use your computer's IP
// For emulator: Android uses 10.0.2.2, iOS uses localhost
import { Platform } from 'react-native';

// =====================================================
// Platform-specific API URL handling for development
// - Android Emulator: Uses 10.0.2.2 to reach host machine
// - iOS Simulator: Uses localhost
// - Real devices: Must set EXPO_PUBLIC_API_URL in .env
// =====================================================
const getDefaultApiUrl = () => {
  // Android emulator uses 10.0.2.2 to reach host machine's localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  }
  // iOS simulator can use localhost directly
  return 'http://localhost:3001/api';
};

const getApiHost = () => {
  // First priority: Use environment variable if set
  if (process.env.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    console.log('[Config] Using env API URL:', envUrl);
    return envUrl;
  }
  
  // Fallback to platform-specific default
  const defaultUrl = getDefaultApiUrl();
  console.log('[Config] Using default API URL:', defaultUrl);
  return defaultUrl;
};

console.log(`[Config] Backend configured at: ${getApiHost()}`);
console.log(`[Config] Platform: ${Platform.OS}`);

// App-wide configuration
const config = {
  // App info
  APP_NAME: 'FlashEvent Markets',
  APP_VERSION: '1.0.0',
  
  // API URLs - dynamically resolved
  API_URL: getApiHost(),
  BACKEND_URL: getApiHost().replace('/api', ''),
  FRAMES_URL: process.env.EXPO_PUBLIC_FRAMES_URL || `http://${LOCAL_IP}:3002`,
  
  // Farcaster/Neynar API
  NEYNAR_API_KEY: process.env.EXPO_PUBLIC_NEYNAR_API_KEY || '',
  NEYNAR_CLIENT_ID: process.env.EXPO_PUBLIC_NEYNAR_CLIENT_ID || '',
  
  // Default chain
  DEFAULT_CHAIN: MONAD_TESTNET,
  
  // Contract addresses
  CONTRACT_ADDRESSES,
  
  // Explorer URL
  MONAD_EXPLORER_URL: 'https://testnet.monadexplorer.com',
  
  // Market creation fee (in MON)
  MARKET_CREATION_FEE: '0.001',
  
  // x402 Payment Configuration
  X402_RECIPIENT: process.env.EXPO_PUBLIC_X402_RECIPIENT || '0xBb689Fd2A92b6EB905e56C3726Bf090fA2D3a6a4',
  X402_SPENDING_LIMIT: process.env.EXPO_PUBLIC_X402_SPENDING_LIMIT || '0.1', // MON tokens
  
  // Minimum bet amount (in MON)
  MIN_BET_AMOUNT: '0.001',
  
  // Maximum bet amount (in MON)
  MAX_BET_AMOUNT: '10',
  
  // Default bet amounts for quick selection
  DEFAULT_BET_AMOUNTS: ['0.01', '0.05', '0.1', '0.5'],
  
  // Market durations (in seconds)
  MARKET_DURATIONS: [
    { label: '1 hour', value: 3600 },
    { label: '4 hours', value: 14400 },
    { label: '12 hours', value: 43200 },
    { label: '24 hours', value: 86400 },
    { label: '3 days', value: 259200 },
    { label: '7 days', value: 604800 },
  ],
  
  // Sports market specific durations
  SPORTS_DURATIONS: [
    { label: 'Match end', value: 0 }, // Auto-calculated based on match date
    { label: '+ 2 hours', value: 7200 }, // 2 hours after match
    { label: '+ 6 hours', value: 21600 }, // 6 hours after match
    { label: '+ 24 hours', value: 86400 }, // 24 hours after match
  ],
  
  // Supported sports for SPORTS markets
  SUPPORTED_SPORTS: [
    { id: 'soccer', name: 'Football/Soccer', icon: '⚽', leagues: ['Premier League', 'La Liga', 'Champions League', 'Serie A'] },
    { id: 'cricket', name: 'Cricket', icon: '🏏', leagues: ['IPL', 'World Cup', 'Ashes', 'Test Series'] },
    { id: 'basketball', name: 'Basketball (NBA)', icon: '🏀', leagues: ['NBA', 'NBA Playoffs', 'NBA Finals'] },
    { id: 'american_football', name: 'American Football', icon: '🏈', leagues: ['NFL', 'Super Bowl', 'NFL Playoffs'] },
    { id: 'tennis', name: 'Tennis', icon: '🎾', leagues: ['Wimbledon', 'US Open', 'Australian Open', 'French Open'] },
  ],
  
  // Supported assets for PRICE_TOUCH markets
  SUPPORTED_ASSETS: [
    { symbol: 'ETH/USD', name: 'Ethereum', icon: '⟠' },
    { symbol: 'BTC/USD', name: 'Bitcoin', icon: '₿' },
    { symbol: 'SOL/USD', name: 'Solana', icon: '◎' },
    { symbol: 'MATIC/USD', name: 'Polygon', icon: '⬡' },
  ],
  
  // Cache times (in ms)
  CACHE_TIMES: {
    MARKETS: 1000 * 60 * 1, // 1 minute
    PRICES: 1000 * 30, // 30 seconds
    USER_BETS: 1000 * 60 * 2, // 2 minutes
  },
  
  // Refresh intervals (in ms)
  REFRESH_INTERVALS: {
    MARKETS: 1000 * 30, // 30 seconds
    PRICES: 1000 * 10, // 10 seconds
    COUNTDOWN: 1000, // 1 second
  },
};

export default config;
