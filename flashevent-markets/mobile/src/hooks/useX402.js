/**
 * useX402 Hook - x402 Pre-Authorization Integration
 * 
 * This hook manages the x402 ONE-TIME SIGNING flow:
 * 1. User signs a pre-authorization ONCE
 * 2. All subsequent API calls automatically use that authorization
 * 3. No more approvals needed until expiry (24h default)!
 * 
 * This is the key benefit of x402 - sign once, pay automatically.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ethers } from 'ethers';
import x402Service from '../services/x402Service';
import { useWallet } from '../context/WalletContext';
import { logError } from '../utils/errors';

export const useX402 = () => {
  const { address, isConnected } = useWallet();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);
  const [error, setError] = useState(null);

  /**
   * Initialize and check existing authorization on mount/wallet change
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        await x402Service.init();
        const status = x402Service.getPreAuthStatus();
        setIsAuthorized(status.authorized);
        setAuthStatus(status);
      } catch (err) {
        console.warn('Failed to check x402 auth:', err);
      }
    };

    if (isConnected) {
      checkAuth();
    } else {
      setIsAuthorized(false);
      setAuthStatus(null);
    }
  }, [isConnected, address]);

  /**
   * Sign pre-authorization (ONE TIME)
   * This opens MetaMask for user to approve a spending limit
   */
  const authorize = useCallback(async (options = {}) => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      Alert.alert('Wallet Required', 'Please connect your MetaMask wallet first.');
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      setIsAuthorizing(true);
      setError(null);

      const {
        maxAmount = ethers.parseEther('0.1'),  // 0.1 MON default limit
        validityHours = 24,                     // 24 hours default
      } = options;

      console.log('🔐 Starting x402 pre-authorization...');
      console.log('   Max Amount:', ethers.formatEther(maxAmount), 'MON');
      console.log('   Validity:', validityHours, 'hours');

      const result = await x402Service.signPreAuthorization({
        maxAmount,
        validitySeconds: validityHours * 60 * 60,
      });

      if (result.success) {
        setIsAuthorized(true);
        setAuthStatus(result.preAuth);
        
        Alert.alert(
          '✅ x402 Authorized!',
          `You've authorized up to ${ethers.formatEther(maxAmount)} MON in micropayments.\n\n` +
          `Valid for ${validityHours} hours.\n\n` +
          'All future transactions will be automatic - no more approvals needed!'
        );

        return { success: true, preAuth: result.preAuth };
      } else {
        throw new Error('Authorization failed');
      }
    } catch (err) {
      console.error('x402 authorization failed:', err);
      setError(err.message);
      
      if (err.message?.includes('timeout') || err.message?.includes('Timeout')) {
        Alert.alert(
          '⏱️ Signing Timeout',
          'Please approve the signature request in MetaMask app and try again.',
          [{ text: 'OK' }]
        );
      } else if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        Alert.alert(
          '❌ Signature Rejected',
          'You rejected the signature request. Please try again if you want to use x402.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('❌ Authorization Failed', err.message);
      }

      return { success: false, error: err.message };
    } finally {
      setIsAuthorizing(false);
    }
  }, [isConnected]);

  /**
   * Revoke authorization
   */
  const revokeAuthorization = useCallback(async () => {
    try {
      await x402Service.clearPreAuth();
      setIsAuthorized(false);
      setAuthStatus(null);
      Alert.alert('✅ Revoked', 'x402 authorization has been revoked.');
    } catch (err) {
      console.error('Failed to revoke:', err);
      logError(err, { context: 'x402.revokeAuthorization' });
      Alert.alert('❌ Error', 'Failed to revoke authorization');
    }
  }, []);

  /**
   * Refresh authorization status
   */
  const refreshStatus = useCallback(async () => {
    try {
      await x402Service.init();
      const status = x402Service.getPreAuthStatus();
      setIsAuthorized(status.authorized);
      setAuthStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to refresh status:', err);
      return null;
    }
  }, []);

  /**
   * Make a paid API request (uses pre-auth automatically)
   */
  const paidRequest = useCallback(async (url, options = {}) => {
    if (!isAuthorized) {
      throw new Error('Not authorized. Please sign x402 pre-authorization first.');
    }
    
    try {
      setIsProcessing(true);
      const response = await x402Service.paidRequest(url, options);
      
      if (response.paid) {
        setLastPayment(response.paymentInfo);
      }
      
      // Refresh auth status after payment
      const status = x402Service.getPreAuthStatus();
      setAuthStatus(status);
      setIsAuthorized(status.authorized);
      
      return response;
    } catch (err) {
      logError(err, { context: 'x402.paidRequest' });
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [isAuthorized]);

  /**
   * Get remaining spending limit
   */
  const getRemainingLimit = useCallback(() => {
    if (!authStatus?.authorized) return '0';
    return authStatus.remaining || '0';
  }, [authStatus]);

  /**
   * Get time until expiry as human-readable string
   */
  const getTimeUntilExpiry = useCallback(() => {
    if (!authStatus?.authorized) return null;
    
    const seconds = authStatus.expiresIn || 0;
    if (seconds <= 0) return 'Expired';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, [authStatus]);

  /**
   * Check if auth is about to expire (within 1 hour)
   */
  const isExpiringSoon = useCallback(() => {
    if (!authStatus?.authorized) return false;
    return (authStatus.expiresIn || 0) < 3600;
  }, [authStatus]);

  return {
    // Authorization state
    isAuthorized,
    isAuthorizing,
    authStatus,
    error,
    
    // Payment state
    isProcessing,
    lastPayment,
    
    // Authorization actions
    authorize,
    revokeAuthorization,
    refreshStatus,
    
    // Payment actions
    paidRequest,
    
    // Helper getters
    getRemainingLimit,
    getTimeUntilExpiry,
    isExpiringSoon,
    
    // Direct service access for advanced use
    x402Service,
  };
};

export default useX402;

