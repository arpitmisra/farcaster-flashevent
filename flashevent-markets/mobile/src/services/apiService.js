/**
 * API Service - Backend API communication
 */

import config from '../config';

class ApiService {
  constructor() {
    this.baseUrl = config.API_URL || 'http://10.0.2.2:3001/api';
    this.maxRetries = 2;
    this.retryDelay = 1000; // 1 second
    console.log('[ApiService] Initialized with baseUrl:', this.baseUrl);
  }

  /**
   * Update base URL (useful for testing or config changes)
   */
  setBaseUrl(url) {
    this.baseUrl = url;
    console.log('[ApiService] Base URL updated to:', this.baseUrl);
  }

  /**
   * Test connection to backend
   * Returns true if backend is reachable, false otherwise
   */
  async testConnection() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl.replace('/api', '')}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      console.log('[ApiService] Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get detailed connection info for debugging
   */
  async getConnectionInfo() {
    const baseUrl = this.baseUrl;
    const healthUrl = baseUrl.replace('/api', '/health');
    
    let isReachable = false;
    let serverInfo = null;
    let error = null;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        isReachable = true;
        serverInfo = await response.json();
      } else {
        error = `Server returned status ${response.status}`;
      }
    } catch (e) {
      error = e.message;
    }
    
    return {
      baseUrl,
      healthUrl,
      isReachable,
      serverInfo,
      error,
    };
  }

  /**
   * Make an API request with retry logic
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const { skipRetry = false, ...fetchOptions } = options;
    
    console.log('[ApiService] Request:', fetchOptions.method || 'GET', url);

    const headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    let lastError;
    const maxAttempts = skipRetry ? 1 : this.maxRetries;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Add timeout for mobile network reliability
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal: controller.signal,
        });
        
        clearTimeout(timeout);

        console.log('[ApiService] Response status:', response.status);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          console.error('[ApiService] Error response:', error);
          throw new Error(error.message || error.error || `Request failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('[ApiService] Success:', endpoint);
        return data;
        
      } catch (error) {
        lastError = error;
        console.error(`[ApiService] Attempt ${attempt}/${maxAttempts} failed:`, error.message);
        
        // Check if error is retryable
        const isRetryable = error.name === 'AbortError' || 
                          error.message === 'Network request failed' ||
                          error.message?.includes('fetch');
        
        if (isRetryable && attempt < maxAttempts) {
          console.log(`[ApiService] Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }
        
        // Provide more helpful error messages
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out. Server may be unavailable. (${url})`);
        }
        if (error.message === 'Network request failed' || error.message?.includes('fetch')) {
          throw new Error(
            `Cannot connect to server. Please check your network connection.\n\n` +
            `Server URL: ${this.baseUrl}\n\n` +
            `Make sure:\n` +
            `• Backend server is running\n` +
            `• You're on the same network\n` +
            `• Check EXPO_PUBLIC_API_URL in .env`
          );
        }
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Get markets list
   */
  async getMarkets(filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.status !== undefined) params.append('status', filters.status);
    if (filters.creator) params.append('creator', filters.creator);
    if (filters.type !== undefined) params.append('type', filters.type);
    if (filters.offset) params.append('offset', filters.offset);
    if (filters.limit) params.append('limit', filters.limit || 20);
    if (filters.sort) params.append('sort', filters.sort);

    const queryString = params.toString();
    return this.request(`/markets${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Get single market details
   */
  async getMarket(marketId) {
    return this.request(`/markets/${marketId}`);
  }

  /**
   * Get trending markets
   */
  async getTrendingMarkets(limit = 10) {
    return this.request(`/markets/trending?limit=${limit}`);
  }

  /**
   * Get new markets
   */
  async getNewMarkets(limit = 20) {
    return this.request(`/markets/new?limit=${limit}`);
  }

  /**
   * Get markets from followed users
   */
  async getFollowingMarkets(fid, limit = 20) {
    return this.request(`/markets/following?fid=${fid}&limit=${limit}`);
  }

  /**
   * Search markets
   */
  async searchMarkets(query, limit = 20) {
    return this.request(`/markets/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  /**
   * Create a new market (with x402 payment)
   * @param {Object} marketData - Market data to create
   * @param {string} authToken - JWT auth token
   * @param {string} [paymentHeader] - Optional x402 payment header
   */
  async createMarket(marketData, authToken, paymentHeader = null) {
    const headers = {
      Authorization: `Bearer ${authToken}`,
    };
    
    // Add x402 payment header if provided
    if (paymentHeader) {
      headers['X-402-Payment'] = paymentHeader;
    }
    
    return this.request('/markets', {
      method: 'POST',
      headers,
      body: JSON.stringify(marketData),
    });
  }

  /**
   * Create a new market with automatic auth and payment handling
   * This is the preferred method for market creation
   */
  async createMarketWithAuth(marketData, x402Service, authService) {
    // Step 1: Ensure we're authenticated
    console.log('[ApiService] Ensuring authentication...');
    const auth = await authService.ensureAuthenticated();
    if (!auth.success || !auth.token) {
      throw new Error('Authentication failed. Please reconnect your wallet.');
    }
    
    // Step 2: Create x402 payment header if x402 service is available and has pre-auth
    let paymentHeader = null;
    if (x402Service && x402Service.hasPreAuth()) {
      console.log('[ApiService] Creating x402 payment header...');
      try {
        paymentHeader = await x402Service.createPaymentHeader('CREATE_MARKET', {
          question: marketData.question,
          type: marketData.type,
        });
        console.log('[ApiService] Payment header created');
      } catch (paymentError) {
        console.warn('[ApiService] x402 payment header creation failed:', paymentError.message);
        // Continue without payment - backend may allow free markets or handle payment differently
      }
    }
    
    // Step 3: Create the market
    console.log('[ApiService] Creating market...');
    return this.createMarket(marketData, auth.token, paymentHeader);
  }

  /**
   * Get user's bets
   */
  async getUserBets(address, status = 'all') {
    return this.request(`/bets?address=${address}&status=${status}`);
  }

  /**
   * Get bet details
   */
  async getBet(betId) {
    return this.request(`/bets/${betId}`);
  }

  /**
   * Get user profile
   */
  async getUser(fidOrAddress) {
    return this.request(`/users/${fidOrAddress}`);
  }

  /**
   * Get user stats
   */
  async getUserStats(fidOrAddress) {
    return this.request(`/users/${fidOrAddress}/stats`);
  }

  /**
   * Get user's created markets
   */
  async getUserMarkets(fidOrAddress) {
    return this.request(`/users/${fidOrAddress}/markets`);
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(timeframe = 'all', limit = 50) {
    return this.request(`/leaderboard?timeframe=${timeframe}&limit=${limit}`);
  }

  /**
   * Get social feed
   */
  async getFeed(fid, type = 'following', cursor = null) {
    let url = `/feed?fid=${fid}&type=${type}`;
    if (cursor) url += `&cursor=${cursor}`;
    return this.request(url);
  }

  /**
   * Submit market resolution request
   */
  async requestResolution(marketId, outcome, proof = null) {
    return this.request(`/resolve/${marketId}`, {
      method: 'POST',
      body: JSON.stringify({ outcome, proof }),
    });
  }

  /**
   * Get resolution status
   */
  async getResolutionStatus(marketId) {
    return this.request(`/resolve/${marketId}/status`);
  }

  /**
   * Get price data for an asset
   */
  async getPrice(asset) {
    return this.request(`/prices/${asset}`);
  }

  /**
   * Get historical price data
   */
  async getPriceHistory(asset, period = '24h') {
    return this.request(`/prices/${asset}/history?period=${period}`);
  }

  /**
   * Subscribe to market updates (returns WebSocket URL)
   */
  getMarketWebSocketUrl(marketId) {
    const wsBase = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsBase}/ws/markets/${marketId}`;
  }

  /**
   * Subscribe to user notifications (returns WebSocket URL)
   */
  getNotificationsWebSocketUrl(address) {
    const wsBase = this.baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsBase}/ws/notifications/${address}`;
  }

  /**
   * Get notifications
   */
  async getNotifications(address, unreadOnly = false) {
    return this.request(`/notifications?address=${address}&unread=${unreadOnly}`);
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  /**
   * Get gas estimation for operations
   */
  async estimateGas(operation, params) {
    return this.request('/estimate-gas', {
      method: 'POST',
      body: JSON.stringify({ operation, params }),
    });
  }

  /**
   * Report an issue
   */
  async reportIssue(type, data) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
  }

  /**
   * Get app configuration
   */
  async getConfig() {
    return this.request('/config');
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.request('/health');
  }
}

export default new ApiService();
