/**
 * useBetting hook - Betting-specific functionality
 */

import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContract } from './useContract';
import { useWalletStore } from '../store/walletStore';
import { useAuthStore } from '../store/authStore';
import { validateBetAmount } from '../utils/validators';
import { calculatePotentialPayout } from '../utils/helpers';
import { logError } from '../utils/errors';
import { QUERY_KEYS, BET_PRESETS } from '../utils/constants';

export const useBetting = (marketId, market) => {
  const { address, balance } = useWalletStore();
  const { user } = useAuthStore();
  const { placeBet: placeBetContract, getPosition } = useContract();
  const queryClient = useQueryClient();

  // Local state
  const [selectedSide, setSelectedSide] = useState(null);
  const [amount, setAmount] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);

  // Fetch user's position in this market
  const {
    data: position,
    isLoading: isLoadingPosition,
    refetch: refetchPosition,
  } = useQuery({
    queryKey: ['position', marketId, address],
    queryFn: () => getPosition(marketId, address),
    enabled: !!marketId && !!address,
    staleTime: 10000,
  });

  // Calculate odds
  const odds = useMemo(() => {
    if (!market) return { yes: 50, no: 50 };
    
    const yesPool = market.yesPool || 0;
    const noPool = market.noPool || 0;
    const total = yesPool + noPool;
    
    if (total === 0) return { yes: 50, no: 50 };
    
    const yes = Math.round((yesPool / total) * 100);
    return { yes, no: 100 - yes };
  }, [market]);

  // Calculate potential payout
  const potentialPayout = useMemo(() => {
    if (!selectedSide || !amount || !market) return 0;
    
    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount <= 0) return 0;
    
    return calculatePotentialPayout(
      betAmount,
      selectedSide,
      market.yesPool || 0,
      market.noPool || 0
    );
  }, [selectedSide, amount, market]);

  // Validate current bet
  const validation = useMemo(() => {
    if (!selectedSide) {
      return { valid: false, error: 'Select YES or NO' };
    }
    return validateBetAmount(amount, balance);
  }, [selectedSide, amount, balance]);

  /**
   * Select a betting side
   */
  const selectSide = useCallback((side) => {
    setSelectedSide(side);
  }, []);

  /**
   * Set bet amount
   */
  const setAmountValue = useCallback((value) => {
    // Only allow valid number input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  }, []);

  /**
   * Set amount from preset
   */
  const setPresetAmount = useCallback((preset) => {
    setAmount(preset.toString());
  }, []);

  /**
   * Set max amount
   */
  const setMaxAmount = useCallback(() => {
    if (balance > 0) {
      // Leave a small amount for gas
      const maxBet = Math.max(0, balance - 0.001);
      setAmount(maxBet.toFixed(4));
    }
  }, [balance]);

  /**
   * Place the bet
   */
  const placeBet = useCallback(async () => {
    if (!validation.valid) {
      Alert.alert('Invalid Bet', validation.error);
      return null;
    }

    if (!address) {
      Alert.alert('Wallet Required', 'Please connect your wallet first.');
      return null;
    }

    const betAmount = parseFloat(amount);

    try {
      setIsPlacing(true);

      const result = await placeBetContract({
        marketId,
        side: selectedSide,
        amount: betAmount,
      });

      // Success
      Alert.alert(
        '🎯 Bet Placed!',
        `You bet ${betAmount} ETH on ${selectedSide}. Good luck!`,
        [{ text: 'OK' }]
      );

      // Reset form
      setSelectedSide(null);
      setAmount('');

      // Refresh position
      refetchPosition();

      return result;
    } catch (error) {
      logError(error, { context: 'betting.placeBet', marketId });
      
      const message = error.message || 'Failed to place bet. Please try again.';
      Alert.alert('Bet Failed', message);
      
      return null;
    } finally {
      setIsPlacing(false);
    }
  }, [
    validation,
    address,
    amount,
    marketId,
    selectedSide,
    placeBetContract,
    refetchPosition,
  ]);

  /**
   * Check if user can bet
   */
  const canBet = useMemo(() => {
    if (!address) return false;
    if (!market) return false;
    if (market.status !== 0) return false; // Not active
    if (Date.now() > market.endsAt) return false; // Ended
    if (balance <= 0) return false;
    return true;
  }, [address, market, balance]);

  /**
   * Get bet presets adjusted for balance
   */
  const availablePresets = useMemo(() => {
    return BET_PRESETS.filter((preset) => preset.value <= balance);
  }, [balance]);

  return {
    // State
    selectedSide,
    amount,
    isPlacing,
    position,
    isLoadingPosition,
    
    // Computed
    odds,
    potentialPayout,
    validation,
    canBet,
    availablePresets,
    
    // Actions
    selectSide,
    setAmount: setAmountValue,
    setPresetAmount,
    setMaxAmount,
    placeBet,
    refetchPosition,
  };
};

export default useBetting;
