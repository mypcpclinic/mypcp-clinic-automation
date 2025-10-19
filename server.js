const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cron = require('node-cron');
const winston = require('winston');
const path = require('path');

// Load environment variables
dotenv.config();

// Import services
const GoogleService = require('./services/googleService');
const AIService = require('./services/aiService');
const EmailService = require('./services/emailService');
const CalendlyService = require('./services/calendlyService');
const FormspreeService = require('./services/formspreeService');

// Import automation modules
const IntakeWebhook = require('./automations/intakeWebhook');
const ReminderScheduler = require('./automations/reminderScheduler');
const WeeklyReport = require('./automations/weeklyReport');

// Import middleware
const { errorHandler, requestLogger } = require('./middleware/errorHandler');
const { validateWebhook } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'clinic-automation' },
  transports: [
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || './logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || './logs/combined.log' 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve static files
app.use(express.static('public'));

// Redirect /public/intake-form.html to /intake-form.html
app.get('/public/intake-form.html', (req, res) => {
    res.redirect('/intake-form.html');
});

// Serve patient form directly
app.get('/patient-form', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'intake-form.html'));
});

// Redirect root to patient form
app.get('/', (req, res) => {
    res.redirect('/patient-form');
});

// Debug route to check if server is working
app.get('/debug', (req, res) => {
    res.json({
        status: 'working',
        testMode: TEST_MODE,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        routes: [
            '/',
            '/health',
            '/dashboard',
            '/patient-form',
            '/test-form',
            '/webhook/formspree'
        ]
    });
});

// Initialize services with error handling
let googleService, aiService, emailService;
try {
  googleService = new GoogleService();
  aiService = new AIService();
  emailService = new EmailService();
} catch (error) {
  logger.error('Error initializing services:', error);
  // Create mock services for test mode
  googleService = { addPatientIntake: () => Promise.resolve(), getDashboardStats: () => Promise.resolve({}) };
  aiService = { summarizeIntake: () => Promise.resolve('Mock summary') };
  emailService = { sendConfirmation: () => Promise.resolve(), sendReminder: () => Promise.resolve() };
}

// Test mode - works without external APIs
// Enable test mode if Google APIs are disabled or credentials are missing
const TEST_MODE = process.env.DISABLE_GOOGLE_APIS === 'true' || !process.env.GOOGLE_CLIENT_ID;
let calendlyService, formspreeService;
try {
  calendlyService = new CalendlyService();
  formspreeService = new FormspreeService();
} catch (error) {
  logger.error('Error initializing additional services:', error);
  calendlyService = { getUpcomingEvents: () => Promise.resolve([]) };
  formspreeService = { processWebhook: () => Promise.resolve() };
}

// Initialize automation modules with error handling
let intakeWebhook, reminderScheduler, weeklyReport;
try {
  intakeWebhook = new IntakeWebhook(googleService, aiService, emailService);
  reminderScheduler = new ReminderScheduler(googleService, emailService);
  weeklyReport = new WeeklyReport(googleService, aiService, emailService);
} catch (error) {
  logger.error('Error initializing automation modules:', error);
  // Create mock automation modules
  intakeWebhook = { handleFormSubmission: () => Promise.resolve() };
  reminderScheduler = { sendReminders: () => Promise.resolve() };
  weeklyReport = { generateReport: () => Promise.resolve() };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'myPCP Clinic Automation System',
    testMode: TEST_MODE
  });
});

// Test form submission endpoint
app.post('/test-form', async (req, res) => {
  try {
    logger.info('Test form submission received', { body: req.body });
    res.json({ 
      success: true, 
      message: 'Test form submitted successfully!',
      receivedData: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error processing test form', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook endpoints
app.post('/webhook/formspree', validateWebhook, async (req, res) => {
  try {
    logger.info('Formspree webhook received', { body: req.body });
    
    if (TEST_MODE) {
      logger.info('🧪 TEST MODE: Form submission received', { data: req.body });
      res.json({ 
        success: true, 
        message: 'Form processed successfully (TEST MODE)',
        data: req.body 
      });
    } else {
      await intakeWebhook.handleFormSubmission(req.body);
      res.json({ success: true, message: 'Intake form processed successfully' });
    }
  } catch (error) {
    logger.error('Error processing Formspree webhook', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/webhook/calendly', validateWebhook, async (req, res) => {
  try {
    logger.info('Calendly webhook received', { body: req.body });
    await calendlyService.handleBookingEvent(req.body);
    res.json({ success: true, message: 'Calendly event processed successfully' });
  } catch (error) {
    logger.error('Error processing Calendly webhook', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual trigger endpoints for testing
app.post('/trigger/reminders', async (req, res) => {
  try {
    await reminderScheduler.sendReminders();
    res.json({ success: true, message: 'Reminders sent successfully' });
  } catch (error) {
    logger.error('Error sending reminders', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/trigger/weekly-report', async (req, res) => {
  try {
    await weeklyReport.generateWeeklyReport();
    res.json({ success: true, message: 'Weekly report generated successfully' });
  } catch (error) {
    logger.error('Error generating weekly report', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Dashboard endpoint
app.get('/dashboard', async (req, res) => {
  try {
    if (TEST_MODE) {
      res.json({
        success: true,
        message: 'Dashboard (TEST MODE)',
        stats: {
          totalPatients: 0,
          upcomingAppointments: 0,
          pendingIntakes: 0,
          lastUpdated: new Date().toISOString()
        }
      });
    } else {
      const stats = await googleService.getDashboardStats();
      res.json(stats);
    }
  } catch (error) {
    logger.error('Error fetching dashboard stats', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduled jobs
// Run reminder check every hour
cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Running scheduled reminder check');
    await reminderScheduler.sendReminders();
  } catch (error) {
    logger.error('Error in scheduled reminder check', { error: error.message });
  }
});

// Run weekly report every Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  try {
    logger.info('Running scheduled weekly report');
    await weeklyReport.generateWeeklyReport();
  } catch (error) {
    logger.error('Error in scheduled weekly report', { error: error.message });
  }
});

// Catch-all route for debugging
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      '/',
      '/health',
      '/dashboard',
      '/patient-form',
      '/test-form',
      '/webhook/formspree',
      '/debug'
    ],
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`myPCP Clinic Automation System running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
