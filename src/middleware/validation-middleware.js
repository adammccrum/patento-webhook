/**
 * Request Validation Middleware
 * Uses Joi for request body, params, and query validation
 */

const logger = require('../utils/logger');
const Joi = require('joi');

/**
 * Validate request body against Joi schema
 * Returns middleware that checks req.body
 */
function validateRequestBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      logger.warn(`Request validation failed for ${req.method} ${req.path}: ${JSON.stringify(details)}`);

      return res.status(400).json({
        error: 'Bad Request',
        code: 'VALIDATION_ERROR',
        details,
        timestamp: new Date().toISOString()
      });
    }

    req.body = value;
    next();
  };
}

/**
 * Validate request params against Joi schema
 * Returns middleware that checks req.params
 */
function validateRequestParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: false
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      logger.warn(`Params validation failed for ${req.method} ${req.path}: ${JSON.stringify(details)}`);

      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_PARAMS',
        details,
        timestamp: new Date().toISOString()
      });
    }

    req.params = value;
    next();
  };
}

/**
 * Validate query parameters against Joi schema
 * Returns middleware that checks req.query
 */
function validateRequestQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));

      logger.warn(`Query validation failed for ${req.method} ${req.path}: ${JSON.stringify(details)}`);

      return res.status(400).json({
        error: 'Bad Request',
        code: 'INVALID_QUERY',
        details,
        timestamp: new Date().toISOString()
      });
    }

    req.query = value;
    next();
  };
}

module.exports = {
  validateRequestBody,
  validateRequestParams,
  validateRequestQuery
};
