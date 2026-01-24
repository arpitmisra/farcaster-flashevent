/**
 * useFarcaster hook - Farcaster social features
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import farcasterService from '../services/farcasterService';
import { logError } from '../utils/errors';
import { QUERY_KEYS } from '../utils/constants';

export const useFarcaster = () => {
  const { user, token } = useAuthStore();
  const queryClient = useQueryClient();

  /**
   * Get user's feed
   */
  const useFeed = (feedType = 'following', options = {}) => {
    return useQuery({
      queryKey: [QUERY_KEYS.SOCIAL_FEED, feedType, user?.fid],
      queryFn: () => farcasterService.getFeed(user?.fid, feedType),
      enabled: !!user?.fid,
      staleTime: 30000, // 30 seconds
      ...options,
    });
  };

  /**
   * Get user profile by FID
   */
  const useUserProfile = (fid, options = {}) => {
    return useQuery({
      queryKey: [QUERY_KEYS.USER_PROFILE, fid],
      queryFn: () => farcasterService.getUserByFid(fid),
      enabled: !!fid,
      staleTime: 60000, // 1 minute
      ...options,
    });
  };

  /**
   * Cast (post) to Farcaster
   */
  const castMutation = useMutation({
    mutationFn: async ({ text, embeds, parent }) => {
      if (!token) throw new Error('Not authenticated');
      return farcasterService.publishCast(token, text, embeds, parent);
    },
    onSuccess: () => {
      // Invalidate feed to show new cast
      queryClient.invalidateQueries([QUERY_KEYS.SOCIAL_FEED]);
    },
    onError: (error) => {
      logError(error, { context: 'farcaster.cast' });
    },
  });

  /**
   * Like a cast
   */
  const likeMutation = useMutation({
    mutationFn: async (castHash) => {
      if (!token) throw new Error('Not authenticated');
      return farcasterService.likeCast(token, castHash);
    },
    onError: (error) => {
      logError(error, { context: 'farcaster.like' });
    },
  });

  /**
   * Recast (repost) a cast
   */
  const recastMutation = useMutation({
    mutationFn: async (castHash) => {
      if (!token) throw new Error('Not authenticated');
      return farcasterService.recast(token, castHash);
    },
    onError: (error) => {
      logError(error, { context: 'farcaster.recast' });
    },
  });

  /**
   * Follow a user
   */
  const followMutation = useMutation({
    mutationFn: async (targetFid) => {
      if (!token) throw new Error('Not authenticated');
      return farcasterService.followUser(token, targetFid);
    },
    onSuccess: (_, targetFid) => {
      queryClient.invalidateQueries([QUERY_KEYS.USER_PROFILE, targetFid]);
    },
    onError: (error) => {
      logError(error, { context: 'farcaster.follow' });
    },
  });

  /**
   * Unfollow a user
   */
  const unfollowMutation = useMutation({
    mutationFn: async (targetFid) => {
      if (!token) throw new Error('Not authenticated');
      return farcasterService.unfollowUser(token, targetFid);
    },
    onSuccess: (_, targetFid) => {
      queryClient.invalidateQueries([QUERY_KEYS.USER_PROFILE, targetFid]);
    },
    onError: (error) => {
      logError(error, { context: 'farcaster.unfollow' });
    },
  });

  /**
   * Cast a market to Farcaster
   */
  const castMarket = useCallback(async (market) => {
    const text = `📊 New prediction market!\n\n"${market.question}"\n\nBet now on FlashEvent Markets`;
    
    const embeds = [
      {
        url: `https://flashevent.xyz/market/${market.id}`,
      },
    ];
    
    return castMutation.mutateAsync({ text, embeds });
  }, [castMutation]);

  /**
   * Cast a bet to Farcaster
   */
  const castBet = useCallback(async (bet, market) => {
    const text = `🎯 I just bet ${bet.side} on:\n\n"${market.question}"\n\nWhat do you think?`;
    
    const embeds = [
      {
        url: `https://flashevent.xyz/market/${market.id}`,
      },
    ];
    
    return castMutation.mutateAsync({ text, embeds });
  }, [castMutation]);

  /**
   * Cast a win to Farcaster
   */
  const castWin = useCallback(async (bet, market, payout) => {
    const text = `🎉 I won ${payout.toFixed(4)} ETH on:\n\n"${market.question}"\n\nPredict the future on FlashEvent Markets`;
    
    const embeds = [
      {
        url: `https://flashevent.xyz/market/${market.id}`,
      },
    ];
    
    return castMutation.mutateAsync({ text, embeds });
  }, [castMutation]);

  /**
   * Search for users
   */
  const searchUsers = useCallback(async (query) => {
    return farcasterService.searchUsers(query);
  }, []);

  /**
   * Get user's followers
   */
  const getFollowers = useCallback(async (fid) => {
    return farcasterService.getFollowers(fid);
  }, []);

  /**
   * Get user's following
   */
  const getFollowing = useCallback(async (fid) => {
    return farcasterService.getFollowing(fid);
  }, []);

  return {
    // Hooks
    useFeed,
    useUserProfile,
    
    // Mutations
    cast: castMutation.mutateAsync,
    like: likeMutation.mutateAsync,
    recast: recastMutation.mutateAsync,
    follow: followMutation.mutateAsync,
    unfollow: unfollowMutation.mutateAsync,
    
    // Helpers
    castMarket,
    castBet,
    castWin,
    searchUsers,
    getFollowers,
    getFollowing,
    
    // Loading states
    isCasting: castMutation.isPending,
    isLiking: likeMutation.isPending,
    isRecasting: recastMutation.isPending,
    isFollowing: followMutation.isPending,
    isUnfollowing: unfollowMutation.isPending,
  };
};

export default useFarcaster;
