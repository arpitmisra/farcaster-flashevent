'use client';

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS } from './addresses';
import { MARKET_FACTORY_ABI, MARKET_ABI } from './abis';

// ============================================
// Market Factory Hooks
// ============================================

// Create Market Hook
export function useCreateMarket() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createMarket = async (question: string, expiry: number, bettingDeadline: number) => {
    return writeContract({
      address: CONTRACTS.MARKET_FACTORY,
      abi: MARKET_FACTORY_ABI,
      functionName: 'createMarket',
      args: [question, BigInt(expiry), BigInt(bettingDeadline)],
    });
  };

  return {
    createMarket,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// Get All Markets
export function useAllMarkets() {
  return useReadContract({
    address: CONTRACTS.MARKET_FACTORY,
    abi: MARKET_FACTORY_ABI,
    functionName: 'getAllMarkets',
  });
}

// Get Markets Count
export function useMarketsCount() {
  return useReadContract({
    address: CONTRACTS.MARKET_FACTORY,
    abi: MARKET_FACTORY_ABI,
    functionName: 'marketsCount',
  });
}

// Get Markets by Creator
export function useMarketsByCreator(creator: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.MARKET_FACTORY,
    abi: MARKET_FACTORY_ABI,
    functionName: 'getMarketsByCreator',
    args: creator ? [creator] : undefined,
    query: {
      enabled: !!creator,
    },
  });
}

// ============================================
// Individual Market Hooks
// ============================================

// Place Bet Hooks
export function usePlaceBet(marketAddress: `0x${string}` | undefined) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const placeBet = async (side: 'YES' | 'NO', amount: bigint) => {
    if (!marketAddress) throw new Error('Market address not provided');
    
    return writeContract({
      address: marketAddress,
      abi: MARKET_ABI,
      functionName: side === 'YES' ? 'placeYes' : 'placeNo',
      value: amount,
    });
  };

  return {
    placeBet,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// Claim Winnings Hook
export function useClaimWinnings(marketAddress: `0x${string}` | undefined) {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = async () => {
    if (!marketAddress) throw new Error('Market address not provided');
    
    return writeContract({
      address: marketAddress,
      abi: MARKET_ABI,
      functionName: 'claim',
    });
  };

  return {
    claim,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}

// Read Market Data (all in one call)
export function useMarketData(marketAddress: `0x${string}` | undefined) {
  const contracts = marketAddress ? [
    { address: marketAddress, abi: MARKET_ABI, functionName: 'question' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'expiry' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'bettingDeadline' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'creator' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'result' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'totalYesBetsAmount' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'totalNoBetsAmount' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'totalYesBets' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'totalNoBets' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'isBettingOpen' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'getIsresolved' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'isOneSided' },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'isCreatorEligibleForFees' },
  ] as const : [];

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: !!marketAddress,
    },
  });

  const marketData = data ? {
    question: data[0]?.result as string | undefined,
    expiry: data[1]?.result as bigint | undefined,
    bettingDeadline: data[2]?.result as bigint | undefined,
    creator: data[3]?.result as `0x${string}` | undefined,
    result: data[4]?.result as number | undefined,
    yesPool: data[5]?.result as bigint | undefined,
    noPool: data[6]?.result as bigint | undefined,
    yesBets: data[7]?.result as bigint | undefined,
    noBets: data[8]?.result as bigint | undefined,
    isBettingOpen: data[9]?.result as boolean | undefined,
    isResolved: data[10]?.result as boolean | undefined,
    isOneSided: data[11]?.result as boolean | undefined,
    isCreatorEligible: data[12]?.result as boolean | undefined,
  } : null;

  return {
    data: marketData,
    isLoading,
    error,
    refetch,
  };
}

// Read User's Position in a Market
export function useUserPosition(marketAddress: `0x${string}` | undefined, userAddress: `0x${string}` | undefined) {
  const contracts = (marketAddress && userAddress) ? [
    { address: marketAddress, abi: MARKET_ABI, functionName: 'yesBets', args: [userAddress] },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'noBets', args: [userAddress] },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'hasVoted', args: [userAddress] },
    { address: marketAddress, abi: MARKET_ABI, functionName: 'hasClaimed', args: [userAddress] },
  ] as const : [];

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: !!marketAddress && !!userAddress,
    },
  });

  const position = data ? {
    yesBetAmount: data[0]?.result as bigint | undefined,
    noBetAmount: data[1]?.result as bigint | undefined,
    hasVoted: data[2]?.result as boolean | undefined,
    hasClaimed: data[3]?.result as boolean | undefined,
  } : null;

  return {
    data: position,
    isLoading,
    error,
    refetch,
  };
}

// Get Claimable Amount
export function useClaimableAmount(marketAddress: `0x${string}` | undefined, userAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: 'getClaimableAmount',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!marketAddress && !!userAddress,
    },
  });
}

// Get Market Fee Info
export function useMarketFeeInfo(marketAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: 'getFeeInfo',
    query: {
      enabled: !!marketAddress,
    },
  });
}

// Get Bets Until Creator Eligible
export function useBetsUntilCreatorEligible(marketAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: marketAddress,
    abi: MARKET_ABI,
    functionName: 'getBetsUntilCreatorEligible',
    query: {
      enabled: !!marketAddress,
    },
  });
}
