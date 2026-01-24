/**
 * WebSocket Service - Real-time updates for mobile app
 */

import { io } from 'socket.io-client';
import config from '../config';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect to WebSocket server (non-blocking, gracefully handles failures)
   */
  connect() {
    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    return new Promise((resolve) => {
      const wsUrl = config.API_URL.replace('/api', '');
      console.log('Attempting WebSocket connection to:', wsUrl);
      
      // Set a timeout to avoid hanging forever
      const connectionTimeout = setTimeout(() => {
        console.warn('WebSocket connection timed out - continuing without real-time updates');
        resolve(null);
      }, 10000); // 10 second timeout
      
      try {
        this.socket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 8000,
          forceNew: true,
        });

      this.socket.on('connect', () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connected:', this.socket.id);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(this.socket);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.warn('WebSocket connection error (attempt ' + this.reconnectAttempts + '):', error.message);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          clearTimeout(connectionTimeout);
          // Don't reject - just log and continue without WebSocket
          console.warn('WebSocket unavailable - app will work without real-time updates');
          resolve(null); // Resolve with null instead of rejecting
        }
      });
      } catch (err) {
        clearTimeout(connectionTimeout);
        console.warn('WebSocket init error:', err.message);
        resolve(null);
      }

      // Setup default listeners
      this.setupDefaultListeners();
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Setup default event listeners
   */
  setupDefaultListeners() {
    if (!this.socket) return;

    // Re-attach all stored listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket.on(event, callback);
      });
    });
  }

  /**
   * Subscribe to an event
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit an event
   */
  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  /**
   * Join a market room for updates
   */
  joinMarket(marketId) {
    this.emit('join:market', marketId);
  }

  /**
   * Leave a market room
   */
  leaveMarket(marketId) {
    this.emit('leave:market', marketId);
  }

  /**
   * Join user room for personal updates
   */
  joinUser(userId) {
    this.emit('join:user', userId);
  }

  /**
   * Subscribe to price updates
   */
  subscribePrices() {
    this.emit('subscribe:prices');
  }

  /**
   * Unsubscribe from price updates
   */
  unsubscribePrices() {
    this.emit('unsubscribe:prices');
  }

  /**
   * Listen for market created events
   */
  onMarketCreated(callback) {
    return this.on('market:created', callback);
  }

  /**
   * Listen for market updated events
   */
  onMarketUpdated(callback) {
    return this.on('market:updated', callback);
  }

  /**
   * Listen for bet placed events
   */
  onBetPlaced(callback) {
    return this.on('bet:placed', callback);
  }

  /**
   * Listen for market resolved events
   */
  onMarketResolved(callback) {
    return this.on('market:resolved', callback);
  }

  /**
   * Listen for price updates
   */
  onPriceUpdate(callback) {
    return this.on('prices:updated', callback);
  }

  /**
   * Listen for notifications
   */
  onNotification(callback) {
    return this.on('notification', callback);
  }

  /**
   * Check if connected
   */
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

export default new SocketService();
