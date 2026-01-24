/**
 * WebSocket Service - Real-time updates for markets, bets, and prices
 */

const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.IO with the HTTP server
 */
function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join room for specific market updates
    socket.on('join:market', (marketId) => {
      socket.join(`market:${marketId}`);
      logger.debug(`Socket ${socket.id} joined market:${marketId}`);
    });

    // Leave market room
    socket.on('leave:market', (marketId) => {
      socket.leave(`market:${marketId}`);
      logger.debug(`Socket ${socket.id} left market:${marketId}`);
    });

    // Join room for user-specific updates
    socket.on('join:user', (userId) => {
      socket.join(`user:${userId}`);
      logger.debug(`Socket ${socket.id} joined user:${userId}`);
    });

    // Subscribe to price feed
    socket.on('subscribe:prices', () => {
      socket.join('prices');
      logger.debug(`Socket ${socket.id} subscribed to prices`);
    });

    // Unsubscribe from price feed
    socket.on('unsubscribe:prices', () => {
      socket.leave('prices');
      logger.debug(`Socket ${socket.id} unsubscribed from prices`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Get the Socket.IO instance
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
}

/**
 * Emit event to all connected clients
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Emit market created event
 */
function emitMarketCreated(market) {
  if (io) {
    io.emit('market:created', market);
    logger.info(`Emitted market:created for ${market.marketId || market._id}`);
  }
}

/**
 * Emit market updated event
 */
function emitMarketUpdated(market) {
  if (io) {
    const marketId = market.marketId || market._id;
    io.emit('market:updated', market);
    io.to(`market:${marketId}`).emit('market:detail:updated', market);
    logger.debug(`Emitted market:updated for ${marketId}`);
  }
}

/**
 * Emit bet placed event
 */
function emitBetPlaced(bet, market) {
  if (io) {
    const marketId = bet.marketId;
    
    // Broadcast to all users viewing this market
    io.to(`market:${marketId}`).emit('bet:placed', { bet, market });
    
    // Broadcast to the user who placed the bet
    if (bet.userId) {
      io.to(`user:${bet.userId}`).emit('user:bet:placed', bet);
    }
    
    // Broadcast market update to everyone
    io.emit('market:updated', market);
    
    logger.info(`Emitted bet:placed for market ${marketId}`);
  }
}

/**
 * Emit market resolved event
 */
function emitMarketResolved(market, outcome) {
  if (io) {
    const marketId = market.marketId || market._id;
    io.emit('market:resolved', { market, outcome });
    io.to(`market:${marketId}`).emit('market:detail:resolved', { market, outcome });
    logger.info(`Emitted market:resolved for ${marketId}, outcome: ${outcome}`);
  }
}

/**
 * Emit price update event
 */
function emitPriceUpdate(prices) {
  if (io) {
    io.to('prices').emit('prices:updated', prices);
  }
}

/**
 * Emit user notification
 */
function emitUserNotification(userId, notification) {
  if (io) {
    io.to(`user:${userId}`).emit('notification', notification);
  }
}

/**
 * Get connected clients count
 */
function getConnectedClientsCount() {
  if (io) {
    return io.engine.clientsCount;
  }
  return 0;
}

module.exports = {
  initializeSocket,
  getIO,
  emitToAll,
  emitMarketCreated,
  emitMarketUpdated,
  emitBetPlaced,
  emitMarketResolved,
  emitPriceUpdate,
  emitUserNotification,
  getConnectedClientsCount,
};
