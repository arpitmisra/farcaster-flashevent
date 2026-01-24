const logger = require('../utils/logger');

/**
 * Zod validation middleware
 */
function validate(schema) {
  return async (req, res, next) => {
    try {
      const result = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });

      if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));

        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        });
      }

      // Replace request properties with parsed values
      if (result.data.body) req.body = result.data.body;
      if (result.data.query) req.query = result.data.query;
      if (result.data.params) req.params = result.data.params;

      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        error: 'Validation error',
        code: 'VALIDATION_INTERNAL_ERROR',
      });
    }
  };
}

module.exports = { validate };
