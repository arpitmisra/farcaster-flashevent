/**
 * useWallet hook - Wallet connection and management
 */

import { useCallback, useEffect } from 'react';
import { useWalletStore } from '../store/walletStore';
import walletService from '../services/walletService';
import { logError } from '../utils/errors';

export const useWallet = () => {
  const {
    address,
    balance,
    isConnected,
    isConnecting,
    setAddress,
    setBalance,
    setConnecting,
    disconnect,
  } = useWalletStore();

  /**
   * Connect wallet
   */
  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      
      const wallet = await walletService.createOrLoadWallet();
      
      setAddress(wallet.address);
      
      // Fetch initial balance
      const walletBalance = await walletService.getBalance(wallet.address);
      setBalance(walletBalance);
      
      return wallet.address;
    } catch (error) {
      logError(error, { context: 'wallet.connect' });
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [setAddress, setBalance, setConnecting]);

  /**
   * Disconnect wallet
   */
  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  /**
   * Refresh balance
   */
  const refreshBalance = useCallback(async () => {
    if (!address) return 0;
    
    try {
      const walletBalance = await walletService.getBalance(address);
      setBalance(walletBalance);
      return walletBalance;
    } catch (error) {
      logError(error, { context: 'wallet.refreshBalance' });
      throw error;
    }
  }, [address, setBalance]);

  /**
   * Sign a message
   */
  const signMessage = useCallback(async (message) => {
    try {
      return await walletService.signMessage(message);
    } catch (error) {
      logError(error, { context: 'wallet.signMessage' });
      throw error;
    }
  }, []);

  /**
   * Send a transaction
   */
  const sendTransaction = useCallback(async (to, value, data) => {
    try {
      const tx = await walletService.sendTransaction(to, value, data);
      
      // Refresh balance after transaction
      setTimeout(refreshBalance, 2000);
      
      return tx;
    } catch (error) {
      logError(error, { context: 'wallet.sendTransaction' });
      throw error;
    }
  }, [refreshBalance]);

  /**
   * Export private key (for backup)
   */
  const exportPrivateKey = useCallback(async () => {
    try {
      return await walletService.exportPrivateKey();
    } catch (error) {
      logError(error, { context: 'wallet.exportPrivateKey' });
      throw error;
    }
  }, []);

  /**
   * Import wallet from private key
   */
  const importWallet = useCallback(async (privateKey) => {
    try {
      setConnecting(true);
      
      const wallet = await walletService.importWallet(privateKey);
      
      setAddress(wallet.address);
      
      const walletBalance = await walletService.getBalance(wallet.address);
      setBalance(walletBalance);
      
      return wallet.address;
    } catch (error) {
      logError(error, { context: 'wallet.importWallet' });
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [setAddress, setBalance, setConnecting]);

  /**
   * Auto-refresh balance periodically
   */
  useEffect(() => {
    if (!address) return;
    
    // Initial refresh
    refreshBalance();
    
    // Set up periodic refresh
    const interval = setInterval(refreshBalance, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [address, refreshBalance]);

  return {
    address,
    balance,
    isConnected,
    isConnecting,
    connect,
    disconnect: disconnectWallet,
    refreshBalance,
    signMessage,
    sendTransaction,
    exportPrivateKey,
    importWallet,
  };
};

export default useWallet;
