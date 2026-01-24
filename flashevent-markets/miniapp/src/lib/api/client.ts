import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// Axios instance for REST API
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add any auth headers here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Socket.io client for real-time updates
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// API Functions

// Markets
export async function fetchMarkets(params?: { 
  status?: string; 
  limit?: number; 
  offset?: number;
  sortBy?: string;
}) {
  return apiClient.get('/markets', { params });
}

export async function fetchMarket(addressOrId: string) {
  return apiClient.get(`/markets/${addressOrId}`);
}

export async function fetchTrendingMarkets(limit = 10) {
  return apiClient.get('/markets/trending', { params: { limit } });
}

// Bets
export async function fetchUserBets(address: string) {
  return apiClient.get(`/bets/user/${address}`);
}

export async function fetchMarketBets(marketAddress: string) {
  return apiClient.get(`/bets/market/${marketAddress}`);
}

// Users
export async function fetchUser(address: string) {
  return apiClient.get(`/users/${address}`);
}

export async function fetchUserStats(address: string) {
  return apiClient.get(`/users/${address}/stats`);
}

export async function updateUserProfile(address: string, data: {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}) {
  return apiClient.patch(`/users/${address}`, data);
}

// Leaderboard
export async function fetchLeaderboard(params?: {
  type?: 'profit' | 'winRate' | 'streak' | 'creator';
  period?: 'all' | 'month' | 'week' | 'today';
  limit?: number;
}) {
  return apiClient.get('/users/leaderboard', { params });
}

// Prices
export async function fetchPrices() {
  return apiClient.get('/prices');
}

export async function fetchPriceHistory(symbol: string, period = '24h') {
  return apiClient.get(`/prices/${symbol}/history`, { params: { period } });
}

// Feed
export async function fetchFeed(params?: { limit?: number; offset?: number }) {
  return apiClient.get('/feed', { params });
}

// Export all
export default {
  apiClient,
  getSocket,
  disconnectSocket,
  fetchMarkets,
  fetchMarket,
  fetchTrendingMarkets,
  fetchUserBets,
  fetchMarketBets,
  fetchUser,
  fetchUserStats,
  updateUserProfile,
  fetchLeaderboard,
  fetchPrices,
  fetchPriceHistory,
  fetchFeed,
};
