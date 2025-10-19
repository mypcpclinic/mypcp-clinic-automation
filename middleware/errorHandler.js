const winston = require('winston');

// Configure logger for middleware
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'middleware' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: './logs/middleware.log' })
  ]
});

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Determine error type and response
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
  } else if (err.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  } else if (err.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Too Many Requests';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: message,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown'
    }
  });
};

/**
 * 404 handler middleware
 */
const notFoundHandler = (req, res, next) => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown'
    }
  });
};

/**
 * Rate limiting middleware
 */
const rateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100) => {
  const requests = new Map();

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [key, timestamp] of requests.entries()) {
      if (timestamp < windowStart) {
        requests.delete(key);
      }
    }

    // Check current request count
    const requestCount = Array.from(requests.values())
      .filter(timestamp => timestamp > windowStart).length;

    if (requestCount >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: ip,
        requestCount: requestCount,
        maxRequests: maxRequests,
        windowMs: windowMs,
        timestamp: new Date().toISOString()
      });

      return res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000),
          timestamp: new Date().toISOString()
        }
      });
    }

    // Record this request
    requests.set(`${ip}-${now}`, now);

    next();
  };
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove X-Powered-By header
  res.removeHeader('X-Powered-By');

  next();
};

/**
 * CORS middleware
 */
const corsHandler = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.CLINIC_WEBSITE,
    'http://localhost:3000',
    'http://localhost:3001'
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};

/**
 * Request ID middleware
 */
const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || 
           req.headers['x-correlation-id'] || 
           `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  res.setHeader('X-Request-ID', req.id);
  next();
};

/**
 * Body size limit middleware
 */
const bodySizeLimit = (limit = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const limitBytes = parseSize(limit);

    if (contentLength > limitBytes) {
      logger.warn('Request body too large', {
        contentLength: contentLength,
        limit: limitBytes,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(413).json({
        success: false,
        error: {
          message: 'Request body too large',
          limit: limit,
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  };
};

/**
 * Parse size string to bytes
 */
function parseSize(size) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';

  return Math.floor(value * units[unit]);
}

/**
 * Timeout middleware
 */
const timeout = (ms = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      logger.warn('Request timeout', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        timeout: ms,
        timestamp: new Date().toISOString()
      });

      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            message: 'Request timeout',
            timeout: ms,
            timestamp: new Date().toISOString()
          }
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

/**
 * Health check middleware
 */
const healthCheck = (req, res, next) => {
  if (req.path === '/health' || req.path === '/healthz') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return res.json(health);
  }

  next();
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error class
 */
class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Unauthorized error class
 */
class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error class
 */
class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error class
 */
class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error class
 */
class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error class
 */
class RateLimitError extends Error {
  constructor(message = 'Too Many Requests') {
    super(message);
    this.name = 'RateLimitError';
  }
}

module.exports = {
  requestLogger,
  errorHandler,
  notFoundHandler,
  rateLimiter,
  securityHeaders,
  corsHandler,
  requestId,
  bodySizeLimit,
  timeout,
  healthCheck,
  asyncHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError
};
