/**
 * MetaMask Service - Utility functions for wallet operations
 * 
 * This service provides utility functions that work with the WalletContext.
 * For most operations, use the useWallet() hook directly.
 * This service is kept for backward compatibility with existing code.
 * 
 * SETUP: Uses @walletconnect/modal-react-native for wallet connection
 */

import { ethers } from 'ethers';

// Monad Testnet Configuration
export const MONAD_CONFIG = {
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

/**
 * Singleton service that holds a reference to the wallet context
 * This allows non-React code to access wallet functionality
 */
class MetaMaskService {
  constructor() {
    this._walletContext = null;
    this._provider = null;
  }

  /**
   * Set the wallet context reference (called from WalletProvider)
   */
  setWalletContext(context) {
    this._walletContext = context;
    console.log('✅ MetaMaskService: Wallet context set');
  }

  /**
   * Get Monad JSON-RPC provider for read operations
   */
  getProvider() {
    if (!this._provider) {
      this._provider = new ethers.JsonRpcProvider(MONAD_CONFIG.rpcUrl, {
        chainId: MONAD_CONFIG.chainId,
        name: 'monad-testnet',
      });
    }
    return this._provider;
  }

  /**
   * Check if wallet is connected
   */
  isConnected() {
    return this._walletContext?.isConnected || false;
  }

  /**
   * Get connected address
   */
  getAddress() {
    return this._walletContext?.address || null;
  }

  /**
   * Get a signer-like object
   */
  getSigner() {
    if (!this._walletContext?.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this._walletContext.getSigner();
  }

  /**
   * Connect wallet - Opens the WalletConnect modal
   */
  async connectMetaMask() {
    if (!this._walletContext) {
      throw new Error('Wallet context not initialized. Make sure WalletProvider is mounted.');
    }
    
    if (this._walletContext.isConnected) {
      return {
        success: true,
        address: this._walletContext.address,
      };
    }

    await this._walletContext.connectWallet();
    
    // Wait a bit for state to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: this._walletContext.isConnected,
      address: this._walletContext.address,
    };
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
    if (this._walletContext?.disconnectWallet) {
      await this._walletContext.disconnectWallet();
    }
  }

  /**
   * Sign a message using personal_sign
   */
  async signMessage(message) {
    if (!this._walletContext?.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this._walletContext.signMessage(message);
  }

  /**
   * Sign EIP-712 typed data
   * @param {Object} typedData - The typed data to sign
   * @param {Object} options - Options including timeout and retries
   */
  async signTypedData(typedData, options = {}) {
    if (!this._walletContext?.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this._walletContext.signTypedData(typedData, options);
  }

  /**
   * Send transaction
   */
  async sendTransaction(to, value, data = '0x') {
    if (!this._walletContext?.isConnected) {
      throw new Error('Wallet not connected');
    }
    
    const tx = {
      to,
      value: ethers.parseEther(value.toString()),
      data,
    };
    
    return this._walletContext.sendTransaction(tx);
  }

  /**
   * Get balance from Monad network
   */
  async getBalance(address = null) {
    const addr = address || this.getAddress();
    if (!addr) {
      throw new Error('No address provided');
    }
    
    const provider = this.getProvider();
    const balance = await provider.getBalance(addr);
    return ethers.formatEther(balance);
  }

  /**
   * Get contract with signer capabilities
   */
  getContract(address, abi) {
    if (!this._walletContext?.isConnected) {
      throw new Error('Wallet not connected');
    }
    return this._walletContext.getContract(address, abi);
  }

  /**
   * Get read-only contract
   */
  getReadOnlyContract(address, abi) {
    const provider = this.getProvider();
    return new ethers.Contract(address, abi, provider);
  }

  /**
   * Switch to Monad network
   */
  async switchToMonadNetwork() {
    if (!this._walletContext?.switchToMonad) {
      throw new Error('Wallet context not initialized');
    }
    return this._walletContext.switchToMonad();
  }

  /**
   * Get session info for debugging
   */
  getSessionInfo() {
    return {
      connected: this.isConnected(),
      address: this.getAddress(),
      targetChain: `eip155:${MONAD_CONFIG.chainId}`,
      targetChainId: MONAD_CONFIG.chainId,
      targetChainName: MONAD_CONFIG.chainName,
    };
  }

  /**
   * Get target chain ID
   */
  getTargetChainId() {
    return MONAD_CONFIG.chainId;
  }

  /**
   * Get target chain name
   */
  getTargetChainName() {
    return MONAD_CONFIG.chainName;
  }

  /**
   * Check if connected to Monad network
   */
  isOnMonad() {
    // WalletContext handles chain switching, so if connected we assume Monad
    return this.isConnected();
  }

  /**
   * Check if MetaMask app is installed
   * Note: With WalletConnect modal, this always returns true as the modal handles wallet discovery
   */
  async isMetaMaskInstalled() {
    // WalletConnect modal handles wallet availability
    return true;
  }

  /**
   * Add Monad network to wallet
   * Note: This is handled by WalletContext.switchToMonad()
   */
  async addMonadNetwork() {
    if (!this._walletContext?.switchToMonad) {
      throw new Error('Wallet context not initialized');
    }
    return this._walletContext.switchToMonad();
  }

  /**
   * Force reconnect - clears connection and opens modal again
   */
  async forceReconnect() {
    if (this._walletContext) {
      await this._walletContext.disconnectWallet();
      await this._walletContext.connectWallet();
      
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return {
        success: this._walletContext.isConnected,
        address: this._walletContext.address,
      };
    }
    return { success: false, error: 'Wallet context not initialized' };
  }
}

// Export singleton instance
const metamaskService = new MetaMaskService();
export default metamaskService;