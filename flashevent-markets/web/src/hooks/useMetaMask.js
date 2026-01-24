/**
 * useMetaMask Hook - MetaMask Wallet Connection
 * For web browsers with MetaMask extension installed
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

export const useMetaMask = () => {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  }, []);

  // Connect to MetaMask
  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install it from https://metamask.io/');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Get network
      const chainIdHex = await window.ethereum.request({
        method: 'eth_chainId',
      });

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();

      setAddress(accounts[0]);
      setChainId(parseInt(chainIdHex, 16));
      setProvider(web3Provider);
      setSigner(web3Signer);
      setIsConnected(true);

      return accounts[0];
    } catch (err) {
      console.error('Failed to connect to MetaMask:', err);
      setError(err.message || 'Failed to connect to MetaMask');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [isMetaMaskInstalled]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setIsConnected(false);
    setError(null);
  }, []);

  // Switch network
  const switchNetwork = useCallback(async (targetChainId) => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (err) {
      // This error code indicates that the chain has not been added to MetaMask
      if (err.code === 4902) {
        throw new Error('Network not added to MetaMask. Please add it manually.');
      }
      throw err;
    }
  }, [isMetaMaskInstalled]);

  // Add network to MetaMask
  const addNetwork = useCallback(async (networkConfig) => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${networkConfig.chainId.toString(16)}`,
            chainName: networkConfig.chainName,
            nativeCurrency: networkConfig.nativeCurrency,
            rpcUrls: networkConfig.rpcUrls,
            blockExplorerUrls: networkConfig.blockExplorerUrls,
          },
        ],
      });
    } catch (err) {
      console.error('Failed to add network:', err);
      throw err;
    }
  }, [isMetaMaskInstalled]);

  // Sign message
  const signMessage = useCallback(
    async (message) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      return await signer.signMessage(message);
    },
    [signer]
  );

  // Send transaction
  const sendTransaction = useCallback(
    async (transaction) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      const tx = await signer.sendTransaction(transaction);
      return await tx.wait();
    },
    [signer]
  );

  // Get balance
  const getBalance = useCallback(async () => {
    if (!provider || !address) {
      return null;
    }
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  }, [provider, address]);

  // Listen to account changes
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (accounts[0] !== address) {
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex) => {
      setChainId(parseInt(chainIdHex, 16));
      // Reload the page to reset state
      window.location.reload();
    };

    const handleDisconnect = () => {
      disconnect();
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      }
    };
  }, [address, disconnect, isMetaMaskInstalled]);

  // Auto-connect on mount if already connected
  useEffect(() => {
    const autoConnect = async () => {
      if (!isMetaMaskInstalled()) return;

      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          await connect();
        }
      } catch (err) {
        console.error('Auto-connect failed:', err);
      }
    };

    autoConnect();
  }, [connect, isMetaMaskInstalled]);

  return {
    address,
    chainId,
    isConnected,
    isConnecting,
    error,
    provider,
    signer,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    signMessage,
    sendTransaction,
    getBalance,
  };
};
