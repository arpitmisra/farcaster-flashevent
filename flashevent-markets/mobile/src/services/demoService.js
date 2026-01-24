/**
 * Demo Service - Provides mock data when backend is unavailable
 */

import config from '../config';

// Demo markets data
const DEMO_MARKETS = [
  {
    id: 'demo-1',
    address: '0x1234567890123456789012345678901234567890',
    question: 'Will BTC reach $150,000 by end of January 2026?',
    expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
    result: 0,
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
    expiry: Date.now() + 30 * 24 * 60 * 60 * 1000,
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
    expiry: Date.now() + 60 * 24 * 60 * 60 * 1000,
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
    expiry: Date.now() + 14 * 24 * 60 * 60 * 1000,
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
    expiry: Date.now() + 45 * 24 * 60 * 60 * 1000,
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

class DemoService {
  constructor() {
    this.demoMode = false;
  }

  enableDemoMode() {
    this.demoMode = true;
    console.log('📱 Demo mode enabled - using mock data');
  }

  isDemoMode() {
    return this.demoMode;
  }

  async getMarkets(filters = {}) {
    await this._simulateDelay();
    let markets = [...DEMO_MARKETS];

    if (filters.category) {
      markets = markets.filter(m => m.category === filters.category);
    }

    return {
      success: true,
      data: {
        markets,
        total: markets.length,
        demoMode: true,
      },
    };
  }

  async getMarket(id) {
    await this._simulateDelay();
    const market = DEMO_MARKETS.find(m => m.id === id || m.address === id);
    
    if (!market) {
      throw new Error('Market not found');
    }

    return {
      success: true,
      data: market,
    };
  }

  async getTrendingMarkets(limit = 5) {
    await this._simulateDelay();
    return {
      success: true,
      data: DEMO_MARKETS.slice(0, limit),
    };
  }

  async placeBet(marketId, side, amount) {
    await this._simulateDelay();
    return {
      success: true,
      data: {
        id: `demo-bet-${Date.now()}`,
        marketId,
        side,
        amount,
        timestamp: Date.now(),
        txHash: '0x' + 'demo'.repeat(16),
      },
      message: '⚠️ Demo mode - bet simulated (no real transaction)',
    };
  }

  async _simulateDelay() {
    // Simulate network delay for realistic UX
    return new Promise(resolve => setTimeout(resolve, 300));
  }
}

export default new DemoService();
