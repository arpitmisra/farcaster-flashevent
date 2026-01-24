/**
 * Auth Service - Handles wallet-based authentication with JWT tokens
 * 
 * Flow:
 * 1. Request nonce from backend
 * 2. Sign nonce with MetaMask
 * 3. Send signature to backend for verification
 * 4. Receive JWT token for authenticated requests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import metamaskService from './metamaskService';

// Storage keys
const STORAGE_KEYS = {
  JWT_TOKEN: 'flashevent_jwt_token',
  AUTH_ADDRESS: 'flashevent_auth_address',
  AUTH_EXPIRY: 'flashevent_auth_expiry',
};

// Token refresh threshold (refresh when less than 1 day remaining)
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

class AuthService {
  constructor() {
    this.baseUrl = config.API_URL || 'http://localhost:3001/api';
    this.token = null;
    this.address = null;
    this.isInitialized = false;
  }

  /**
   * Initialize service - load stored token
   */
  async init() {
    if (this.isInitialized) return;

    try {
      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
      const storedAddress = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_ADDRESS);
      const storedExpiry = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_EXPIRY);

      if (storedToken && storedAddress) {
        // Check if token is still valid
        const expiry = storedExpiry ? parseInt(storedExpiry, 10) : 0;
        const now = Date.now();

        if (expiry > now) {
          this.token = storedToken;
          this.address = storedAddress;
          console.log('✅ Loaded valid auth token for', storedAddress);

          // Auto-refresh if close to expiry
          if (expiry - now < REFRESH_THRESHOLD_MS) {
            console.log('🔄 Token close to expiry, refreshing...');
            this.refreshToken().catch(console.warn);
          }
        } else {
          console.log('⏰ Auth token expired, clearing...');
          await this.clearAuth();
        }
      }
    } catch (error) {
      console.warn('Failed to load auth token:', error);
    }

    this.isInitialized = true;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.address;
  }

  /**
   * Get current auth token
   */
  getToken() {
    return this.token;
  }

  /**
   * Get authenticated address
   */
  getAddress() {
    return this.address;
  }

  /**
   * Authenticate with wallet signature
   * This is the main login method
   */
  async authenticate() {
    console.log('🔐 Starting authentication...');

    // Get wallet address from MetaMask
    const sessionInfo = metamaskService.getSessionInfo?.();
    const walletAddress = sessionInfo?.address;

    if (!walletAddress) {
      throw new Error('Wallet not connected. Please connect MetaMask first.');
    }

    console.log('📍 Authenticating address:', walletAddress);

    // Step 1: Request nonce from backend
    console.log('📝 Requesting auth nonce...');
    const nonceResponse = await this.request(`/auth/nonce?address=${walletAddress}`);
    const { message, nonce } = nonceResponse;

    console.log('✅ Got nonce:', nonce);

    // Step 2: Sign the message with MetaMask
    console.log('✍️ Requesting signature from MetaMask...');
    const signature = await metamaskService.signMessage(message);

    if (!signature) {
      throw new Error('Signature was not provided');
    }

    console.log('✅ Got signature');

    // Step 3: Send signature to backend for verification
    console.log('🔍 Verifying signature with backend...');
    const verifyResponse = await this.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        address: walletAddress,
        signature,
        message,
      }),
    });

    if (!verifyResponse.success || !verifyResponse.token) {
      throw new Error(verifyResponse.error || 'Authentication failed');
    }

    console.log('✅ Authentication successful!');

    // Step 4: Store the token
    await this.storeToken(verifyResponse.token, walletAddress);

    return {
      success: true,
      token: this.token,
      address: this.address,
    };
  }

  /**
   * Store authentication token
   */
  async storeToken(token, address) {
    this.token = token;
    this.address = address;

    // Calculate expiry (7 days from now, matching backend)
    const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.JWT_TOKEN, token),
      AsyncStorage.setItem(STORAGE_KEYS.AUTH_ADDRESS, address),
      AsyncStorage.setItem(STORAGE_KEYS.AUTH_EXPIRY, expiry.toString()),
    ]);

    console.log('💾 Auth token stored');
  }

  /**
   * Refresh the auth token
   */
  async refreshToken() {
    if (!this.token) {
      throw new Error('No token to refresh');
    }

    try {
      const response = await this.request('/auth/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (response.success && response.token) {
        await this.storeToken(response.token, this.address);
        console.log('✅ Token refreshed');
        return response.token;
      }
    } catch (error) {
      console.warn('Token refresh failed:', error.message);
      // If refresh fails, clear auth and require re-authentication
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        await this.clearAuth();
      }
      throw error;
    }
  }

  /**
   * Clear authentication
   */
  async clearAuth() {
    this.token = null;
    this.address = null;

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.JWT_TOKEN),
      AsyncStorage.removeItem(STORAGE_KEYS.AUTH_ADDRESS),
      AsyncStorage.removeItem(STORAGE_KEYS.AUTH_EXPIRY),
    ]);

    console.log('🗑️ Auth cleared');
  }

  /**
   * Check auth status with backend
   */
  async checkStatus() {
    if (!this.token) {
      return { authenticated: false };
    }

    try {
      const response = await this.request('/auth/status', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      return response;
    } catch (error) {
      console.warn('Auth status check failed:', error.message);
      return { authenticated: false, error: error.message };
    }
  }

  /**
   * Ensure user is authenticated (auto-authenticate if needed)
   * This only triggers MetaMask signature if no valid token exists
   */
  async ensureAuthenticated() {
    await this.init();

    // Check if we have a valid token
    if (this.isAuthenticated()) {
      // Quick check - if wallet address matches and token exists, assume valid
      // This avoids unnecessary network calls and MetaMask prompts
      const sessionInfo = metamaskService.getSessionInfo?.();
      const currentWallet = sessionInfo?.address?.toLowerCase();
      
      if (currentWallet && this.address?.toLowerCase() === currentWallet) {
        console.log('✅ Using existing auth token (same wallet)');
        return { success: true, token: this.token, address: this.address };
      }
      
      // Wallet changed, need to re-authenticate
      if (currentWallet && this.address?.toLowerCase() !== currentWallet) {
        console.log('⚠️ Wallet changed, re-authenticating...');
        await this.clearAuth();
        return await this.authenticate();
      }
      
      // Verify token is still valid with backend (fallback)
      try {
        const status = await this.checkStatus();
        if (status.authenticated) {
          return { success: true, token: this.token, address: this.address };
        }
      } catch (e) {
        console.warn('Auth status check failed, re-authenticating:', e.message);
      }
      
      // Token invalid, clear and re-authenticate
      await this.clearAuth();
    }

    // Need to authenticate
    return await this.authenticate();
  }

  /**
   * Make an HTTP request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed: ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error.message === 'Network request failed') {
        throw new Error(`Cannot connect to server. Please check your network connection. (${this.baseUrl})`);
      }
      throw error;
    }
  }
}

const authService = new AuthService();
export default authService;
