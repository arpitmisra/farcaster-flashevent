/**
 * Neynar Service - Farcaster authentication and social features
 * Uses backend API for proper Sign-In With Farcaster (SIWF) flow
 */

import axios from 'axios';
import config from '../config';

// Neynar API for direct calls (fallback and lookups)
const NEYNAR_API_URL = 'https://api.neynar.com/v2';
const NEYNAR_API_KEY = process.env.EXPO_PUBLIC_NEYNAR_API_KEY || '';

class NeynarService {
  constructor() {
    // Direct Neynar API client (for user lookups)
    this.neynarClient = axios.create({
      baseURL: NEYNAR_API_URL,
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    });
    
    // Backend API client (for SIWF and casting)
    this.backendClient = axios.create({
      baseURL: config.API_URL,
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get user by FID (Farcaster ID) - uses Neynar API directly
   */
  async getUserByFid(fid) {
    try {
      const response = await this.neynarClient.get('/farcaster/user/bulk', {
        params: { fids: fid },
      });
      return response.data.users?.[0] || null;
    } catch (error) {
      console.error('Error fetching user by FID:', error);
      // Return demo user in case of error
      return this.getDemoUser(fid);
    }
  }

  /**
   * Get user by username - uses Neynar API directly
   */
  async getUserByUsername(username) {
    try {
      // First try via backend
      const response = await this.backendClient.get(`/farcaster/user/username/${username}`);
      if (response.data.success) {
        return response.data.user;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user by username:', error);
      // Try direct Neynar API as fallback
      try {
        const neynarResponse = await this.neynarClient.get('/farcaster/user/by_username', {
          params: { username },
        });
        return neynarResponse.data.user || null;
      } catch (err) {
        console.error('Neynar direct fallback also failed:', err);
        return null;
      }
    }
  }

  /**
   * Create a signer for Farcaster authentication (SIWF)
   * This initiates the Sign-In With Farcaster flow
   * Returns a signer_uuid and signer_approval_url to open in Warpcast
   */
  async createSigner() {
    try {
      console.log('[NeynarService] Creating signer via backend...');
      const response = await this.backendClient.post('/farcaster/signer');
      
      if (response.data.success) {
        console.log('[NeynarService] Signer created:', {
          uuid: response.data.signerUuid,
          hasApprovalUrl: !!response.data.signerApprovalUrl,
          status: response.data.status,
        });
        return {
          signer_uuid: response.data.signerUuid,
          public_key: response.data.publicKey,
          status: response.data.status,
          signer_approval_url: response.data.signerApprovalUrl,
          deepLinkUrl: response.data.deepLinkUrl, // For mobile Warpcast
          fid: response.data.fid,
        };
      }
      
      throw new Error(response.data.message || 'Failed to create signer');
    } catch (error) {
      console.error('[NeynarService] Error creating signer:', error.response?.data || error.message);
      
      // Check if it's a network error (can't reach backend) or backend error
      const isNetworkError = error.message === 'Network Error' || 
                            error.code === 'ECONNREFUSED' ||
                            error.code === 'ERR_NETWORK' ||
                            !error.response;
      
      // Return demo signer for development/testing when:
      // 1. In demo mode (no API key configured)
      // 2. Network error (can't reach backend - common in development)
      // 3. Backend returned 500 (internal error)
      if (this.isDemoMode() || isNetworkError || error.response?.status === 500) {
        console.log('[NeynarService] Falling back to demo signer due to:', 
          isNetworkError ? 'network error' : 
          error.response?.status === 500 ? 'backend error' : 'demo mode');
        return {
          signer_uuid: 'demo-signer-' + Date.now(),
          public_key: '0xdemo_public_key',
          status: 'approved',
          signer_approval_url: null,
          deepLinkUrl: null,
          fid: 12345,
        };
      }
      throw error;
    }
  }

  /**
   * Check signer status - polls until approved or timeout
   */
  async getSignerStatus(signerUuid) {
    try {
      // Demo mode - return approved status
      if (this.isDemoMode() || signerUuid.startsWith('demo-')) {
        return {
          signer_uuid: signerUuid,
          status: 'approved',
          fid: 12345,
        };
      }

      console.log('[NeynarService] Checking signer status:', signerUuid);
      const response = await this.backendClient.get(`/farcaster/signer/${signerUuid}`);
      
      if (response.data.success) {
        return {
          signer_uuid: response.data.signerUuid,
          status: response.data.status,
          fid: response.data.fid,
          user: response.data.user,
        };
      }
      
      throw new Error(response.data.message || 'Failed to get signer status');
    } catch (error) {
      console.error('[NeynarService] Error getting signer status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Poll for signer approval - waits for user to approve in Warpcast
   * @param signerUuid - The signer UUID to poll
   * @param maxAttempts - Maximum number of polling attempts (default 60 = ~5 minutes)
   * @param intervalMs - Polling interval in milliseconds (default 5000)
   * @param onStatusUpdate - Callback for status updates
   */
  async pollSignerApproval(signerUuid, maxAttempts = 60, intervalMs = 5000, onStatusUpdate = null) {
    console.log('[NeynarService] Starting signer approval polling:', signerUuid);
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await this.getSignerStatus(signerUuid);
        
        if (onStatusUpdate) {
          onStatusUpdate(status.status, attempt + 1, maxAttempts);
        }
        
        if (status.status === 'approved') {
          console.log('[NeynarService] Signer approved!', { fid: status.fid });
          return status;
        }
        
        if (status.status === 'revoked') {
          throw new Error('Signer was revoked');
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error(`[NeynarService] Poll attempt ${attempt + 1} failed:`, error.message);
        // Continue polling unless it's a fatal error
        if (error.message === 'Signer was revoked') {
          throw error;
        }
      }
    }
    
    throw new Error('Signer approval timeout - please try again');
  }

  /**
   * Publish a cast to Farcaster
   */
  async publishCast(signerUuid, text, embeds = []) {
    try {
      // Demo mode
      if (this.isDemoMode() || signerUuid?.startsWith('demo-')) {
        console.log('[NeynarService] Demo mode - cast would be published:', text);
        return { success: true, cast: { hash: 'demo-hash-' + Date.now() } };
      }

      console.log('[NeynarService] Publishing cast via backend...');
      const response = await this.backendClient.post('/farcaster/cast', {
        signerUuid,
        text,
        embeds,
      });

      if (response.data.success) {
        return response.data;
      }
      
      throw new Error(response.data.message || 'Failed to publish cast');
    } catch (error) {
      console.error('[NeynarService] Error publishing cast:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publish a market creation cast
   */
  async publishMarketCast(signerUuid, marketData) {
    try {
      // Demo mode
      if (this.isDemoMode() || signerUuid?.startsWith('demo-')) {
        console.log('[NeynarService] Demo mode - market cast would be published:', marketData);
        return { success: true, cast: { hash: 'demo-hash-' + Date.now() } };
      }

      console.log('[NeynarService] Publishing market cast via backend...');
      const response = await this.backendClient.post('/farcaster/cast/market', {
        signerUuid,
        question: marketData.question,
        marketAddress: marketData.marketAddress,
        expiry: marketData.expiry,
        type: marketData.type,
      });

      if (response.data.success) {
        return response.data;
      }
      
      throw new Error(response.data.message || 'Failed to publish market cast');
    } catch (error) {
      console.error('[NeynarService] Error publishing market cast:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user's feed from Farcaster
   */
  async getFeed(fid, feedType = 'following', limit = 25) {
    try {
      console.log('[NeynarService] Fetching feed:', { fid, feedType, limit });
      const response = await this.backendClient.get(`/farcaster/feed/${fid}`, {
        params: { feedType, limit },
      });

      if (response.data.success) {
        return { casts: response.data.casts || [] };
      }
      
      return { casts: [] };
    } catch (error) {
      console.error('[NeynarService] Error fetching feed:', error.response?.data || error.message);
      // Return empty feed instead of throwing
      return { casts: [] };
    }
  }

  /**
   * Get demo user for testing without API
   */
  getDemoUser(fid = 12345) {
    return {
      fid,
      username: 'demo_user',
      display_name: 'Demo User',
      pfp_url: 'https://i.imgur.com/8Km9tLL.png',
      profile: {
        bio: {
          text: 'Demo Farcaster user for FlashEvent testing',
        },
      },
      follower_count: 1000,
      following_count: 500,
      verifications: ['0x1234567890abcdef1234567890abcdef12345678'],
      custody_address: '0x1234567890abcdef1234567890abcdef12345678',
    };
  }

  /**
   * Check if in demo mode (no API key configured)
   */
  isDemoMode() {
    return !NEYNAR_API_KEY || NEYNAR_API_KEY === '' || NEYNAR_API_KEY === 'demo-key';
  }

  /**
   * Check Farcaster service status
   */
  async checkStatus() {
    try {
      const response = await this.backendClient.get('/farcaster/status');
      return response.data;
    } catch (error) {
      console.error('[NeynarService] Error checking status:', error);
      return {
        configured: false,
        demoMode: this.isDemoMode(),
        error: error.message,
      };
    }
  }
}

export const neynarService = new NeynarService();
export default neynarService;
