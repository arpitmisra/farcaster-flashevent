const logger = require('../utils/logger');

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    code: 'NOT_FOUND',
    path: req.path,
  });
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: Object.values(err.errors).map((e) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      code: 'DUPLICATE_ERROR',
      field: Object.keys(err.keyPattern)[0],
    });
  }

  // Custom error with status
  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code || 'ERROR',
    });
  }

  // Default server error
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
