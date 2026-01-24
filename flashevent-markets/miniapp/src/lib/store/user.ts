import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Achievement, DailyQuest } from '@/types';
import { getLevelFromXP } from '@/types/index';

interface UserState {
  // User data
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // Gamification
  xp: number;
  level: number;
  levelName: string;
  levelIcon: string;
  levelProgress: number;
  achievements: string[];
  unlockedAchievements: Achievement[];
  dailyQuests: DailyQuest[];
  
  // Actions
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // XP Actions
  addXP: (amount: number, reason?: string) => void;
  unlockAchievement: (achievementId: string) => void;
  updateDailyQuest: (questId: string, progress: number) => void;
  completeDailyQuest: (questId: string) => void;
  
  // Stats updates
  incrementBets: () => void;
  incrementWins: () => void;
  updateStreak: (won: boolean) => void;
  addProfit: (amount: bigint) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  user: null,
  isLoading: false,
  error: null,
  xp: 0,
  level: 1,
  levelName: 'Rookie',
  levelIcon: '🥚',
  levelProgress: 0,
  achievements: [],
  unlockedAchievements: [],
  dailyQuests: [],
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) => {
        if (user) {
          const levelInfo = getLevelFromXP(user.xp);
          set({
            user,
            xp: user.xp,
            level: levelInfo.level,
            levelName: levelInfo.name,
            levelIcon: levelInfo.icon,
            levelProgress: levelInfo.progress,
            achievements: user.achievements,
          });
        } else {
          set({ user: null });
        }
      },

      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...updates } });
        }
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      addXP: (amount, reason) => {
        const currentXP = get().xp;
        const newXP = currentXP + amount;
        const levelInfo = getLevelFromXP(newXP);
        
        console.log(`+${amount} XP${reason ? ` (${reason})` : ''}`);
        
        set({
          xp: newXP,
          level: levelInfo.level,
          levelName: levelInfo.name,
          levelIcon: levelInfo.icon,
          levelProgress: levelInfo.progress,
        });

        // Update user object as well
        const user = get().user;
        if (user) {
          set({ user: { ...user, xp: newXP, level: levelInfo.level } });
        }
      },

      unlockAchievement: (achievementId) => {
        const achievements = get().achievements;
        if (!achievements.includes(achievementId)) {
          set({ achievements: [...achievements, achievementId] });
          
          // Update user object
          const user = get().user;
          if (user) {
            set({ user: { ...user, achievements: [...achievements, achievementId] } });
          }
        }
      },

      updateDailyQuest: (questId, progress) => {
        const quests = get().dailyQuests.map(q => 
          q.id === questId ? { ...q, progress } : q
        );
        set({ dailyQuests: quests });
      },

      completeDailyQuest: (questId) => {
        const quests = get().dailyQuests.map(q => 
          q.id === questId ? { ...q, completed: true } : q
        );
        set({ dailyQuests: quests });
      },

      incrementBets: () => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, totalBets: user.totalBets + 1 } });
        }
      },

      incrementWins: () => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, totalWins: user.totalWins + 1 } });
        }
      },

      updateStreak: (won) => {
        const user = get().user;
        if (user) {
          const newStreak = won ? user.currentStreak + 1 : 0;
          const bestStreak = Math.max(newStreak, user.bestStreak);
          set({ user: { ...user, currentStreak: newStreak, bestStreak } });
        }
      },

      addProfit: (amount) => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, totalProfit: user.totalProfit + amount } });
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'flashevent-user-storage',
      partialize: (state) => ({
        user: state.user,
        xp: state.xp,
        level: state.level,
        achievements: state.achievements,
      }),
    }
  )
);
