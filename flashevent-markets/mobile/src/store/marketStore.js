import { create } from 'zustand';

export const useMarketStore = create((set, get) => ({
  // State
  markets: [],
  activeMarkets: [],
  trendingMarkets: [],
  userMarkets: [],
  selectedMarket: null,
  isLoading: false,
  error: null,
  
  // Filters
  filter: 'all', // 'all', 'following', 'trending', 'new', 'ending-soon'
  sortBy: 'newest', // 'newest', 'pool-size', 'ending-soon', 'popular'

  // Set markets
  setMarkets: (markets) => {
    set({ markets });
  },

  // Add a new market
  addMarket: (market) => {
    set((state) => ({
      markets: [market, ...state.markets],
    }));
  },

  // Update a market
  updateMarket: (marketAddress, updates) => {
    set((state) => ({
      markets: state.markets.map((m) =>
        m.address === marketAddress ? { ...m, ...updates } : m
      ),
      selectedMarket:
        state.selectedMarket?.address === marketAddress
          ? { ...state.selectedMarket, ...updates }
          : state.selectedMarket,
    }));
  },

  // Select a market
  selectMarket: (market) => {
    set({ selectedMarket: market });
  },

  // Clear selected market
  clearSelectedMarket: () => {
    set({ selectedMarket: null });
  },

  // Set filter
  setFilter: (filter) => {
    set({ filter });
  },

  // Set sort
  setSortBy: (sortBy) => {
    set({ sortBy });
  },

  // Get filtered and sorted markets
  getFilteredMarkets: () => {
    const { markets, filter, sortBy } = get();
    
    let filtered = [...markets];
    
    // Apply filters
    switch (filter) {
      case 'trending':
        filtered = filtered.filter((m) => m.isTrending);
        break;
      case 'new':
        filtered = filtered.filter((m) => {
          const hourAgo = Date.now() - 3600000;
          return m.createdAt > hourAgo;
        });
        break;
      case 'ending-soon':
        filtered = filtered.filter((m) => {
          const hourFromNow = Date.now() + 3600000;
          return m.endTime < hourFromNow && !m.resolved;
        });
        break;
      default:
        break;
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'pool-size':
        filtered.sort((a, b) => parseFloat(b.totalPool) - parseFloat(a.totalPool));
        break;
      case 'ending-soon':
        filtered.sort((a, b) => a.endTime - b.endTime);
        break;
      case 'popular':
        filtered.sort((a, b) => b.bettorCount - a.bettorCount);
        break;
      default:
        break;
    }
    
    return filtered;
  },

  // Set loading state
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
      markets: [],
      activeMarkets: [],
      trendingMarkets: [],
      userMarkets: [],
      selectedMarket: null,
      isLoading: false,
      error: null,
      filter: 'all',
      sortBy: 'newest',
    });
  },
}));

export default useMarketStore;
