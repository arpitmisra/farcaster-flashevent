'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useBalance, usePublicClient } from 'wagmi';
import { formatEther, formatUnits, type Address } from 'viem';
import { monadTestnet } from '@/app/providers';

// Token addresses on Monad Testnet (add more as needed)
const TOKEN_ADDRESSES: Record<string, { address: Address; symbol: string; decimals: number; name: string }> = {
  // Add token addresses when available on Monad
  // USDC: { address: '0x...', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
};

export interface WalletBalance {
  native: {
    value: bigint;
    formatted: string;
    symbol: string;
    usdValue?: number;
  };
  tokens: Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: bigint;
    formatted: string;
    usdValue?: number;
  }>;
  total: {
    usdValue: number;
  };
}

export interface WalletDetails {
  address: Address | undefined;
  shortAddress: string;
  isConnected: boolean;
  isLoading: boolean;
  balance: WalletBalance | null;
  transactionCount: number | null;
  chainId: number | undefined;
  chainName: string;
  isCorrectChain: boolean;
  explorerUrl: string;
  lastUpdated: Date | null;
  error: string | null;
  refetch: () => Promise<void>;
}

// Format address to short form: 0x1234...5678
export function formatAddressShort(address: string | undefined, chars: number = 4): string {
  if (!address) return '';
  if (address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Format balance with appropriate precision
export function formatBalance(value: bigint, decimals: number = 18, precision: number = 4): string {
  const formatted = formatUnits(value, decimals);
  const num = parseFloat(formatted);
  
  if (num === 0) return '0';
  if (num < 0.0001) return '< 0.0001';
  if (num < 1) return num.toFixed(precision);
  if (num < 1000) return num.toFixed(precision);
  if (num < 1000000) return `${(num / 1000).toFixed(2)}K`;
  return `${(num / 1000000).toFixed(2)}M`;
}

export function useWalletDetails(): WalletDetails {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [tokenBalances, setTokenBalances] = useState<WalletBalance['tokens']>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Native balance using wagmi hook
  const { 
    data: nativeBalance, 
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
    error: balanceError
  } = useBalance({
    address: address,
    query: {
      enabled: !!address && isConnected,
      refetchInterval: 15000, // Refetch every 15 seconds
      staleTime: 10000,
    }
  });

  // Check if on correct chain
  const isCorrectChain = chainId === monadTestnet.id;

  // Format chain name
  const chainName = useMemo(() => {
    if (!chainId) return 'Not Connected';
    if (chainId === monadTestnet.id) return 'Monad Testnet';
    return `Chain ${chainId}`;
  }, [chainId]);

  // Explorer URL
  const explorerUrl = useMemo(() => {
    if (!address) return '';
    const baseUrl = monadTestnet.blockExplorers?.default?.url || 'https://testnet.monadexplorer.com';
    return `${baseUrl}/address/${address}`;
  }, [address]);

  // Short address
  const shortAddress = useMemo(() => {
    return formatAddressShort(address, 4);
  }, [address]);

  // Fetch transaction count
  const fetchTransactionCount = useCallback(async () => {
    if (!address || !publicClient) return;
    
    try {
      const count = await publicClient.getTransactionCount({ address });
      setTransactionCount(count);
    } catch (err) {
      console.error('Failed to fetch transaction count:', err);
    }
  }, [address, publicClient]);

  // Fetch token balances
  const fetchTokenBalances = useCallback(async () => {
    if (!address || !publicClient || Object.keys(TOKEN_ADDRESSES).length === 0) {
      setTokenBalances([]);
      return;
    }

    try {
      const balances: WalletBalance['tokens'] = [];
      
      for (const [, token] of Object.entries(TOKEN_ADDRESSES)) {
        try {
          const balance = await publicClient.readContract({
            address: token.address,
            abi: [{
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            }],
            functionName: 'balanceOf',
            args: [address],
          });

          balances.push({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance: balance as bigint,
            formatted: formatBalance(balance as bigint, token.decimals),
          });
        } catch (err) {
          console.error(`Failed to fetch balance for ${token.symbol}:`, err);
        }
      }

      setTokenBalances(balances);
    } catch (err) {
      console.error('Failed to fetch token balances:', err);
    }
  }, [address, publicClient]);

  // Combined refetch function
  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        refetchBalance(),
        fetchTransactionCount(),
        fetchTokenBalances(),
      ]);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet details');
    } finally {
      setIsLoading(false);
    }
  }, [refetchBalance, fetchTransactionCount, fetchTokenBalances]);

  // Initial fetch and periodic updates
  useEffect(() => {
    if (isConnected && address) {
      refetch();
      
      // Refresh every 30 seconds
      const interval = setInterval(refetch, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address, refetch]);

  // Build wallet balance object
  const balance: WalletBalance | null = useMemo(() => {
    if (!nativeBalance) return null;

    const nativeUsdValue = 0; // Would need price feed for USD value
    const tokensUsdValue = 0; // Would need price feed for USD value

    return {
      native: {
        value: nativeBalance.value,
        formatted: formatBalance(nativeBalance.value, 18, 4),
        symbol: nativeBalance.symbol || 'MON',
        usdValue: nativeUsdValue,
      },
      tokens: tokenBalances,
      total: {
        usdValue: nativeUsdValue + tokensUsdValue,
      },
    };
  }, [nativeBalance, tokenBalances]);

  return {
    address,
    shortAddress,
    isConnected,
    isLoading: isLoading || isBalanceLoading,
    balance,
    transactionCount,
    chainId,
    chainName,
    isCorrectChain,
    explorerUrl,
    lastUpdated,
    error: error || (balanceError ? balanceError.message : null),
    refetch,
  };
}

// Hook to copy address to clipboard
export function useCopyAddress() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, []);

  return { copied, copy };
}
