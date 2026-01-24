'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useChainId, useSwitchChain, useAccount } from 'wagmi';
import { monadTestnet } from '@/app/providers';

// Monad Testnet chain ID
const MONAD_CHAIN_ID = 10143;
const MONAD_CHAIN_ID_HEX = '0x279F'; // 10143 in hex

// Monad Testnet configuration for adding to wallets
const MONAD_TESTNET_PARAMS = {
  chainId: MONAD_CHAIN_ID_HEX,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://monad-testnet.g.alchemy.com/v2/demo'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

// Check if we're in Farcaster Mini App environment
const isInMiniAppEnvironment = () => {
  if (typeof window === 'undefined') return false;
  return window.location.search.includes('miniApp=true') || window.parent !== window;
};

// Direct function to add and switch chain via window.ethereum
async function forceChainSwitch(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ethereum) {
    console.error('No ethereum provider found');
    return false;
  }

  try {
    // First, try to switch directly
    console.log('Attempting to switch to Monad Testnet...');
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_CHAIN_ID_HEX }],
    });
    console.log('Successfully switched to Monad Testnet!');
    return true;
  } catch (switchError: any) {
    console.log('Switch failed, error code:', switchError?.code, switchError?.message);
    
    // Error code 4902 means chain not added yet
    // Some wallets use different error codes or messages
    if (
      switchError?.code === 4902 ||
      switchError?.code === -32603 ||
      switchError?.message?.includes('Unrecognized chain') ||
      switchError?.message?.includes('wallet_addEthereumChain') ||
      switchError?.message?.includes('unknown chain')
    ) {
      try {
        console.log('Chain not found, adding Monad Testnet...');
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [MONAD_TESTNET_PARAMS],
        });
        console.log('Successfully added Monad Testnet!');
        
        // After adding, the wallet should auto-switch, but let's make sure
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try switching again after adding
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: MONAD_CHAIN_ID_HEX }],
          });
        } catch (e) {
          // Ignore - might already be on the chain after adding
          console.log('Post-add switch attempt:', e);
        }
        
        return true;
      } catch (addError: any) {
        console.error('Failed to add Monad Testnet:', addError);
        throw addError;
      }
    }
    
    // User rejected the request
    if (switchError?.code === 4001) {
      console.log('User rejected chain switch');
      throw new Error('Please approve the network switch to continue');
    }
    
    throw switchError;
  }
}

// Get actual chain ID from MetaMask directly (not wagmi cache)
async function getActualChainId(): Promise<number | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    return null;
  }
  try {
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  } catch (e) {
    console.error('Failed to get chain ID:', e);
    return null;
  }
}

export function useChainSwitch() {
  const wagmiChainId = useChainId();
  const { connector, isConnected } = useAccount();
  const { switchChain, isPending: isSwitchingViaWagmi } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedSwitch, setHasAttemptedSwitch] = useState(false);
  const [actualChainId, setActualChainId] = useState<number | null>(null);

  // Poll for actual chain ID from wallet
  useEffect(() => {
    let mounted = true;
    
    const checkChain = async () => {
      const chainId = await getActualChainId();
      if (mounted && chainId !== null) {
        setActualChainId(chainId);
      }
    };

    // Check immediately
    checkChain();
    
    // Check periodically (every 2 seconds)
    const interval = setInterval(checkChain, 2000);

    // Listen for chain changes
    if (typeof window !== 'undefined' && window.ethereum?.on) {
      const handleChainChanged = (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16);
        console.log('Chain changed to:', newChainId);
        if (mounted) {
          setActualChainId(newChainId);
        }
      };
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        mounted = false;
        clearInterval(interval);
        window.ethereum?.removeListener?.('chainChanged', handleChainChanged);
      };
    }

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isConnected]);

  // Use actual chain ID from wallet, fallback to wagmi
  const chainId = actualChainId ?? wagmiChainId;
  
  // Check if on correct chain - use ACTUAL chain, not wagmi cache
  const isCorrectChain = chainId === MONAD_CHAIN_ID;
  
  // Check if using Farcaster connector
  const isFarcasterConnector = useMemo(() => {
    return connector?.id === 'farcaster' || connector?.name?.toLowerCase().includes('farcaster');
  }, [connector]);

  const isInMiniApp = isInMiniAppEnvironment();

  // Switch to Monad Testnet
  const switchToMonad = useCallback(async (): Promise<boolean> => {
    console.log('switchToMonad called. Current chain:', chainId, 'Target:', MONAD_CHAIN_ID);
    
    if (isCorrectChain) {
      console.log('Already on correct chain');
      return true;
    }

    // Skip for Farcaster in MiniApp - Warpcast handles chain
    if (isInMiniApp && isFarcasterConnector) {
      console.log('In Farcaster MiniApp, skipping chain switch');
      return true;
    }

    setIsSwitching(true);
    setError(null);

    try {
      // Method 1: Try wagmi's switchChain first
      if (switchChain) {
        try {
          console.log('Trying wagmi switchChain...');
          await switchChain({ chainId: MONAD_CHAIN_ID });
          console.log('Wagmi switch successful!');
          setIsSwitching(false);
          return true;
        } catch (wagmiError: any) {
          console.log('Wagmi switch failed:', wagmiError?.message);
          // Continue to fallback
        }
      }

      // Method 2: Direct window.ethereum call (more reliable for most wallets)
      console.log('Trying direct ethereum provider switch...');
      const success = await forceChainSwitch();
      setIsSwitching(false);
      return success;
      
    } catch (err: any) {
      console.error('Chain switch error:', err);
      setError(err.message || 'Failed to switch to Monad Testnet');
      setIsSwitching(false);
      return false;
    }
  }, [chainId, isCorrectChain, isInMiniApp, isFarcasterConnector, switchChain]);

  // Auto-switch when connected but on wrong chain (browser only, not Farcaster)
  useEffect(() => {
    // Only attempt once per connection
    if (hasAttemptedSwitch) return;
    
    // Skip if not connected
    if (!isConnected) return;
    
    // Skip if already on correct chain
    if (isCorrectChain) return;
    
    // Skip for Farcaster MiniApp
    if (isInMiniApp || isFarcasterConnector) return;
    
    // Skip if already switching
    if (isSwitching || isSwitchingViaWagmi) return;

    console.log('Auto-triggering chain switch...');
    setHasAttemptedSwitch(true);
    
    // Delay to ensure wallet is fully connected
    const timer = setTimeout(() => {
      switchToMonad();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isConnected, isCorrectChain, isInMiniApp, isFarcasterConnector, isSwitching, isSwitchingViaWagmi, hasAttemptedSwitch, switchToMonad]);

  // Reset attempt flag when disconnected
  useEffect(() => {
    if (!isConnected) {
      setHasAttemptedSwitch(false);
    }
  }, [isConnected]);

  return {
    chainId,
    isCorrectChain,
    isSwitching: isSwitching || isSwitchingViaWagmi,
    error,
    switchToMonad,
    targetChainId: MONAD_CHAIN_ID,
    targetChainName: 'Monad Testnet',
    isFarcasterConnector,
    isInMiniApp,
  };
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
      on?: (event: string, callback: (...args: any[]) => void) => void;
      removeListener?: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}
