/**
 * Price Service - Fetch live cryptocurrency prices
 * With real-time updates simulation when WebSocket is unavailable
 */

import axios from 'axios';
import config from '../config';
import socketService from './socketService';

const API_URL = config.API_URL;

// Real-time price simulation interval (5 seconds)
const PRICE_UPDATE_INTERVAL = 5000;

class PriceService {
  constructor() {
    this.prices = {};
    this.listeners = new Set();
    this.simulationInterval = null;
    this.isSimulating = false;
  }

  /**
   * Fetch all prices from API
   */
  async fetchPrices() {
    try {
      const response = await axios.get(`${API_URL}/prices`, { timeout: 5000 });
      if (response.data.success) {
        this.prices = response.data.data;
        this.notifyListeners(this.prices);
        return this.prices;
      }
      throw new Error('Failed to fetch prices');
    } catch (error) {
      console.warn('Error fetching prices (using simulated):', error.message);
      // Return simulated prices instead of crashing
      if (Object.keys(this.prices).length === 0) {
        this.prices = this.getMockPrices();
      } else {
        // Add slight variations to existing prices
        this.prices = this.simulatePriceMovement(this.prices);
      }
      return this.prices;
    }
  }

  /**
   * Get mock prices with realistic values
   */
  getMockPrices() {
    const now = Date.now();
    return {
      'ETH': { symbol: 'ETH', name: 'Ethereum', price: 3500, change24h: 2.5, volume24h: 15000000000, lastUpdated: now },
      'BTC': { symbol: 'BTC', name: 'Bitcoin', price: 95000, change24h: 1.2, volume24h: 35000000000, lastUpdated: now },
      'SOL': { symbol: 'SOL', name: 'Solana', price: 180, change24h: -0.5, volume24h: 3000000000, lastUpdated: now },
      'USDC': { symbol: 'USDC', name: 'USD Coin', price: 1.0, change24h: 0.01, volume24h: 5000000000, lastUpdated: now },
      'LINK': { symbol: 'LINK', name: 'Chainlink', price: 22, change24h: 3.1, volume24h: 800000000, lastUpdated: now },
      'UNI': { symbol: 'UNI', name: 'Uniswap', price: 12, change24h: -0.8, volume24h: 200000000, lastUpdated: now },
      'AAVE': { symbol: 'AAVE', name: 'Aave', price: 280, change24h: 4.2, volume24h: 300000000, lastUpdated: now },
      'MATIC': { symbol: 'MATIC', name: 'Polygon', price: 0.85, change24h: -2.1, volume24h: 400000000, lastUpdated: now },
      'ARB': { symbol: 'ARB', name: 'Arbitrum', price: 1.80, change24h: 5.5, volume24h: 600000000, lastUpdated: now },
      'OP': { symbol: 'OP', name: 'Optimism', price: 3.20, change24h: 2.8, volume24h: 400000000, lastUpdated: now },
    };
  }

  /**
   * Simulate realistic price movements
   */
  simulatePriceMovement(prices) {
    const now = Date.now();
    const newPrices = {};
    
    for (const [symbol, data] of Object.entries(prices)) {
      // Random walk: price changes by -0.5% to +0.5%
      const volatility = symbol === 'USDC' ? 0.001 : 0.005;
      const priceChange = data.price * (Math.random() - 0.5) * 2 * volatility;
      const newPrice = Math.max(0.01, data.price + priceChange);
      
      // Update 24h change slightly
      const changeAdjust = (Math.random() - 0.5) * 0.1;
      
      newPrices[symbol] = {
        ...data,
        price: parseFloat(newPrice.toFixed(symbol === 'BTC' ? 0 : 2)),
        change24h: parseFloat((data.change24h + changeAdjust).toFixed(2)),
        lastUpdated: now,
      };
    }
    
    return newPrices;
  }

  /**
   * Start simulating price updates (fallback when WebSocket unavailable)
   */
  startSimulation() {
    if (this.simulationInterval || this.isSimulating) return;
    
    console.log('📈 Starting price simulation...');
    this.isSimulating = true;
    
    this.simulationInterval = setInterval(() => {
      this.prices = this.simulatePriceMovement(this.prices);
      this.notifyListeners(this.prices);
    }, PRICE_UPDATE_INTERVAL);
  }

  /**
   * Stop simulating price updates
   */
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      this.isSimulating = false;
      console.log('📉 Stopped price simulation');
    }
  }

  /**
   * Get price for a specific asset
   */
  async getPrice(symbol) {
    try {
      const response = await axios.get(`${API_URL}/prices/${symbol}`);
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(`Price not found for ${symbol}`);
    } catch (error) {
      console.error(`Error fetching price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get supported assets list
   */
  async getSupportedAssets() {
    try {
      const response = await axios.get(`${API_URL}/prices/assets`, { timeout: 5000 });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to fetch supported assets');
    } catch (error) {
      console.warn('Error fetching supported assets (using defaults):', error.message);
      // Return default assets
      return ['ETH', 'BTC', 'SOL', 'MONAD'];
    }
  }

  /**
   * Get historical prices for an asset
   */
  async getHistoricalPrices(symbol, days = 7) {
    try {
      const response = await axios.get(`${API_URL}/prices/${symbol}/history`, {
        params: { days },
        timeout: 5000,
      });
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(`Historical data not found for ${symbol}`);
    } catch (error) {
      console.warn(`Error fetching historical prices for ${symbol}:`, error.message);
      // Return empty array instead of crashing
      return [];
    }
  }

  /**
   * Subscribe to real-time price updates via WebSocket
   * Falls back to simulation if WebSocket unavailable
   */
  subscribeToUpdates(callback) {
    this.listeners.add(callback);

    // Try WebSocket first
    let wsConnected = false;
    
    try {
      socketService.subscribePrices();
      const unsubscribe = socketService.onPriceUpdate((prices) => {
        wsConnected = true;
        this.stopSimulation(); // Stop simulation if WS works
        this.prices = prices;
        this.notifyListeners(prices);
      });

      // Start simulation as fallback after 3 seconds if no WS updates
      setTimeout(() => {
        if (!wsConnected && this.listeners.size > 0) {
          console.log('⚠️ No WebSocket updates, starting price simulation');
          // Initialize with mock prices if empty
          if (Object.keys(this.prices).length === 0) {
            this.prices = this.getMockPrices();
            this.notifyListeners(this.prices);
          }
          this.startSimulation();
        }
      }, 3000);

      return () => {
        this.listeners.delete(callback);
        if (this.listeners.size === 0) {
          socketService.unsubscribePrices();
          this.stopSimulation();
        }
        unsubscribe();
      };
    } catch (error) {
      console.warn('WebSocket subscription failed, using simulation:', error.message);
      // Start simulation immediately
      if (Object.keys(this.prices).length === 0) {
        this.prices = this.getMockPrices();
        this.notifyListeners(this.prices);
      }
      this.startSimulation();
      
      return () => {
        this.listeners.delete(callback);
        if (this.listeners.size === 0) {
          this.stopSimulation();
        }
      };
    }
  }

  /**
   * Notify all listeners of price update
   */
  notifyListeners(prices) {
    this.listeners.forEach((callback) => {
      try {
        callback(prices);
      } catch (error) {
        console.error('Error in price listener:', error);
      }
    });
  }

  /**
   * Get cached prices
   */
  getCachedPrices() {
    return this.prices;
  }

  /**
   * Format price for display
   */
  formatPrice(price, symbol = 'USD') {
    if (typeof price !== 'number') return '$0.00';
    
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(4)}`;
    }
  }

  /**
   * Format percentage change
   */
  formatChange(change) {
    if (typeof change !== 'number') return '0.00%';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  /**
   * Format volume
   */
  formatVolume(volume) {
    if (typeof volume !== 'number') return '$0';
    
    if (volume >= 1e12) {
      return `$${(volume / 1e12).toFixed(2)}T`;
    } else if (volume >= 1e9) {
      return `$${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
      return `$${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
      return `$${(volume / 1e3).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  }
}

export default new PriceService();
