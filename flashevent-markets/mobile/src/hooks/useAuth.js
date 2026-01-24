/**
 * useAuth hook - Authentication and Farcaster session management
 */

import { useCallback, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import farcasterService from '../services/farcasterService';
import { logError } from '../utils/errors';

export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    token,
    setUser,
    setToken,
    setLoading,
    logout,
  } = useAuthStore();

  /**
   * Initialize authentication - check for existing session
   */
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check if we have a valid session
      if (token) {
        const isValid = await farcasterService.validateSession(token);
        if (!isValid) {
          logout();
          return false;
        }
        return true;
      }
      
      return false;
    } catch (error) {
      logError(error, { context: 'auth.initialize' });
      logout();
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, setLoading, logout]);

  /**
   * Sign in with Farcaster via Neynar
   */
  const signInWithFarcaster = useCallback(async () => {
    try {
      setLoading(true);
      
      // Create a signer request
      const signerRequest = await farcasterService.createSignerRequest();
      
      // Return the signer UUID and deep link for the user to approve
      return {
        signerUuid: signerRequest.signer_uuid,
        deepLink: signerRequest.signer_approval_url,
        pollInterval: signerRequest.poll_interval || 2000,
      };
    } catch (error) {
      logError(error, { context: 'auth.signInWithFarcaster' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  /**
   * Poll for signer approval
   */
  const pollSignerApproval = useCallback(async (signerUuid, maxAttempts = 60) => {
    try {
      for (let i = 0; i < maxAttempts; i++) {
        const status = await farcasterService.checkSignerStatus(signerUuid);
        
        if (status.status === 'approved') {
          // Get user profile
          const profile = await farcasterService.getUserByFid(status.fid);
          
          setUser({
            fid: status.fid,
            username: profile.username,
            displayName: profile.display_name,
            avatar: profile.pfp_url,
            bio: profile.profile?.bio?.text,
            signerUuid,
          });
          
          setToken(signerUuid); // Use signer UUID as token
          
          return { success: true, user: profile };
        }
        
        if (status.status === 'revoked') {
          return { success: false, error: 'Signer request was rejected' };
        }
        
        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      
      return { success: false, error: 'Approval timeout' };
    } catch (error) {
      logError(error, { context: 'auth.pollSignerApproval' });
      throw error;
    }
  }, [setUser, setToken]);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    try {
      // Revoke the signer if needed
      if (token) {
        await farcasterService.revokeSigner(token).catch(() => {
          // Ignore errors during revocation
        });
      }
      
      logout();
    } catch (error) {
      logError(error, { context: 'auth.signOut' });
      logout(); // Still logout even if revocation fails
    }
  }, [token, logout]);

  /**
   * Refresh user profile
   */
  const refreshProfile = useCallback(async () => {
    if (!user?.fid) return null;
    
    try {
      const profile = await farcasterService.getUserByFid(user.fid);
      
      setUser({
        ...user,
        username: profile.username,
        displayName: profile.display_name,
        avatar: profile.pfp_url,
        bio: profile.profile?.bio?.text,
      });
      
      return profile;
    } catch (error) {
      logError(error, { context: 'auth.refreshProfile' });
      throw error;
    }
  }, [user, setUser]);

  return {
    user,
    isAuthenticated,
    isLoading,
    initialize,
    signInWithFarcaster,
    pollSignerApproval,
    signOut,
    refreshProfile,
  };
};

export default useAuth;
