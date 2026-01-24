/**
 * WalletContext - WalletConnect Modal Integration
 * Uses @walletconnect/modal-react-native for wallet connection
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWalletConnectModal } from '@walletconnect/modal-react-native';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';
import metamaskService from '../services/metamaskService';

// Monad Testnet Configuration
const MONAD_CONFIG = {
  chainId: 10143,
  chainHex: '0x279F',
  chainName: 'Monad Testnet',
  rpcUrl: 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5',
  explorerUrl: 'https://explorer.testnet.monad.xyz',
  nativeCurrency: {
    name: 'MON',
    symbol: 'MON',
    decimals: 18,
  },
};

const WalletContext = createContext({
  address: null,
  balance: '0',
  isConnected: false,
  isConnecting: false,
  provider: null,
  connectWallet: async () => {},
  disconnectWallet: async () => {},
  signMessage: async () => {},
  signTypedData: async () => {},
  sendTransaction: async () => {},
  getProvider: () => null,
  getSigner: () => null,
  getContract: () => null,
  getReadOnlyContract: () => null,
  switchToMonad: async () => {},
  chainId: null,
  walletConnectReady: false,
});

export const useWallet = () => useContext(WalletContext);

/**
 * WalletProvider - Uses WalletConnect hook directly
 */
export function WalletProvider({ children }) {
  // State for wallet connection
  const [balance, setBalance] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [walletConnectReady, setWalletConnectReady] = useState(false);
  const [wcState, setWcState] = useState({
    open: null,
    isConnected: false,
    address: null,
    provider: null,
  });
  
  // Monad JSON-RPC provider for read operations
  const monadProviderRef = useRef(null);

  // Try to use WalletConnect hook - wrapped in try-catch for safety
  let wcModal = { open: null, isConnected: false, address: null, provider: null };
  try {
    wcModal = useWalletConnectModal() || wcModal;
  } catch (error) {
    console.warn('⚠️ WalletConnect hook error:', error.message);
  }
  
  // Extract values from hook
  const { open, isConnected, address, provider } = wcModal;

  // Track when WalletConnect is ready
  useEffect(() => {
    if (open) {
      console.log('✅ WalletConnect is ready, open function available');
      setWalletConnectReady(true);
      setWcState({ open, isConnected, address, provider });
    } else {
      console.log('⏳ WalletConnect not ready yet, open:', typeof open);
    }
  }, [open, isConnected, address, provider]);

  console.log('🔍 WalletContext State:', {
    isConnected,
    address,
    hasProvider: !!provider,
    walletConnectReady,
  });

  /**
   * Get Monad JSON-RPC provider for read operations
   */
  const getMonadProvider = useCallback(() => {
    if (!monadProviderRef.current) {
      monadProviderRef.current = new ethers.JsonRpcProvider(MONAD_CONFIG.rpcUrl, {
        chainId: MONAD_CONFIG.chainId,
        name: 'monad-testnet',
      });
    }
    return monadProviderRef.current;
  }, []);

  /**
   * Track app state to detect when returning from MetaMask
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active - checking connection');
        if (isConnected && address) {
          updateBalance(address);
        }
      }
    });

    return () => subscription.remove();
  }, [isConnected, address]);

  /**
   * Listen for deep link events
   */
  useEffect(() => {
    const handleDeepLink = ({ url }) => {
      console.log('📲 Deep link received:', url);
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('📲 App opened with URL:', url);
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, []);

  /**
   * Sync WalletConnect state and switch to Monad
   */
  useEffect(() => {
    const setupConnection = async () => {
      if (isConnected && address && provider && !isSwitchingChain) {
        console.log('✅ Wallet connected:', address);
        setIsConnecting(false);

        // Fetch balance from Monad
        await updateBalance(address);

        // Try to switch to Monad Testnet (non-blocking)
        switchToMonad().catch(err => {
          console.log('ℹ️ Could not auto-switch to Monad:', err.message);
        });
      } else if (!isConnected) {
        setIsConnecting(false);
      }
    };

    setupConnection();
  }, [isConnected, address, provider]);

  /**
   * Update balance from Monad network
   */
  const updateBalance = async (walletAddress) => {
    try {
      const monadProvider = getMonadProvider();
      const balWei = await monadProvider.getBalance(walletAddress);
      const balEth = ethers.formatEther(balWei);
      setBalance(parseFloat(balEth).toFixed(4));
      console.log('💰 Balance:', balEth, 'MON');
    } catch (error) {
      console.error('❌ Failed to fetch balance:', error);
      setBalance('0');
    }
  };

  /**
   * Switch to Monad Testnet
   */
  const switchToMonad = async () => {
    if (!provider || isSwitchingChain) return false;

    try {
      setIsSwitchingChain(true);
      console.log('🔄 Switching to Monad Testnet...');

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: MONAD_CONFIG.chainHex }],
        });
        console.log('✅ Switched to Monad Testnet');
        setChainId(MONAD_CONFIG.chainId);
        return true;
      } catch (switchError) {
        if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
          console.log('📝 Adding Monad Testnet to wallet...');
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: MONAD_CONFIG.chainHex,
                chainName: MONAD_CONFIG.chainName,
                nativeCurrency: MONAD_CONFIG.nativeCurrency,
                rpcUrls: [MONAD_CONFIG.rpcUrl],
                blockExplorerUrls: [MONAD_CONFIG.explorerUrl],
              },
            ],
          });
          console.log('✅ Monad Testnet added and switched!');
          setChainId(MONAD_CONFIG.chainId);
          return true;
        } else {
          throw switchError;
        }
      }
    } catch (error) {
      console.error('❌ Failed to switch to Monad:', error);
      return false;
    } finally {
      setIsSwitchingChain(false);
    }
  };

  /**
   * Connect wallet - Opens the WalletConnect modal
   */
  const connectWallet = async () => {
    try {
      console.log('🔗 Attempting wallet connection...');
      console.log('🔍 WalletConnect ready:', walletConnectReady);
      console.log('🔍 open function available:', !!open);
      console.log('🔍 Current state:', { isConnected, address: address?.substring(0, 10) });
      
      setIsConnecting(true);

      if (!walletConnectReady || !open) {
        console.error('❌ WalletConnect not ready');
        throw new Error('WalletConnect not initialized. Please wait a moment and try again.');
      }

      console.log('🔗 Opening WalletConnect modal...');
      
      // Open the modal - this should show wallet options
      const result = await open();
      
      console.log('✅ Modal interaction complete, result:', result);
    } catch (error) {
      console.error('❌ Failed to connect wallet:', error);
      setIsConnecting(false);
      throw error;
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnectWallet = async () => {
    try {
      console.log('🔌 Disconnecting wallet...');

      if (provider?.disconnect) {
        await provider.disconnect();
      }

      setBalance('0');
      setChainId(null);
      console.log('✅ Wallet disconnected');
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      throw error;
    }
  };

  /**
   * Sign a message using personal_sign
   */
  const signMessage = async (message) => {
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('📝 Signing message...');
      
      const hexMessage = typeof message === 'string'
        ? ethers.hexlify(ethers.toUtf8Bytes(message))
        : ethers.hexlify(message);

      const signature = await provider.request({
        method: 'personal_sign',
        params: [hexMessage, address],
      });

      console.log('✅ Message signed');
      return signature;
    } catch (error) {
      console.error('❌ Failed to sign message:', error);
      throw error;
    }
  };

  /**
   * Sign EIP-712 typed data with timeout handling and retry
   * @param {Object} typedData - The typed data to sign
   * @param {Object} options - Options including timeout
   */
  const signTypedData = async (typedData, options = {}) => {
    const { timeout = 120000, retries = 1 } = options; // 2 minute timeout, 1 retry
    
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }

    const attemptSign = async (attemptNumber) => {
      try {
        console.log(`📝 Signing typed data (attempt ${attemptNumber})...`);
        
        const { domain, types, message } = typedData;

        const effectiveDomain = {
          ...domain,
          chainId: MONAD_CONFIG.chainId,
        };

        const typesWithoutDomain = { ...types };
        delete typesWithoutDomain.EIP712Domain;

        const fullTypedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              ...(effectiveDomain.verifyingContract ? [{ name: 'verifyingContract', type: 'address' }] : []),
            ],
            ...typesWithoutDomain,
          },
          primaryType: Object.keys(typesWithoutDomain)[0],
          domain: effectiveDomain,
          message,
        };

        // Create a promise race between the signing request and a timeout
        const signPromise = provider.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(fullTypedData)],
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('SIGNING_TIMEOUT'));
          }, timeout);
        });

        const signature = await Promise.race([signPromise, timeoutPromise]);

        console.log('✅ Typed data signed');
        return signature;
      } catch (error) {
        console.error(`❌ Signing attempt ${attemptNumber} failed:`, error);
        
        // Check for timeout or request expired error
        const isTimeout = error.message === 'SIGNING_TIMEOUT' || 
                         error.message?.toLowerCase().includes('expired') ||
                         error.message?.toLowerCase().includes('timeout');
        
        // Check for user rejection
        const isRejection = error.message?.toLowerCase().includes('reject') ||
                          error.message?.toLowerCase().includes('denied') ||
                          error.code === 4001;
        
        if (isRejection) {
          throw new Error('User rejected the signature request. Please approve in MetaMask to continue.');
        }
        
        if (isTimeout && attemptNumber <= retries) {
          console.log(`⏱️ Request timed out, retrying (${attemptNumber}/${retries})...`);
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          return attemptSign(attemptNumber + 1);
        }
        
        if (isTimeout) {
          throw new Error(
            'Signing request timed out. Please check MetaMask app and approve the request.\n\n' +
            'Tips:\n' +
            '• Make sure MetaMask is open\n' +
            '• Check for pending requests in MetaMask\n' +
            '• Try reconnecting your wallet'
          );
        }
        
        throw error;
      }
    };

    return attemptSign(1);
  };

  /**
   * Send a transaction via WalletConnect provider with timeout and retry handling
   * @param {Object} tx - Transaction object with to, data, value
   * @param {Object} options - Options including timeout and retries
   */
  const sendTransaction = async (tx, options = {}) => {
    const { timeout = 180000, retries = 2 } = options; // 3 minute timeout, 2 retries
    
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }

    const attemptTransaction = async (attemptNumber) => {
      try {
        console.log(`📝 Preparing transaction (attempt ${attemptNumber})...`);
        console.log('📝 Input tx:', JSON.stringify({
          to: tx.to,
          dataLength: tx.data?.length,
          value: tx.value,
        }));

        // First, ensure Monad Testnet is added to the wallet (only on first attempt)
        if (attemptNumber === 1) {
          console.log('🔄 Ensuring Monad Testnet is available...');
          try {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: MONAD_CONFIG.chainHex,
                  chainName: MONAD_CONFIG.chainName,
                  nativeCurrency: MONAD_CONFIG.nativeCurrency,
                  rpcUrls: [MONAD_CONFIG.rpcUrl],
                  blockExplorerUrls: [MONAD_CONFIG.explorerUrl],
                },
              ],
            });
            console.log('✅ Monad Testnet available in wallet');
          } catch (addError) {
            console.log('ℹ️ Add chain result:', addError.message);
          }

          try {
            console.log('🔄 Switching to Monad Testnet...');
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: MONAD_CONFIG.chainHex }],
            });
            console.log('✅ Switched to Monad Testnet');
            setChainId(MONAD_CONFIG.chainId);
          } catch (switchError) {
            console.log('ℹ️ Chain switch result:', switchError.message);
          }
        }

        // Build the transaction request
        const txRequest = {
          from: address,
          to: tx.to,
          data: tx.data || '0x',
          value: tx.value ? (typeof tx.value === 'string' ? tx.value : ethers.toQuantity(tx.value)) : '0x0',
        };

        if (tx.gasLimit) {
          txRequest.gas = ethers.toQuantity(tx.gasLimit);
        }

        console.log('📝 Final transaction request:', JSON.stringify({
          from: txRequest.from,
          to: txRequest.to,
          dataLength: txRequest.data?.length,
          dataPreview: txRequest.data?.slice(0, 74),
          value: txRequest.value,
        }));

        // Create promise race between transaction and timeout
        console.log('📤 Sending to MetaMask via WalletConnect...');
        
        const txPromise = provider.request({
          method: 'eth_sendTransaction',
          params: [txRequest],
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('TRANSACTION_TIMEOUT'));
          }, timeout);
        });

        const txHash = await Promise.race([txPromise, timeoutPromise]);
        console.log('✅ Transaction sent:', txHash);

        // Wait for confirmation with its own timeout
        console.log('⏳ Waiting for confirmation...');
        const monadProvider = getMonadProvider();
        
        try {
          const receipt = await Promise.race([
            monadProvider.waitForTransaction(txHash, 1, 60000), // 1 confirmation, 60s timeout
            new Promise((_, reject) => setTimeout(() => reject(new Error('CONFIRMATION_TIMEOUT')), 60000))
          ]);
          
          console.log('✅ Transaction confirmed:', receipt?.hash || txHash);
          await updateBalance(address);
          return receipt;
        } catch (confirmError) {
          // Transaction was sent but confirmation timed out - still return the hash
          console.log('⚠️ Confirmation timeout, but transaction was sent:', txHash);
          await updateBalance(address);
          return { hash: txHash, status: 'pending' };
        }
        
      } catch (error) {
        console.error(`❌ Transaction attempt ${attemptNumber} failed:`, error);
        
        // Check for timeout or request expired error
        const isTimeout = error.message === 'TRANSACTION_TIMEOUT' || 
                         error.message?.toLowerCase().includes('expired') ||
                         error.message?.toLowerCase().includes('timeout');
        
        // Check for user rejection
        const isRejection = error.message?.toLowerCase().includes('reject') ||
                          error.message?.toLowerCase().includes('denied') ||
                          error.code === 4001;
        
        if (isRejection) {
          throw new Error('Transaction was rejected. Please approve in MetaMask to continue.');
        }
        
        // Retry on timeout
        if (isTimeout && attemptNumber <= retries) {
          console.log(`⏱️ Request timed out, retrying (${attemptNumber}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptTransaction(attemptNumber + 1);
        }
        
        if (isTimeout) {
          throw new Error(
            'Transaction request timed out. Please check MetaMask app.\n\n' +
            'Tips:\n' +
            '• Make sure MetaMask app is open\n' +
            '• Check for pending transaction requests\n' +
            '• Try reconnecting your wallet'
          );
        }
        
        // Handle other errors
        if (error.code === -32601 || error.message?.includes('method is not available')) {
          throw new Error(
            'Transaction method not available. Please disconnect and reconnect your wallet, ' +
            'then ensure MetaMask is switched to Monad Testnet (Chain ID: 10143).'
          );
        }
        
        throw error;
      }
    };

    return attemptTransaction(1);
  };

  /**
   * Get ethers provider (for Monad read operations)
   */
  const getProvider = useCallback(() => {
    return getMonadProvider();
  }, [getMonadProvider]);

  /**
   * Get a signer-like object for contract interactions
   */
  const getSigner = useCallback(() => {
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }

    return {
      getAddress: async () => address,
      signMessage,
      signTypedData: async (domain, types, value) => {
        return signTypedData({ domain, types, message: value });
      },
      sendTransaction,
      provider: getMonadProvider(),
    };
  }, [provider, address, getMonadProvider]);

  /**
   * Get a contract instance with write capabilities
   */
  const getContract = useCallback((contractAddress, abi) => {
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }

    const monadProvider = getMonadProvider();
    const contract = new ethers.Contract(contractAddress, abi, monadProvider);

    return new Proxy(contract, {
      get(target, prop) {
        const original = target[prop];
        
        if (typeof original === 'function') {
          try {
            const fragment = target.interface.getFunction(prop);
            
            if (fragment.stateMutability === 'view' || fragment.stateMutability === 'pure') {
              return original.bind(target);
            }

            return async (...args) => {
              const data = target.interface.encodeFunctionData(prop, args);
              const tx = { to: contractAddress, data };
              return sendTransaction(tx);
            };
          } catch {
            return typeof original === 'function' ? original.bind(target) : original;
          }
        }

        return original;
      },
    });
  }, [provider, address, getMonadProvider, sendTransaction]);

  /**
   * Get a read-only contract instance
   */
  const getReadOnlyContract = useCallback((contractAddress, abi) => {
    const monadProvider = getMonadProvider();
    return new ethers.Contract(contractAddress, abi, monadProvider);
  }, [getMonadProvider]);

  const contextValue = {
    address: address || null,
    balance,
    isConnected,
    isConnecting,
    provider,
    connectWallet,
    disconnectWallet,
    signMessage,
    signTypedData,
    sendTransaction,
    getProvider,
    getSigner,
    getContract,
    getReadOnlyContract,
    switchToMonad,
    chainId,
    MONAD_CONFIG,
    walletConnectReady,
  };

  // Register context with metamaskService for non-React code
  useEffect(() => {
    metamaskService.setWalletContext(contextValue);
  }, [isConnected, address, provider]);

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

export { MONAD_CONFIG };
export default WalletContext;
