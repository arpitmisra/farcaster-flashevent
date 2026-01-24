import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const AUTH_STORAGE_KEY = 'flashevent_auth';

export const useAuthStore = create((set, get) => ({
  // State
  isAuthenticated: false,
  isLoading: true,
  user: null, // Farcaster user data
  fid: null, // Farcaster ID
  signerUuid: null, // Neynar signer UUID
  custodyAddress: null, // Farcaster custody address
  error: null,

  // Actions
  setUser: (user) => {
    set({
      isAuthenticated: true,
      user,
      fid: user?.fid,
      custodyAddress: user?.custody_address,
      error: null,
    });
  },

  setSignerUuid: (signerUuid) => {
    set({ signerUuid });
  },

  // Check if user is authenticated (called on app start)
  checkAuth: async () => {
    try {
      set({ isLoading: true });
      
      const stored = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          isAuthenticated: true,
          user: data.user,
          fid: data.fid,
          signerUuid: data.signerUuid,
          custodyAddress: data.custodyAddress,
          isLoading: false,
        });
        return true;
      }
      
      set({ isLoading: false });
      return false;
    } catch (error) {
      console.error('Error checking auth:', error);
      set({ isLoading: false, error: error.message });
      return false;
    }
  },

  // Login with Farcaster
  login: async (userData, signerUuid) => {
    try {
      set({ isLoading: true, error: null });
      
      const authData = {
        user: userData,
        fid: userData.fid,
        signerUuid,
        custodyAddress: userData.custody_address,
      };
      
      // Store in secure storage
      await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(authData));
      
      set({
        isAuthenticated: true,
        user: userData,
        fid: userData.fid,
        signerUuid,
        custodyAddress: userData.custody_address,
        isLoading: false,
      });
      
      return true;
    } catch (error) {
      console.error('Error logging in:', error);
      set({ isLoading: false, error: error.message });
      return false;
    }
  },

  // Logout
  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
      
      set({
        isAuthenticated: false,
        user: null,
        fid: null,
        signerUuid: null,
        custodyAddress: null,
        error: null,
      });
      
      return true;
    } catch (error) {
      console.error('Error logging out:', error);
      set({ error: error.message });
      return false;
    }
  },

  // Update user profile
  updateUser: (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...updates } });
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));

export default useAuthStore;
