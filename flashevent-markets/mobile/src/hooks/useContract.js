/**
 * useContract hook - Smart contract interactions
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import contractService from '../services/contractService';
import { useWalletStore } from '../store/walletStore';
import { logError } from '../utils/errors';
import { QUERY_KEYS } from '../utils/constants';

export const useContract = () => {
  const { address, setBalance } = useWalletStore();
  const queryClient = useQueryClient();

  /**
   * Create a new market
   */
  const createMarketMutation = useMutation({
    mutationFn: async ({ marketType, question, endTime, parameters }) => {
      if (!address) throw new Error('Wallet not connected');
      
      return contractService.createMarket(marketType, question, endTime, parameters);
    },
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.MARKETS]);
      // Refresh balance
      contractService.getBalance(address).then(setBalance);
    },
    onError: (error) => {
      logError(error, { context: 'contract.createMarket' });
    },
  });

  /**
   * Place a bet on a market
   */
  const placeBetMutation = useMutation({
    mutationFn: async ({ marketId, side, amount }) => {
      if (!address) throw new Error('Wallet not connected');
      
      return contractService.placeBet(marketId, side, amount);
    },
    onSuccess: (_, { marketId }) => {
      queryClient.invalidateQueries([QUERY_KEYS.MARKET_DETAIL, marketId]);
      queryClient.invalidateQueries([QUERY_KEYS.MY_BETS]);
      // Refresh balance
      contractService.getBalance(address).then(setBalance);
    },
    onError: (error) => {
      logError(error, { context: 'contract.placeBet' });
    },
  });

  /**
   * Claim winnings from a resolved market
   */
  const claimWinningsMutation = useMutation({
    mutationFn: async (marketId) => {
      if (!address) throw new Error('Wallet not connected');
      
      return contractService.claimWinnings(marketId);
    },
    onSuccess: (_, marketId) => {
      queryClient.invalidateQueries([QUERY_KEYS.MARKET_DETAIL, marketId]);
      queryClient.invalidateQueries([QUERY_KEYS.MY_BETS]);
      // Refresh balance
      contractService.getBalance(address).then(setBalance);
    },
    onError: (error) => {
      logError(error, { context: 'contract.claimWinnings' });
    },
  });

  /**
   * Request market resolution (for resolvers)
   */
  const resolveMarketMutation = useMutation({
    mutationFn: async ({ marketId, outcome, proof }) => {
      if (!address) throw new Error('Wallet not connected');
      
      return contractService.resolveMarket(marketId, outcome, proof);
    },
    onSuccess: (_, { marketId }) => {
      queryClient.invalidateQueries([QUERY_KEYS.MARKET_DETAIL, marketId]);
      queryClient.invalidateQueries([QUERY_KEYS.MARKETS]);
    },
    onError: (error) => {
      logError(error, { context: 'contract.resolveMarket' });
    },
  });

  /**
   * Get market details from contract
   */
  const getMarket = useCallback(async (marketId) => {
    return contractService.getMarket(marketId);
  }, []);

  /**
   * Get user's position in a market
   */
  const getPosition = useCallback(async (marketId, userAddress = address) => {
    if (!userAddress) throw new Error('Address required');
    return contractService.getPosition(marketId, userAddress);
  }, [address]);

  /**
   * Get all markets
   */
  const getMarkets = useCallback(async (filters = {}) => {
    return contractService.getMarkets(filters);
  }, []);

  /**
   * Estimate gas for a bet
   */
  const estimateBetGas = useCallback(async (marketId, side, amount) => {
    return contractService.estimateBetGas(marketId, side, amount);
  }, []);

  /**
   * Check if market can be resolved
   */
  const canResolve = useCallback(async (marketId) => {
    return contractService.canResolve(marketId);
  }, []);

  return {
    // Mutations
    createMarket: createMarketMutation.mutateAsync,
    placeBet: placeBetMutation.mutateAsync,
    claimWinnings: claimWinningsMutation.mutateAsync,
    resolveMarket: resolveMarketMutation.mutateAsync,
    
    // Queries
    getMarket,
    getPosition,
    getMarkets,
    estimateBetGas,
    canResolve,
    
    // Loading states
    isCreatingMarket: createMarketMutation.isPending,
    isPlacingBet: placeBetMutation.isPending,
    isClaiming: claimWinningsMutation.isPending,
    isResolving: resolveMarketMutation.isPending,
    
    // Errors
    createMarketError: createMarketMutation.error,
    placeBetError: placeBetMutation.error,
    claimError: claimWinningsMutation.error,
    resolveError: resolveMarketMutation.error,
  };
};

export default useContract;
