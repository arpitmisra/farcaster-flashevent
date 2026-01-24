/**
 * Wallet Service - Embedded wallet management
 * Demo mode: Works without real blockchain connection
 */

import { ethers } from 'ethers';
import * as SecureStore from 'expo-secure-store';
import config from '../config';
import { STORAGE_KEYS } from '../utils/constants';

// Demo mode flag - set to true for UI testing without blockchain
const DEMO_MODE = false;

class WalletService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.demoMode = DEMO_MODE;
    
    // Only initialize provider if not in demo mode
    if (!this.demoMode) {
      this.initProvider();
    }
  }

  /**
   * Initialize the provider
   */
  initProvider() {
    try {
      const chainConfig = config.DEFAULT_CHAIN;
      if (!chainConfig || !chainConfig.chainId) {
        console.warn('No valid chain config, running in demo mode');
        this.demoMode = true;
        return;
      }
      
      const rpcUrl = chainConfig.rpcUrls?.default?.http?.[0] || 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5';
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: chainConfig.chainId,
        name: chainConfig.network || 'monad-testnet',
      });
    } catch (error) {
      console.warn('Failed to initialize provider, running in demo mode:', error);
      this.demoMode = true;
    }
  }

  /**
   * Create or load existing wallet
   */
  async createOrLoadWallet() {
    try {
      // In demo mode, return a mock wallet
      if (this.demoMode) {
        const demoAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f5aE31';
        return {
          address: demoAddress,
          isNew: false,
          demoMode: true,
        };
      }
      
      // Try to load existing wallet
      const privateKey = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_PRIVATE_KEY);
      
      if (privateKey) {
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        return {
          address: this.wallet.address,
          isNew: false,
        };
      }
      
      // Create new wallet
      const newWallet = ethers.Wallet.createRandom();
      this.wallet = newWallet.connect(this.provider);
      
      // Store private key securely
      await SecureStore.setItemAsync(
        STORAGE_KEYS.WALLET_PRIVATE_KEY,
        newWallet.privateKey
      );
      
      await SecureStore.setItemAsync(
        STORAGE_KEYS.WALLET_ADDRESS,
        newWallet.address
      );
      
      return {
        address: this.wallet.address,
        isNew: true,
      };
    } catch (error) {
      console.error('Failed to create/load wallet:', error);
      // Return demo wallet on error
      return {
        address: '0x742d35Cc6634C0532925a3b844Bc9e7595f5aE31',
        isNew: false,
        demoMode: true,
      };
    }
  }

  /**
   * Import wallet from private key
   */
  async importWallet(privateKey) {
    try {
      if (this.demoMode) {
        return { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f5aE31', demoMode: true };
      }
      
      // Validate private key
      const wallet = new ethers.Wallet(privateKey);
      this.wallet = wallet.connect(this.provider);
      
      // Store private key securely
      await SecureStore.setItemAsync(
        STORAGE_KEYS.WALLET_PRIVATE_KEY,
        privateKey
      );
      
      await SecureStore.setItemAsync(
        STORAGE_KEYS.WALLET_ADDRESS,
        wallet.address
      );
      
      return {
        address: this.wallet.address,
      };
    } catch (error) {
      console.error('Failed to import wallet:', error);
      throw new Error('Invalid private key');
    }
  }

  /**
   * Export private key
   */
  async exportPrivateKey() {
    if (this.demoMode) {
      return 'demo-private-key-not-real';
    }
    const privateKey = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_PRIVATE_KEY);
    if (!privateKey) {
      throw new Error('No wallet found');
    }
    return privateKey;
  }

  /**
   * Get wallet address
   */
  getAddress() {
    if (this.demoMode) {
      return '0x742d35Cc6634C0532925a3b844Bc9e7595f5aE31';
    }
    if (!this.wallet) {
      return null;
    }
    return this.wallet.address;
  }

  /**
   * Get wallet balance
   */
  async getBalance(address = null) {
    try {
      if (this.demoMode) {
        return '1.5'; // Demo balance
      }
      
      const addr = address || this.wallet?.address;
      if (!addr) {
        throw new Error('No address provided');
      }
      
      const balance = await this.provider.getBalance(addr);
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    return this.wallet.signMessage(message);
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(domain, types, value) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    return this.wallet.signTypedData(domain, types, value);
  }

  /**
   * Send a transaction
   */
  async sendTransaction(to, value, data = null) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = {
        to,
        value: ethers.parseEther(value.toString()),
      };

      if (data) {
        tx.data = data;
      }

      // Estimate gas
      const gasEstimate = await this.provider.estimateGas(tx);
      tx.gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer

      // Get gas price
      const feeData = await this.provider.getFeeData();
      tx.maxFeePerGas = feeData.maxFeePerGas;
      tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      // Send transaction
      const txResponse = await this.wallet.sendTransaction(tx);
      
      // Wait for confirmation
      const receipt = await txResponse.wait();
      
      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Call a contract method (read-only)
   */
  async callContract(address, abi, method, args = []) {
    try {
      const contract = new ethers.Contract(address, abi, this.provider);
      return await contract[method](...args);
    } catch (error) {
      console.error('Contract call failed:', error);
      throw error;
    }
  }

  /**
   * Execute a contract method (write)
   */
  async executeContract(address, abi, method, args = [], value = null) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const contract = new ethers.Contract(address, abi, this.wallet);
      
      const options = {};
      if (value) {
        options.value = ethers.parseEther(value.toString());
      }

      const tx = await contract[method](...args, options);
      const receipt = await tx.wait();
      
      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        events: receipt.logs,
      };
    } catch (error) {
      console.error('Contract execution failed:', error);
      throw error;
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash) {
    return this.provider.getTransactionReceipt(txHash);
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash, confirmations = 1) {
    return this.provider.waitForTransaction(txHash, confirmations);
  }

  /**
   * Delete wallet (use with caution)
   */
  async deleteWallet() {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_PRIVATE_KEY);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.WALLET_ADDRESS);
    this.wallet = null;
  }

  /**
   * Check if wallet exists
   */
  async hasWallet() {
    const privateKey = await SecureStore.getItemAsync(STORAGE_KEYS.WALLET_PRIVATE_KEY);
    return !!privateKey;
  }

  /**
   * Get nonce for address
   */
  async getNonce(address = null) {
    const addr = address || this.wallet?.address;
    if (!addr) {
      throw new Error('No address provided');
    }
    return this.provider.getTransactionCount(addr, 'pending');
  }

  /**
   * Get current gas price
   */
  async getGasPrice() {
    const feeData = await this.provider.getFeeData();
    return {
      gasPrice: feeData.gasPrice,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    };
  }
}

export default new WalletService();
