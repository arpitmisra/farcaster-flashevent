// Market Types
export interface Market {
  id: string;
  address: string;
  question: string;
  expiry: number;
  bettingDeadline: number;
  creator: string;
  status: MarketStatus;
  result: MarketResult;
  yesPool: bigint;
  noPool: bigint;
  totalBets: number;
  yesBets: number;
  noBets: number;
  createdAt: number;
}

export enum MarketStatus {
  ACTIVE = 'active',
  BETTING_CLOSED = 'betting_closed',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export enum MarketResult {
  PENDING = 0,
  YES = 1,
  NO = 2,
}

// User Types
export interface User {
  address: string;
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  followers?: number;
  following?: number;
  level: number;
  xp: number;
  totalBets: number;
  totalWins: number;
  totalProfit: bigint;
  currentStreak: number;
  bestStreak: number;
  marketsCreated: number;
  creatorEarnings: bigint;
  achievements: string[];
  joinedAt: number;
}

// Bet Types
export interface Bet {
  id: string;
  marketAddress: string;
  bettor: string;
  side: 'YES' | 'NO';
  amount: bigint;
  timestamp: number;
  claimed: boolean;
  winnings?: bigint;
}

export interface Position {
  marketAddress: string;
  market: Market;
  side: 'YES' | 'NO';
  amount: bigint;
  claimable: bigint;
  claimed: boolean;
  currentValue: bigint;
  unrealizedPnL: bigint;
  roi: number;
}

// Gamification Types
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  ethReward?: string;
  unlockedAt?: number;
  category: 'betting' | 'creator' | 'social' | 'streak';
}

export interface Level {
  number: number;
  name: string;
  icon: string;
  minXp: number;
  maxXp: number;
  perks: string[];
}

export interface DailyQuest {
  id: string;
  name: string;
  description: string;
  task: string;
  progress: number;
  target: number;
  xpReward: number;
  ethReward?: string;
  expiresAt: number;
  completed: boolean;
}

// Leaderboard Types
export interface LeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  pfpUrl?: string;
  level: number;
  totalProfit: bigint;
  winRate: number;
  totalBets: number;
  totalWins: number;
  currentStreak: number;
  bestStreak: number;
  achievements: string[];
}

export interface CreatorLeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  pfpUrl?: string;
  totalEarnings: bigint;
  marketsCreated: number;
  qualifiedMarkets: number;
  averagePoolSize: bigint;
  successRate: number;
}

// Transaction Types
export interface TransactionState {
  hash?: string;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error?: Error;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Fee Constants
export const FEES = {
  CREATION_FEE: '0.001', // ETH - currently not charged in contract
  BETTING_FEE: '0', // ETH per bet - currently no separate fee
  PLATFORM_FEE_BPS: 250, // 2.5%
  CREATOR_FEE_BPS: 500, // 5%
  MIN_BETS_FOR_CREATOR: 10,
} as const;

// Level Definitions
export const LEVELS: Level[] = [
  { number: 1, name: 'Rookie', icon: '🥚', minXp: 0, maxXp: 100, perks: ['Basic betting', 'Create markets'] },
  { number: 2, name: 'Apprentice', icon: '🌱', minXp: 100, maxXp: 300, perks: ['Creator dashboard', 'Achievement badges'] },
  { number: 3, name: 'Expert', icon: '🏅', minXp: 300, maxXp: 700, perks: ['Advanced analytics', 'Featured on leaderboard'] },
  { number: 4, name: 'Master', icon: '💎', minXp: 700, maxXp: 1500, perks: ['Platform revenue share (0.5%)', 'Special perks'] },
  { number: 5, name: 'Legend', icon: '⚡', minXp: 1500, maxXp: Infinity, perks: ['Maximum revenue share (1%)', 'Hall of Fame'] },
];

// Get level info from XP
export function getLevelFromXP(xp: number): { 
  level: number; 
  name: string; 
  icon: string; 
  progress: number; 
  nextLevelXp: number;
  perks: string[];
} {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      const currentLevel = LEVELS[i];
      const progress = currentLevel.maxXp === Infinity 
        ? 100 
        : ((xp - currentLevel.minXp) / (currentLevel.maxXp - currentLevel.minXp)) * 100;
      
      return {
        level: currentLevel.number,
        name: currentLevel.name,
        icon: currentLevel.icon,
        progress: Math.min(progress, 100),
        nextLevelXp: currentLevel.maxXp === Infinity ? currentLevel.minXp : currentLevel.maxXp,
        perks: currentLevel.perks,
      };
    }
  }
  
  return { 
    level: 1, 
    name: 'Rookie', 
    icon: '🥚', 
    progress: 0, 
    nextLevelXp: 100,
    perks: LEVELS[0].perks,
  };
}

// Achievement Definitions
export const ACHIEVEMENTS: Achievement[] = [
  // Betting Achievements
  { id: 'first_steps', name: 'First Steps', description: 'Connect your wallet', icon: '🥚', xpReward: 10, category: 'betting' },
  { id: 'first_bet', name: 'First Bet', description: 'Place your first bet', icon: '🎯', xpReward: 25, category: 'betting' },
  { id: 'winner', name: 'Winner', description: 'Win your first bet', icon: '🏆', xpReward: 100, category: 'betting' },
  { id: 'hot_streak', name: 'Hot Streak', description: 'Win 3 bets in a row', icon: '🔥', xpReward: 150, category: 'streak' },
  { id: 'unstoppable', name: 'Unstoppable', description: 'Win 5 bets in a row', icon: '⚡', xpReward: 300, ethReward: '0.01', category: 'streak' },
  { id: 'legendary_streak', name: 'Legendary Streak', description: 'Win 10 bets in a row', icon: '👑', xpReward: 500, ethReward: '0.05', category: 'streak' },
  { id: 'big_better', name: 'Big Better', description: 'Place a bet >1 ETH', icon: '💎', xpReward: 150, category: 'betting' },
  { id: 'whale', name: 'Whale', description: 'Place a bet >10 ETH', icon: '🐋', xpReward: 500, category: 'betting' },
  { id: 'prediction_master', name: 'Prediction Master', description: 'Win 10 total bets', icon: '🎓', xpReward: 200, category: 'betting' },
  { id: 'pro_predictor', name: 'Pro Predictor', description: 'Win 50 total bets', icon: '💫', xpReward: 500, ethReward: '0.1', category: 'betting' },
  { id: 'oracle', name: 'Oracle', description: 'Win 100 total bets', icon: '🔮', xpReward: 1000, ethReward: '0.5', category: 'betting' },
  
  // Creator Achievements
  { id: 'market_creator', name: 'Market Creator', description: 'Create your first market', icon: '🎨', xpReward: 100, category: 'creator' },
  { id: 'popular_creator', name: 'Popular Creator', description: 'Market gets 10+ bets', icon: '🌟', xpReward: 200, category: 'creator' },
  { id: 'viral_market', name: 'Viral Market', description: 'Market gets 50+ bets', icon: '🚀', xpReward: 300, category: 'creator' },
  { id: 'mega_market', name: 'Mega Market', description: 'Market gets 100+ bets', icon: '💎', xpReward: 500, ethReward: '0.05', category: 'creator' },
  { id: 'consistent_creator', name: 'Consistent Creator', description: '5 qualified markets', icon: '📊', xpReward: 400, category: 'creator' },
  { id: 'master_creator', name: 'Master Creator', description: '10 qualified markets', icon: '👑', xpReward: 1000, ethReward: '0.1', category: 'creator' },
  
  // Social Achievements
  { id: 'influencer', name: 'Influencer', description: '10 friends join via your link', icon: '📢', xpReward: 200, category: 'social' },
  { id: 'viral_share', name: 'Viral Share', description: 'Your share gets 100+ clicks', icon: '🌟', xpReward: 300, category: 'social' },
];
