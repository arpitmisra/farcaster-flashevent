const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return;
  }

  // Skip MongoDB connection if URI not configured
  if (!MONGODB_URI) {
    logger.warn('MONGODB_URI not configured - running in demo mode without database');
    // Set mongoose bufferCommands to false to fail fast instead of buffering
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 0);
    return;
  }

  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, options);
    isConnected = true;

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    // Don't throw - allow app to continue without MongoDB
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 0);
  }
}

/**
 * Check if MongoDB is actually connected
 */
function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

async function disconnectDB() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  isMongoConnected,
  getConnection: () => mongoose.connection,
};
