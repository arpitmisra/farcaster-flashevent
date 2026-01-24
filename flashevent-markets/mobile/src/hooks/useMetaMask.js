/**
 * useMetaMask Hook - MetaMask Mobile Integration
 * For React Native Expo apps with Monad Testnet support
 * 
 * This hook now uses the WalletContext directly via useWallet()
 */

import { useCallback, useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import { useWallet } from '../context/WalletContext';
import { logError } from '../utils/errors';

export const useMetaMask = () => {
  // Get wallet context directly - this is the source of truth
  const walletContext = useWallet();
  
  const {
    setAddress,
    setConnecting,
    setExternalWallet,
    disconnect: disconnectFromStore,
  } = useWalletStore();

  // Use context values directly
  const address = walletContext.address;
  const isConnected = walletContext.isConnected;
  const isConnecting = walletContext.isConnecting;

  // Sync walletStore when WalletContext changes
  useEffect(() => {
    if (walletContext.isConnected && walletContext.address) {
      setAddress(walletContext.address);
      setExternalWallet(walletContext.address).catch(err => {
        console.warn('Failed to sync external wallet:', err);
      });
    }
  }, [walletContext.isConnected, walletContext.address, setAddress, setExternalWallet]);

  /**
   * Connect to MetaMask Mobile with Monad network
   */
  const connect = useCallback(async () => {
    try {
      setConnecting(true);

      // Open WalletConnect modal via context
      await walletContext.connectWallet();
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (walletContext.isConnected && walletContext.address) {
        // Update wallet store with the connection
        await setExternalWallet(walletContext.address);
        setAddress(walletContext.address);
        
        console.log('✅ MetaMask connected:', walletContext.address);
        return walletContext.address;
      }
      
      return null;
    } catch (error) {
      // Log but don't show red error box for expected timeouts
      const isTimeout = error.message?.includes('timeout') || error.message?.includes('Timeout');
      if (isTimeout) {
        console.warn('MetaMask connection timeout - user may need to approve in MetaMask app');
      } else {
        logError(error, { context: 'metamask.connect' });
      }
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [walletContext, setAddress, setConnecting, setExternalWallet]);

  /**
   * Disconnect from MetaMask
   */
  const disconnect = useCallback(async () => {
    await walletContext.disconnectWallet();
    await disconnectFromStore();
  }, [walletContext, disconnectFromStore]);

  /**
   * Send transaction via WalletConnect
   */
  const sendTransaction = useCallback(
    async (to, value, data = '0x') => {
      try {
        if (!walletContext.isConnected) {
          throw new Error('Wallet not connected');
        }

        const tx = await walletContext.sendTransaction({ to, value, data });
        return tx;
      } catch (error) {
        logError(error, { context: 'metamask.sendTransaction' });
        throw error;
      }
    },
    [walletContext]
  );

  /**
   * Sign message via WalletConnect
   */
  const signMessage = useCallback(async (message) => {
    try {
      if (!walletContext.isConnected) {
        throw new Error('Wallet not connected');
      }

      const signature = await walletContext.signMessage(message);
      return signature;
    } catch (error) {
      logError(error, { context: 'metamask.signMessage' });
      throw error;
    }
  }, [walletContext]);

  /**
   * Check if MetaMask is installed (always true with WalletConnect modal)
   */
  const checkInstallation = useCallback(async () => {
    // WalletConnect modal handles wallet availability
    return true;
  }, []);

  /**
   * Get connected address
   */
  const getAddress = useCallback(() => {
    return address;
  }, [address]);

  /**
   * Get provider for read operations
   */
  const getProvider = useCallback(() => {
    return walletContext.getProvider();
  }, [walletContext]);

  /**
   * Get signer for write operations
   */
  const getSigner = useCallback(() => {
    if (!walletContext.isConnected) {
      throw new Error('MetaMask not connected');
    }
    return walletContext.getSigner();
  }, [walletContext]);

  /**
   * Get balance from Monad
   */
  const getBalance = useCallback(async (addr) => {
    const provider = walletContext.getProvider();
    const { ethers } = require('ethers');
    const balance = await provider.getBalance(addr || address);
    return ethers.formatEther(balance);
  }, [walletContext, address]);

  /**
   * Force reconnect - clears session and reconnects
   */
  const forceReconnect = useCallback(async () => {
    try {
      setConnecting(true);
      await walletContext.disconnectWallet();
      await walletContext.connectWallet();
      
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (walletContext.isConnected && walletContext.address) {
        await setExternalWallet(walletContext.address);
        setAddress(walletContext.address);
        console.log('✅ MetaMask reconnected:', walletContext.address);
        return walletContext.address;
      } else {
        throw new Error('Failed to reconnect to MetaMask');
      }
    } catch (error) {
      logError(error, { context: 'metamask.forceReconnect' });
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [walletContext, setAddress, setConnecting, setExternalWallet]);

  /**
   * Get session info for debugging
   */
  const getSessionInfo = useCallback(() => {
    return {
      connected: walletContext.isConnected,
      address: walletContext.address,
      chainId: walletContext.chainId,
      targetChainId: walletContext.MONAD_CONFIG?.chainId || 10143,
      targetChainName: walletContext.MONAD_CONFIG?.chainName || 'Monad Testnet',
    };
  }, [walletContext]);

  /**
   * Add Monad network to MetaMask
   */
  const addMonadNetwork = useCallback(async () => {
    try {
      return await walletContext.switchToMonad();
    } catch (error) {
      logError(error, { context: 'metamask.addMonadNetwork' });
      throw error;
    }
  }, [walletContext]);

  /**
   * Switch to Monad network
   */
  const switchToMonadNetwork = useCallback(async () => {
    try {
      return await walletContext.switchToMonad();
    } catch (error) {
      logError(error, { context: 'metamask.switchToMonadNetwork' });
      throw error;
    }
  }, [walletContext]);

  return {
    address,
    isConnected,
    isConnecting,
    connect,
    disconnect,
    forceReconnect,
    sendTransaction,
    signMessage,
    checkInstallation,
    getAddress,
    getProvider,
    getSigner,
    getBalance,
    getSessionInfo,
    addMonadNetwork,
    switchToMonadNetwork,
  };
};
