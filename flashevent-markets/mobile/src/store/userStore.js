import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const USER_PREFS_KEY = 'flashevent_user_prefs';

export const useUserStore = create((set, get) => ({
  // User bets
  userBets: [],
  activeBets: [],
  wonBets: [],
  lostBets: [],
  claimableBets: [],
  
  // User stats
  stats: {
    totalBets: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: '0',
    marketsCreated: 0,
  },
  
  // Achievements
  achievements: [],
  
  // User preferences
  preferences: {
    autoCastBets: true,
    autoCastWins: true,
    notifications: true,
    darkMode: true,
  },
  
  // Loading state
  isLoading: false,
  error: null,

  // Set user bets
  setUserBets: (bets) => {
    const activeBets = bets.filter((b) => !b.market.resolved);
    const resolvedBets = bets.filter((b) => b.market.resolved);
    const wonBets = resolvedBets.filter((b) => b.won);
    const lostBets = resolvedBets.filter((b) => !b.won);
    const claimableBets = wonBets.filter((b) => !b.claimed);
    
    set({
      userBets: bets,
      activeBets,
      wonBets,
      lostBets,
      claimableBets,
    });
  },

  // Add a new bet
  addBet: (bet) => {
    set((state) => {
      const newBets = [bet, ...state.userBets];
      return {
        userBets: newBets,
        activeBets: [bet, ...state.activeBets],
        stats: {
          ...state.stats,
          totalBets: state.stats.totalBets + 1,
        },
      };
    });
  },

  // Update a bet (e.g., when market resolves)
  updateBet: (betId, updates) => {
    set((state) => ({
      userBets: state.userBets.map((b) =>
        b.id === betId ? { ...b, ...updates } : b
      ),
    }));
  },

  // Mark bet as claimed
  markBetClaimed: (betId) => {
    set((state) => ({
      userBets: state.userBets.map((b) =>
        b.id === betId ? { ...b, claimed: true } : b
      ),
      claimableBets: state.claimableBets.filter((b) => b.id !== betId),
    }));
  },

  // Set user stats
  setStats: (stats) => {
    set({ stats });
  },

  // Update stats after a bet result
  updateStatsAfterResult: (won, profitLoss) => {
    set((state) => {
      const newStats = {
        ...state.stats,
        wins: won ? state.stats.wins + 1 : state.stats.wins,
        losses: won ? state.stats.losses : state.stats.losses + 1,
        totalProfit: (
          parseFloat(state.stats.totalProfit) + parseFloat(profitLoss)
        ).toString(),
      };
      newStats.winRate = (newStats.wins / (newStats.wins + newStats.losses)) * 100;
      
      return { stats: newStats };
    });
  },

  // Set achievements
  setAchievements: (achievements) => {
    set({ achievements });
  },

  // Add achievement
  addAchievement: (achievement) => {
    set((state) => ({
      achievements: [...state.achievements, achievement],
    }));
  },

  // Load preferences from storage
  loadPreferences: async () => {
    try {
      const stored = await SecureStore.getItemAsync(USER_PREFS_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        set({ preferences: prefs });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  },

  // Update preferences
  updatePreferences: async (updates) => {
    try {
      const newPrefs = { ...get().preferences, ...updates };
      await SecureStore.setItemAsync(USER_PREFS_KEY, JSON.stringify(newPrefs));
      set({ preferences: newPrefs });
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  },

  // Set loading
  setLoading: (isLoading) => {
    set({ isLoading });
  },

  // Set error
  setError: (error) => {
    set({ error });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store
  reset: () => {
    set({
      userBets: [],
      activeBets: [],
      wonBets: [],
      lostBets: [],
      claimableBets: [],
      stats: {
        totalBets: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalProfit: '0',
        marketsCreated: 0,
      },
      achievements: [],
      isLoading: false,
      error: null,
    });
  },
}));

export default useUserStore;
