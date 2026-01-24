import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { ethers } from 'ethers';
import { MONAD_TESTNET, getRpcUrl } from '../config/chains';
import metamaskService from '../services/metamaskService';

const WALLET_STORAGE_KEY = 'flashevent_wallet';
const PRIVATE_KEY_STORAGE_KEY = 'flashevent_private_key';

// Demo mode - disabled
const DEMO_MODE = false;

export const useWalletStore = create((set, get) => ({
  // State
  isConnected: false,
  isConnecting: false,
  address: null,
  chainId: null,
  balance: null,
  provider: null,
  signer: null,
  wallet: null,
  error: null,
  demoMode: DEMO_MODE,
  isMetaMask: false, // Track if using MetaMask

  // UI state setters (used by hooks/screens)
  setConnecting: (value) => set({ isConnecting: value }),
  setAddress: (address) => set({
    address,
    isConnected: Boolean(address),
  }),

  // Get provider for Monad Testnet (uses metamaskService provider)
  getProvider: () => {
    try {
      // Use MetaMask service provider if available
      if (metamaskService.isConnected()) {
        return metamaskService.getProvider();
      }
      // Fallback to direct provider
      const rpcUrl = getRpcUrl(MONAD_TESTNET.chainId);
      return new ethers.JsonRpcProvider(rpcUrl);
    } catch (error) {
      console.warn('Failed to create provider:', error);
      return null;
    }
  },

  // Get signer for transactions
  getSigner: () => {
    const { wallet, signer, isMetaMask } = get();
    
    // Use MetaMask signer if connected via MetaMask
    if (isMetaMask && metamaskService.isConnected()) {
      return metamaskService.getSigner();
    }
    
    // Use local wallet/signer
    return wallet || signer;
  },

  // Refresh balance for a given address (or current address)
  refreshBalance: async (addressOverride = null) => {
    try {
      const provider = get().getProvider();
      if (!provider) {
        throw new Error('Provider not available');
      }

      const address = addressOverride || get().address;
      if (!address) {
        throw new Error('No address to fetch balance');
      }

      const balanceWei = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceWei);

      set({
        balance,
        address,
        isConnected: true,
        chainId: MONAD_TESTNET.chainId,
        provider,
      });

      return balance;
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      set({ error: error.message });
      return null;
    }
  },

  // Connect via MetaMask/WalletConnect
  connectMetaMask: async () => {
    try {
      set({ isConnecting: true, error: null });
      
      const result = await metamaskService.connectMetaMask();
      
      if (!result.success) {
        throw new Error('Failed to connect MetaMask');
      }

      const address = result.address;
      const provider = metamaskService.getProvider();
      
      // Get balance
      const balanceWei = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceWei);

      set({
        isConnected: true,
        isConnecting: false,
        address,
        chainId: MONAD_TESTNET.chainId,
        balance,
        provider,
        signer: metamaskService.getSigner(),
        wallet: null,
        error: null,
        isMetaMask: true,
      });

      return { success: true, address };
    } catch (error) {
      console.error('MetaMask connection failed:', error);
      set({ 
        isConnecting: false, 
        error: error.message,
        isConnected: false,
        isMetaMask: false,
      });
      return { success: false, error: error.message };
    }
  },

  // Set external wallet (e.g., MetaMask via WalletConnect) and fetch balance
  setExternalWallet: async (address, chainId = MONAD_TESTNET.chainId) => {
    try {
      const provider = get().getProvider();
      if (!provider) {
        throw new Error('Provider not available');
      }

      const balanceWei = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceWei);

      // Check if this is from MetaMask
      const isMetaMask = metamaskService.isConnected() && metamaskService.getAddress() === address;

      set({
        isConnected: true,
        isConnecting: false,
        address,
        chainId,
        balance,
        provider,
        signer: isMetaMask ? metamaskService.getSigner() : null,
        wallet: null,
        error: null,
        isMetaMask,
      });

      return { success: true, balance };
    } catch (error) {
      console.error('Failed to set external wallet:', error);
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Import wallet from private key
  importFromPrivateKey: async (privateKey) => {
    try {
      set({ isConnecting: true, error: null });
      
      // Validate private key format
      let formattedKey = privateKey.trim();
      if (!formattedKey.startsWith('0x')) {
        formattedKey = '0x' + formattedKey;
      }
      
      // Create provider
      const provider = get().getProvider();
      if (!provider) {
        throw new Error('Failed to connect to Monad Testnet');
      }
      
      // Create wallet from private key
      const wallet = new ethers.Wallet(formattedKey, provider);
      const address = await wallet.getAddress();
      
      // Get balance
      const balanceWei = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceWei);
      
      // Store wallet data securely
      await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, formattedKey);
      await SecureStore.setItemAsync(WALLET_STORAGE_KEY, JSON.stringify({
        address,
        chainId: MONAD_TESTNET.chainId,
      }));
      
      set({
        isConnected: true,
        isConnecting: false,
        address,
        chainId: MONAD_TESTNET.chainId,
        balance,
        provider,
        signer: wallet,
        wallet,
        error: null,
        isMetaMask: false,
      });
      
      return { success: true, address };
    } catch (error) {
      console.error('Error importing wallet:', error);
      set({ 
        isConnecting: false, 
        error: error.message,
        isConnected: false,
      });
      return { success: false, error: error.message };
    }
  },

  // Generate a new wallet
  generateNewWallet: async () => {
    try {
      set({ isConnecting: true, error: null });
      
      // Create provider
      const provider = get().getProvider();
      if (!provider) {
        throw new Error('Failed to connect to Monad Testnet');
      }
      
      // Generate new wallet
      const wallet = ethers.Wallet.createRandom().connect(provider);
      const address = await wallet.getAddress();
      const privateKey = wallet.privateKey;
      
      // Get balance (will be 0 for new wallet)
      const balanceWei = await provider.getBalance(address);
      const balance = ethers.formatEther(balanceWei);
      
      // Store wallet data securely
      await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, privateKey);
      await SecureStore.setItemAsync(WALLET_STORAGE_KEY, JSON.stringify({
        address,
        chainId: MONAD_TESTNET.chainId,
      }));
      
      set({
        isConnected: true,
        isConnecting: false,
        address,
        chainId: MONAD_TESTNET.chainId,
        balance,
        provider,
        signer: wallet,
        wallet,
        error: null,
      });
      
      return { success: true, address, privateKey };
    } catch (error) {
      console.error('Error generating wallet:', error);
      set({ 
        isConnecting: false, 
        error: error.message,
        isConnected: false,
      });
      return { success: false, error: error.message };
    }
  },

  // Legacy connect method (for compatibility)
  connect: async (connector) => {
    try {
      set({ isConnecting: true, error: null });
      
      if (connector && connector.connect) {
        // Use provided connector (e.g., WalletConnect)
        const { accounts, chainId } = await connector.connect();
        
        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found');
        }
        
        const address = accounts[0];
        const provider = get().getProvider();
        
        const balance = await provider.getBalance(address);
        
        await SecureStore.setItemAsync(WALLET_STORAGE_KEY, JSON.stringify({
          address,
          chainId,
        }));
        
        set({
          isConnected: true,
          isConnecting: false,
          address,
          chainId,
          balance: ethers.formatEther(balance),
          provider,
        });
        
        return true;
      } else {
        // No connector provided, try to restore from storage
        return await get().checkConnection();
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      set({ 
        isConnecting: false, 
        error: error.message,
        isConnected: false,
      });
      return false;
    }
  },

  // Disconnect wallet
  disconnect: async () => {
    try {
      // Disconnect MetaMask if connected
      const { isMetaMask } = get();
      if (isMetaMask && metamaskService.isConnected()) {
        await metamaskService.disconnect();
      }

      await SecureStore.deleteItemAsync(WALLET_STORAGE_KEY);
      await SecureStore.deleteItemAsync(PRIVATE_KEY_STORAGE_KEY);
      
      set({
        isConnected: false,
        address: null,
        chainId: null,
        balance: null,
        provider: null,
        signer: null,
        wallet: null,
        error: null,
        isMetaMask: false,
      });
      
      return true;
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Check if wallet was previously connected and restore it
  checkConnection: async () => {
    try {
      // Note: WalletConnect modal handles session restoration automatically
      // through useWalletConnectModal hook in WalletContext
      // We only need to check for stored local wallet here
      
      // Check if MetaMask service has an active connection (set by WalletContext)
      if (metamaskService.isConnected()) {
        const address = metamaskService.getAddress();
        const provider = metamaskService.getProvider();
        const balance = await provider.getBalance(address);
        
        set({
          isConnected: true,
          address,
          chainId: MONAD_TESTNET.chainId,
          balance: ethers.formatEther(balance),
          provider,
          signer: null, // Signer is handled by WalletContext
          wallet: null,
          isMetaMask: true,
        });
        
        return true;
      }

      // Check for stored local wallet
      const stored = await SecureStore.getItemAsync(WALLET_STORAGE_KEY);
      const storedKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
      
      if (stored && storedKey) {
        const { address } = JSON.parse(stored);
        const provider = get().getProvider();
        
        if (!provider) {
          set({ isConnected: false });
          return false;
        }
        
        // Restore wallet from stored private key
        const wallet = new ethers.Wallet(storedKey, provider);
        const balance = await provider.getBalance(address);
        
        set({
          isConnected: true,
          address,
          chainId: MONAD_TESTNET.chainId,
          balance: ethers.formatEther(balance),
          provider,
          signer: wallet,
          wallet,
          isMetaMask: false,
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      return false;
    }
  },

  // Refresh balance
  refreshBalance: async () => {
    try {
      const { address, provider } = get();
      if (!address || !provider) return;
      
      const balance = await provider.getBalance(address);
      set({ balance: ethers.formatEther(balance) });
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  },

  // Get signer for transactions
  getSigner: () => {
    const { wallet, signer } = get();
    return wallet || signer;
  },

  // Sign a message
  signMessage: async (message) => {
    try {
      const signer = get().getSigner();
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      return await signer.signMessage(message);
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  },

  // Send transaction using provider/signer pattern
  sendTransaction: async (tx) => {
    try {
      const signer = get().getSigner();
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      
      console.log('📤 Sending transaction via signer...');
      const response = await signer.sendTransaction(tx);
      console.log('✅ Transaction sent:', response.hash);
      
      // Refresh balance after transaction
      setTimeout(() => get().refreshBalance(), 5000);
      
      return response;
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  },

  // Sign typed data (EIP-712)
  signTypedData: async (domain, types, value) => {
    try {
      const { isMetaMask } = get();
      
      if (isMetaMask && metamaskService.isConnected()) {
        // Use MetaMask for typed data signing
        const typedData = {
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              ...(domain.verifyingContract ? [{ name: 'verifyingContract', type: 'address' }] : []),
            ],
            ...types,
          },
          primaryType: Object.keys(types)[0],
          domain,
          message: value,
        };
        return await metamaskService.signTypedData(typedData);
      }
      
      // Use local signer
      const signer = get().getSigner();
      if (!signer) {
        throw new Error('Wallet not connected');
      }
      return await signer.signTypedData(domain, types, value);
    } catch (error) {
      console.error('Error signing typed data:', error);
      throw error;
    }
  },

  // Check if on correct network
  isOnCorrectNetwork: () => {
    const { chainId } = get();
    // Simply check if chainId matches Monad Testnet
    // The WalletContext handles chain switching
    return chainId === MONAD_TESTNET.chainId;
  },

  // Format address for display
  formatAddress: (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Export private key (for backup)
  exportPrivateKey: async () => {
    try {
      const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
      return privateKey;
    } catch (error) {
      console.error('Error exporting private key:', error);
      return null;
    }
  },
}));

export default useWalletStore;
