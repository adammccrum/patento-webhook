const pino = require('pino');

/**
 * Structured logger using Pino
 * Outputs to console with pretty formatting in development
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false,
      translateTime: 'SYS:standard'
    }
  }
});

module.exports = logger;
