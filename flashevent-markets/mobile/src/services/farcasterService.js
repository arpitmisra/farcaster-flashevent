/**
 * Farcaster Service - Neynar API integration
 */

import config from '../config';

const NEYNAR_BASE_URL = 'https://api.neynar.com/v2/farcaster';

class FarcasterService {
  constructor() {
    this.apiKey = config.NEYNAR_API_KEY;
  }

  /**
   * Make authenticated request to Neynar API
   */
  async request(endpoint, options = {}) {
    const url = `${NEYNAR_BASE_URL}${endpoint}`;
    
    const headers = {
      'accept': 'application/json',
      'api_key': this.apiKey,
      ...options.headers,
    };

    if (options.body && typeof options.body === 'object') {
      headers['content-type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Create a signer request for authentication
   */
  async createSignerRequest() {
    return this.request('/signer', {
      method: 'POST',
    });
  }

  /**
   * Check the status of a signer request
   */
  async checkSignerStatus(signerUuid) {
    return this.request(`/signer?signer_uuid=${signerUuid}`);
  }

  /**
   * Revoke a signer
   */
  async revokeSigner(signerUuid) {
    return this.request('/signer', {
      method: 'DELETE',
      body: { signer_uuid: signerUuid },
    });
  }

  /**
   * Validate a session token
   */
  async validateSession(signerUuid) {
    try {
      const result = await this.checkSignerStatus(signerUuid);
      return result.status === 'approved';
    } catch {
      return false;
    }
  }

  /**
   * Get user by FID
   */
  async getUserByFid(fid) {
    const result = await this.request(`/user/bulk?fids=${fid}`);
    return result.users?.[0];
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username) {
    const result = await this.request(`/user/by_username?username=${username}`);
    return result.user;
  }

  /**
   * Search users
   */
  async searchUsers(query, limit = 10) {
    const result = await this.request(`/user/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return result.users || [];
  }

  /**
   * Get user's feed
   */
  async getFeed(fid, feedType = 'following', limit = 25, cursor = null) {
    let endpoint = `/feed?fid=${fid}&limit=${limit}`;
    
    if (feedType === 'following') {
      endpoint = `/feed/following?fid=${fid}&limit=${limit}`;
    } else if (feedType === 'trending') {
      endpoint = `/feed/trending?limit=${limit}`;
    }
    
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }
    
    return this.request(endpoint);
  }

  /**
   * Publish a cast
   */
  async publishCast(signerUuid, text, embeds = [], parent = null) {
    const body = {
      signer_uuid: signerUuid,
      text,
    };

    if (embeds.length > 0) {
      body.embeds = embeds;
    }

    if (parent) {
      body.parent = parent;
    }

    return this.request('/cast', {
      method: 'POST',
      body,
    });
  }

  /**
   * Delete a cast
   */
  async deleteCast(signerUuid, targetHash) {
    return this.request('/cast', {
      method: 'DELETE',
      body: {
        signer_uuid: signerUuid,
        target_hash: targetHash,
      },
    });
  }

  /**
   * Like a cast
   */
  async likeCast(signerUuid, targetHash) {
    return this.request('/reaction', {
      method: 'POST',
      body: {
        signer_uuid: signerUuid,
        reaction_type: 'like',
        target: targetHash,
      },
    });
  }

  /**
   * Unlike a cast
   */
  async unlikeCast(signerUuid, targetHash) {
    return this.request('/reaction', {
      method: 'DELETE',
      body: {
        signer_uuid: signerUuid,
        reaction_type: 'like',
        target: targetHash,
      },
    });
  }

  /**
   * Recast
   */
  async recast(signerUuid, targetHash) {
    return this.request('/reaction', {
      method: 'POST',
      body: {
        signer_uuid: signerUuid,
        reaction_type: 'recast',
        target: targetHash,
      },
    });
  }

  /**
   * Remove recast
   */
  async removeRecast(signerUuid, targetHash) {
    return this.request('/reaction', {
      method: 'DELETE',
      body: {
        signer_uuid: signerUuid,
        reaction_type: 'recast',
        target: targetHash,
      },
    });
  }

  /**
   * Follow a user
   */
  async followUser(signerUuid, targetFid) {
    return this.request('/follow', {
      method: 'POST',
      body: {
        signer_uuid: signerUuid,
        target_fid: targetFid,
      },
    });
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(signerUuid, targetFid) {
    return this.request('/follow', {
      method: 'DELETE',
      body: {
        signer_uuid: signerUuid,
        target_fid: targetFid,
      },
    });
  }

  /**
   * Get user's followers
   */
  async getFollowers(fid, limit = 25, cursor = null) {
    let endpoint = `/followers?fid=${fid}&limit=${limit}`;
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }
    return this.request(endpoint);
  }

  /**
   * Get user's following
   */
  async getFollowing(fid, limit = 25, cursor = null) {
    let endpoint = `/following?fid=${fid}&limit=${limit}`;
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }
    return this.request(endpoint);
  }

  /**
   * Get cast by hash
   */
  async getCast(hash) {
    return this.request(`/cast?identifier=${hash}&type=hash`);
  }

  /**
   * Get casts in a thread
   */
  async getCastThread(hash) {
    return this.request(`/cast/conversation?identifier=${hash}&type=hash`);
  }

  /**
   * Get reactions for a cast
   */
  async getCastReactions(hash, type = 'likes', limit = 25) {
    return this.request(`/reactions/cast?hash=${hash}&types=${type}&limit=${limit}`);
  }

  /**
   * Get channel feed
   */
  async getChannelFeed(channelId, limit = 25, cursor = null) {
    let endpoint = `/feed/channels?channel_ids=${channelId}&limit=${limit}`;
    if (cursor) {
      endpoint += `&cursor=${cursor}`;
    }
    return this.request(endpoint);
  }

  /**
   * Get trending channels
   */
  async getTrendingChannels(limit = 10) {
    return this.request(`/channel/trending?limit=${limit}`);
  }
}

export default new FarcasterService();
