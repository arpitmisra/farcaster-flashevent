import { create } from 'zustand';
import { Market, MarketStatus, MarketResult } from '@/types';

interface MarketsState {
  // Data
  markets: Market[];
  trendingMarkets: Market[];
  userMarkets: Market[];
  selectedMarket: Market | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingTrending: boolean;
  error: string | null;
  
  // Filters
  filter: {
    status: MarketStatus | 'all';
    sortBy: 'newest' | 'ending' | 'popular' | 'pool';
    category: string | 'all';
  };
  
  // Actions
  setMarkets: (markets: Market[]) => void;
  addMarket: (market: Market) => void;
  updateMarket: (address: string, updates: Partial<Market>) => void;
  setTrendingMarkets: (markets: Market[]) => void;
  setUserMarkets: (markets: Market[]) => void;
  setSelectedMarket: (market: Market | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setFilter: (filter: Partial<MarketsState['filter']>) => void;
  
  // Helpers
  getMarketByAddress: (address: string) => Market | undefined;
  getActiveMarkets: () => Market[];
  getResolvedMarkets: () => Market[];
}

export const useMarketsStore = create<MarketsState>((set, get) => ({
  markets: [],
  trendingMarkets: [],
  userMarkets: [],
  selectedMarket: null,
  isLoading: false,
  isLoadingTrending: false,
  error: null,
  filter: {
    status: 'all',
    sortBy: 'newest',
    category: 'all',
  },

  setMarkets: (markets) => set({ markets }),

  addMarket: (market) => {
    const markets = get().markets;
    set({ markets: [market, ...markets] });
  },

  updateMarket: (address, updates) => {
    const markets = get().markets.map(m => 
      m.address === address ? { ...m, ...updates } : m
    );
    set({ markets });
    
    // Also update selected market if it's the same
    const selected = get().selectedMarket;
    if (selected?.address === address) {
      set({ selectedMarket: { ...selected, ...updates } });
    }
  },

  setTrendingMarkets: (trendingMarkets) => set({ trendingMarkets }),
  setUserMarkets: (userMarkets) => set({ userMarkets }),
  setSelectedMarket: (selectedMarket) => set({ selectedMarket }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilter: (filter) => set({ filter: { ...get().filter, ...filter } }),

  getMarketByAddress: (address) => {
    return get().markets.find(m => m.address.toLowerCase() === address.toLowerCase());
  },

  getActiveMarkets: () => {
    return get().markets.filter(m => m.status === MarketStatus.ACTIVE);
  },

  getResolvedMarkets: () => {
    return get().markets.filter(m => m.result !== MarketResult.PENDING);
  },
}));
