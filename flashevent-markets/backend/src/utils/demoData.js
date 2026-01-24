/**
 * Demo data for testing without database/contracts
 */

const DEMO_MARKETS = [
  {
    id: 'demo-1',
    address: '0x1234567890123456789012345678901234567890',
    question: 'Will BTC reach $150,000 by end of January 2026?',
    expiry: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    result: 0, // Pending
    resultLabel: 'Pending',
    totalYesBetsAmount: 45.5,
    totalNoBetsAmount: 32.8,
    totalYesBets: 124,
    totalNoBets: 89,
    totalPool: 78.3,
    yesProbability: 58,
    noProbability: 42,
    isExpired: false,
    isResolved: false,
    category: 'crypto',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'demo-2',
    address: '0x2345678901234567890123456789012345678901',
    question: 'Will ETH flip BTC market cap in 2026?',
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    result: 0,
    resultLabel: 'Pending',
    totalYesBetsAmount: 120.2,
    totalNoBetsAmount: 280.5,
    totalYesBets: 312,
    totalNoBets: 567,
    totalPool: 400.7,
    yesProbability: 30,
    noProbability: 70,
    isExpired: false,
    isResolved: false,
    category: 'crypto',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'demo-3',
    address: '0x3456789012345678901234567890123456789012',
    question: 'Will Monad mainnet launch in Q1 2026?',
    expiry: Date.now() + 60 * 24 * 60 * 60 * 1000, // 60 days
    result: 0,
    resultLabel: 'Pending',
    totalYesBetsAmount: 89.1,
    totalNoBetsAmount: 45.3,
    totalYesBets: 234,
    totalNoBets: 123,
    totalPool: 134.4,
    yesProbability: 66,
    noProbability: 34,
    isExpired: false,
    isResolved: false,
    category: 'crypto',
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'demo-4',
    address: '0x4567890123456789012345678901234567890123',
    question: 'Will TSM win the next League of Legends championship?',
    expiry: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days
    result: 0,
    resultLabel: 'Pending',
    totalYesBetsAmount: 23.4,
    totalNoBetsAmount: 56.7,
    totalYesBets: 89,
    totalNoBets: 156,
    totalPool: 80.1,
    yesProbability: 29,
    noProbability: 71,
    isExpired: false,
    isResolved: false,
    category: 'esports',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'demo-5',
    address: '0x5678901234567890123456789012345678901234',
    question: 'Will Farcaster reach 1M daily active users by March 2026?',
    expiry: Date.now() + 45 * 24 * 60 * 60 * 1000, // 45 days
    result: 0,
    resultLabel: 'Pending',
    totalYesBetsAmount: 67.8,
    totalNoBetsAmount: 34.2,
    totalYesBets: 189,
    totalNoBets: 98,
    totalPool: 102.0,
    yesProbability: 66,
    noProbability: 34,
    isExpired: false,
    isResolved: false,
    category: 'social',
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
];

const DEMO_USER = {
  id: 'demo-user',
  fid: 12345,
  username: 'demo_user',
  displayName: 'Demo User',
  pfpUrl: 'https://i.pravatar.cc/150?img=3',
  bio: 'FlashEvent Markets beta tester',
  followerCount: 1234,
  followingCount: 567,
  createdAt: Date.now(),
};

const DEMO_BETS = [
  {
    id: 'bet-1',
    marketId: 'demo-1',
    userId: 'demo-user',
    side: 'YES',
    amount: 0.5,
    timestamp: Date.now() - 1 * 60 * 60 * 1000,
  },
  {
    id: 'bet-2',
    marketId: 'demo-3',
    userId: 'demo-user',
    side: 'NO',
    amount: 0.25,
    timestamp: Date.now() - 2 * 60 * 60 * 1000,
  },
];

function isDemoMode() {
  return !process.env.MARKET_FACTORY_ADDRESS;
}

function getDemoMarkets(filters = {}) {
  let markets = [...DEMO_MARKETS];
  
  if (filters.category) {
    markets = markets.filter(m => m.category === filters.category);
  }
  
  return {
    markets,
    total: markets.length,
    page: 1,
    limit: 20,
    demoMode: true,
  };
}

function getDemoMarketById(id) {
  return DEMO_MARKETS.find(m => m.id === id || m.address === id);
}

function getDemoTrendingMarkets(limit = 10) {
  return DEMO_MARKETS.slice(0, limit).map(m => ({
    ...m,
    trending: true,
  }));
}

function getDemoUser() {
  return DEMO_USER;
}

function getDemoUserBets() {
  return DEMO_BETS.map(bet => ({
    ...bet,
    market: DEMO_MARKETS.find(m => m.id === bet.marketId),
  }));
}

module.exports = {
  DEMO_MARKETS,
  DEMO_USER,
  DEMO_BETS,
  isDemoMode,
  getDemoMarkets,
  getDemoMarketById,
  getDemoTrendingMarkets,
  getDemoUser,
  getDemoUserBets,
};
