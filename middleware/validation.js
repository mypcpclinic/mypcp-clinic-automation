const Joi = require('joi');
const winston = require('winston');

// Configure logger for validation middleware
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'validation' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: './logs/validation.log' })
  ]
});

/**
 * Validate webhook requests
 */
const validateWebhook = (req, res, next) => {
  try {
    // Basic webhook validation
    if (!req.body || typeof req.body !== 'object') {
      logger.warn('Invalid webhook request - no body', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid webhook request - no body',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Log webhook request
    logger.info('Webhook request received', {
      source: req.headers['user-agent'] || 'unknown',
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body),
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error validating webhook', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Webhook validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate Formspree form data
 */
const validateFormspreeData = (req, res, next) => {
  try {
    const formspreeSchema = Joi.object({
      fullName: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
      dob: Joi.date().max('now').required(),
      address: Joi.string().max(200).optional(),
      city: Joi.string().max(50).optional(),
      state: Joi.string().max(50).optional(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).optional(),
      reasonForVisit: Joi.string().min(10).max(1000).required(),
      currentMedications: Joi.string().max(500).optional(),
      allergies: Joi.string().max(500).optional(),
      pastConditions: Joi.string().max(500).optional(),
      insuranceProvider: Joi.string().max(100).optional(),
      insuranceId: Joi.string().max(50).optional(),
      emergencyContact: Joi.string().max(100).optional(),
      emergencyPhone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
      appointmentDate: Joi.date().min('now').optional(),
      appointmentTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      visitType: Joi.string().max(50).optional(),
      additionalNotes: Joi.string().max(1000).optional()
    });

    const { error, value } = formspreeSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Formspree data validation failed', {
        errors: errorDetails,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Form data validation failed',
          details: errorDetails,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    
    logger.info('Formspree data validation successful', {
      patientName: value.fullName,
      email: value.email,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error validating Formspree data', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Form data validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate Calendly webhook data
 */
const validateCalendlyData = (req, res, next) => {
  try {
    const calendlySchema = Joi.object({
      event: Joi.string().valid('invitee.created', 'invitee.canceled', 'invitee.rescheduled').required(),
      payload: Joi.object({
        uuid: Joi.string().required(),
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        phone_number: Joi.string().optional(),
        created_at: Joi.date().required(),
        updated_at: Joi.date().required(),
        canceled: Joi.boolean().optional(),
        canceler_name: Joi.string().optional(),
        cancel_reason: Joi.string().optional(),
        canceled_at: Joi.date().optional(),
        uri: Joi.string().required(),
        event: Joi.object({
          uri: Joi.string().required(),
          name: Joi.string().optional(),
          start_time: Joi.date().optional(),
          end_time: Joi.date().optional()
        }).required(),
        questions_and_answers: Joi.array().items(
          Joi.object({
            question: Joi.string().required(),
            answer: Joi.string().required()
          })
        ).optional()
      }).required()
    });

    const { error, value } = calendlySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Calendly data validation failed', {
        errors: errorDetails,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Calendly data validation failed',
          details: errorDetails,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.body = value;
    
    logger.info('Calendly data validation successful', {
      event: value.event,
      patientName: value.payload.name,
      email: value.payload.email,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error validating Calendly data', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Calendly data validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate appointment data
 */
const validateAppointmentData = (req, res, next) => {
  try {
    const appointmentSchema = Joi.object({
      patientName: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^[\+]?[1-9][\d]{0,15}$/).optional(),
      appointmentDate: Joi.date().min('now').required(),
      appointmentTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      visitType: Joi.string().max(50).optional(),
      reasonForVisit: Joi.string().max(1000).optional(),
      calendlyEventId: Joi.string().optional(),
      googleCalendarEventId: Joi.string().optional(),
      notes: Joi.string().max(500).optional()
    });

    const { error, value } = appointmentSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Appointment data validation failed', {
        errors: errorDetails,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Appointment data validation failed',
          details: errorDetails,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.body = value;
    
    logger.info('Appointment data validation successful', {
      patientName: value.patientName,
      appointmentDate: value.appointmentDate,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error validating appointment data', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Appointment data validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate triage data
 */
const validateTriageData = (req, res, next) => {
  try {
    const triageSchema = Joi.object({
      patientName: Joi.string().min(2).max(100).required(),
      appointmentDate: Joi.date().optional(),
      reasonForVisit: Joi.string().min(10).max(1000).required(),
      aiSummary: Joi.string().min(20).max(2000).required(),
      urgencyLevel: Joi.string().valid('Low', 'Moderate', 'High').required(),
      riskKeywords: Joi.array().items(Joi.string()).optional(),
      recommendations: Joi.string().max(1000).required(),
      formId: Joi.string().required()
    });

    const { error, value } = triageSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Triage data validation failed', {
        errors: errorDetails,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Triage data validation failed',
          details: errorDetails,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.body = value;
    
    logger.info('Triage data validation successful', {
      patientName: value.patientName,
      urgencyLevel: value.urgencyLevel,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error validating triage data', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Triage data validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Validate email data
 */
const validateEmailData = (req, res, next) => {
  try {
    const emailSchema = Joi.object({
      to: Joi.string().email().required(),
      subject: Joi.string().min(5).max(200).required(),
      html: Joi.string().min(10).optional(),
      text: Joi.string().min(10).optional(),
      cc: Joi.string().email().optional(),
      bcc: Joi.string().email().optional()
    }).or('html', 'text');

    const { error, value } = emailSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Email data validation failed', {
        errors: errorDetails,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Email data validation failed',
          details: errorDetails,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.body = value;
    
    logger.info('Email data validation successful', {
      to: value.to,
      subject: value.subject,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('Error validating email data', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Email data validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Sanitize input data
 */
const sanitizeInput = (req, res, next) => {
  try {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Error sanitizing input', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Input sanitization error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitize string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }

  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 10000); // Limit length
}

/**
 * Validate API key
 */
const validateApiKey = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      logger.warn('API key missing', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      return res.status(401).json({
        success: false,
        error: {
          message: 'API key required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate API key format (basic validation)
    if (apiKey.length < 20) {
      logger.warn('Invalid API key format', {
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid API key format',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Store API key in request for later use
    req.apiKey = apiKey;

    next();
  } catch (error) {
    logger.error('Error validating API key', {
      error: error.message,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    return res.status(500).json({
      success: false,
      error: {
        message: 'API key validation error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  validateWebhook,
  validateFormspreeData,
  validateCalendlyData,
  validateAppointmentData,
  validateTriageData,
  validateEmailData,
  sanitizeInput,
  validateApiKey
};
