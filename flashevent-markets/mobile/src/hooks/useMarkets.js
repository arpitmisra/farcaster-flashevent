/**
 * useMarkets hook - Market data fetching and management
 */

import { useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import apiService from '../services/apiService';
import { useMarketStore } from '../store/marketStore';
import { QUERY_KEYS } from '../utils/constants';

export const useMarkets = () => {
  const { setActiveMarket, setMarkets } = useMarketStore();
  const queryClient = useQueryClient();

  /**
   * Fetch markets list with infinite scrolling
   */
  const useMarketsList = (filters = {}, options = {}) => {
    return useInfiniteQuery({
      queryKey: [QUERY_KEYS.MARKETS, filters],
      queryFn: ({ pageParam = 0 }) => apiService.getMarkets({ ...filters, offset: pageParam }),
      getNextPageParam: (lastPage, pages) => {
        if (lastPage.markets.length < 20) return undefined;
        return pages.length * 20;
      },
      staleTime: 30000, // 30 seconds
      ...options,
    });
  };

  /**
   * Fetch single market details
   */
  const useMarketDetail = (marketId, options = {}) => {
    return useQuery({
      queryKey: [QUERY_KEYS.MARKET_DETAIL, marketId],
      queryFn: () => apiService.getMarket(marketId),
      enabled: !!marketId,
      staleTime: 10000, // 10 seconds
      onSuccess: (data) => {
        setActiveMarket(data);
      },
      ...options,
    });
  };

  /**
   * Fetch trending markets
   */
  const useTrendingMarkets = (options = {}) => {
    return useQuery({
      queryKey: [QUERY_KEYS.TRENDING],
      queryFn: () => apiService.getTrendingMarkets(),
      staleTime: 60000, // 1 minute
      ...options,
    });
  };

  /**
   * Fetch markets from followed users
   */
  const useFollowingMarkets = (fid, options = {}) => {
    return useQuery({
      queryKey: [QUERY_KEYS.FOLLOWING, fid],
      queryFn: () => apiService.getFollowingMarkets(fid),
      enabled: !!fid,
      staleTime: 30000, // 30 seconds
      ...options,
    });
  };

  /**
   * Fetch newly created markets
   */
  const useNewMarkets = (options = {}) => {
    return useQuery({
      queryKey: [QUERY_KEYS.MARKETS, 'new'],
      queryFn: () => apiService.getNewMarkets(),
      staleTime: 30000, // 30 seconds
      ...options,
    });
  };

  /**
   * Search markets
   */
  const searchMarkets = useCallback(async (query) => {
    return apiService.searchMarkets(query);
  }, []);

  /**
   * Refresh all market queries
   */
  const refreshMarkets = useCallback(() => {
    queryClient.invalidateQueries([QUERY_KEYS.MARKETS]);
    queryClient.invalidateQueries([QUERY_KEYS.TRENDING]);
    queryClient.invalidateQueries([QUERY_KEYS.FOLLOWING]);
  }, [queryClient]);

  /**
   * Prefetch a market detail
   */
  const prefetchMarket = useCallback((marketId) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.MARKET_DETAIL, marketId],
      queryFn: () => apiService.getMarket(marketId),
    });
  }, [queryClient]);

  /**
   * Get cached market data
   */
  const getCachedMarket = useCallback((marketId) => {
    return queryClient.getQueryData([QUERY_KEYS.MARKET_DETAIL, marketId]);
  }, [queryClient]);

  /**
   * Update market in cache (optimistic update)
   */
  const updateCachedMarket = useCallback((marketId, updates) => {
    queryClient.setQueryData([QUERY_KEYS.MARKET_DETAIL, marketId], (old) => {
      if (!old) return old;
      return { ...old, ...updates };
    });
  }, [queryClient]);

  return {
    // Query hooks
    useMarketsList,
    useMarketDetail,
    useTrendingMarkets,
    useFollowingMarkets,
    useNewMarkets,
    
    // Functions
    searchMarkets,
    refreshMarkets,
    prefetchMarket,
    getCachedMarket,
    updateCachedMarket,
  };
};

export default useMarkets;
