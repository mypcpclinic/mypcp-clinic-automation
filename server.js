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
const DataService = require('./services/dataService');

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
            '/webhook/formspree',
            '/setup-guide'
        ]
    });
});

// OAuth callback route
app.get('/auth/google/callback', (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.status(400).send('Authorization code not provided');
    }
    
    // This will be handled by the Google Service
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>OAuth Success</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #F9F5E9; }
                .container { background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; }
                .success { color: #2E8C83; font-size: 24px; margin-bottom: 20px; }
                .btn { background: #3CB6AD; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="success">✅ OAuth Authorization Successful!</div>
                <p>You can now close this window and return to your dashboard.</p>
                <a href="/dashboard" class="btn">Go to Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// Setup guide route
app.get('/setup-guide', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const setupGuidePath = path.join(__dirname, 'GOOGLE_SHEETS_SETUP.md');
        const setupGuide = fs.readFileSync(setupGuidePath, 'utf8');
        
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Google Sheets Setup Guide - myPCP</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    margin: 0; 
                    padding: 20px;
                    background-color: #F9F5E9;
                    color: #1E1E1E;
                    line-height: 1.6;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                h1 { color: #2E8C83; border-bottom: 3px solid #3CB6AD; padding-bottom: 10px; }
                h2 { color: #2E8C83; margin-top: 30px; }
                h3 { color: #1E1E1E; }
                code { 
                    background: #f4f4f4; 
                    padding: 2px 6px; 
                    border-radius: 4px; 
                    font-family: 'Courier New', monospace;
                }
                pre { 
                    background: #f4f4f4; 
                    padding: 15px; 
                    border-radius: 8px; 
                    overflow-x: auto;
                    border-left: 4px solid #3CB6AD;
                }
                .back-btn {
                    background: #3CB6AD;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 6px;
                    display: inline-block;
                    margin-bottom: 20px;
                }
                .back-btn:hover { background: #2E8C83; }
                ul, ol { padding-left: 20px; }
                li { margin-bottom: 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <a href="/dashboard" class="back-btn">← Back to Dashboard</a>
                ${setupGuide.replace(/\n/g, '<br>').replace(/#{1,6} /g, (match) => {
                    const level = match.length - 2;
                    return `<h${level}>`;
                }).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')}
            </div>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send('Setup guide not found');
    }
});

// Initialize services with error handling
let googleService, aiService, emailService, dataService;
try {
  googleService = new GoogleService();
  aiService = new AIService();
  emailService = new EmailService();
  dataService = new DataService();
} catch (error) {
  logger.error('Error initializing services:', error);
  // Create mock services for test mode
  googleService = { addPatientIntake: () => Promise.resolve(), getDashboardStats: () => Promise.resolve({}) };
  aiService = { summarizeIntake: () => Promise.resolve('Mock summary') };
  emailService = { sendConfirmation: () => Promise.resolve(), sendReminder: () => Promise.resolve() };
  dataService = new DataService(); // Always initialize data service
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
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'myPCP Clinic Automation System',
    testMode: TEST_MODE,
    uptime: {
      seconds: Math.floor(uptime),
      minutes: Math.floor(uptime / 60),
      hours: Math.floor(uptime / 3600),
      days: Math.floor(uptime / 86400)
    },
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
    },
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform
  };

  // Return HTML dashboard if requested with Accept: text/html
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.send(generateHealthDashboard(healthData));
  } else {
    res.json(healthData);
  }
});

// Test form submission endpoint
app.post('/test-form', async (req, res) => {
  try {
    logger.info('Test form submission received', { body: req.body });
    
    // Store the form submission in real data
    const submission = await dataService.addFormSubmission(req.body);
    
    res.json({ 
      success: true, 
      message: 'Form submitted successfully!',
      receivedData: req.body,
      submissionId: submission.id,
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
    
    // Always store the form submission in real data
    const submission = await dataService.addFormSubmission(req.body);
    
    if (TEST_MODE) {
      logger.info('🧪 TEST MODE: Form submission received', { data: req.body });
      res.json({ 
        success: true, 
        message: 'Form processed successfully (TEST MODE)',
        data: req.body,
        submissionId: submission.id
      });
    } else {
      await intakeWebhook.handleFormSubmission(req.body);
      res.json({ 
        success: true, 
        message: 'Intake form processed successfully',
        submissionId: submission.id
      });
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
    // Always use real data service for dashboard
    const stats = await dataService.getDashboardStats();
    
    // Add test mode indicator if in test mode
    if (TEST_MODE) {
      stats.message = 'Dashboard (Real Data - Test Mode)';
    }

    // Return HTML dashboard if requested with Accept: text/html
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      res.send(generateDashboardHTML(stats));
    } else {
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

// HTML Generation Functions
function generateHealthDashboard(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Health - myPCP Clinic</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #3CB6AD 0%, #2E8C83 100%);
            color: #1E1E1E;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #3CB6AD 0%, #2E8C83 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .status-badge {
            display: inline-block;
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-top: 10px;
        }
        .content {
            padding: 30px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            border-left: 4px solid #3CB6AD;
        }
        .card h3 {
            margin: 0 0 15px 0;
            color: #2E8C83;
            font-size: 1.2em;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            font-weight: 500;
            color: #555;
        }
        .metric-value {
            font-weight: 600;
            color: #2E8C83;
        }
        .uptime-display {
            font-size: 1.5em;
            font-weight: bold;
            color: #3CB6AD;
            text-align: center;
            margin: 20px 0;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        .refresh-btn {
            background: #3CB6AD;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            margin: 20px 0;
        }
        .refresh-btn:hover {
            background: #2E8C83;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 System Health Monitor</h1>
            <div class="status-badge">${data.status.toUpperCase()}</div>
            <p>myPCP Clinic Automation System</p>
        </div>
        
        <div class="content">
            <div class="uptime-display">
                ⏱️ System Uptime: ${data.uptime.days}d ${data.uptime.hours}h ${data.uptime.minutes}m
            </div>
            
            <div class="grid">
                <div class="card">
                    <h3>📊 System Information</h3>
                    <div class="metric">
                        <span class="metric-label">Environment:</span>
                        <span class="metric-value">${data.environment}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Node Version:</span>
                        <span class="metric-value">${data.nodeVersion}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Platform:</span>
                        <span class="metric-value">${data.platform}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Test Mode:</span>
                        <span class="metric-value">${data.testMode ? 'Enabled' : 'Disabled'}</span>
                    </div>
                </div>
                
                <div class="card">
                    <h3>💾 Memory Usage</h3>
                    <div class="metric">
                        <span class="metric-label">RSS Memory:</span>
                        <span class="metric-value">${data.memory.rss}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Heap Total:</span>
                        <span class="metric-value">${data.memory.heapTotal}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Heap Used:</span>
                        <span class="metric-value">${data.memory.heapUsed}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">External:</span>
                        <span class="metric-value">${data.memory.external}</span>
                    </div>
                </div>
                
                <div class="card">
                    <h3>⏰ Time Information</h3>
                    <div class="metric">
                        <span class="metric-label">Current Time:</span>
                        <span class="metric-value">${new Date(data.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Uptime (Days):</span>
                        <span class="metric-value">${data.uptime.days}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Uptime (Hours):</span>
                        <span class="metric-value">${data.uptime.hours}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Uptime (Minutes):</span>
                        <span class="metric-value">${data.uptime.minutes}</span>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center;">
                <button class="refresh-btn" onclick="window.location.reload()">🔄 Refresh Status</button>
            </div>
        </div>
        
        <div class="footer">
            <p>Last updated: ${new Date(data.timestamp).toLocaleString()}</p>
            <p>myPCP Internal Medicine Clinic - Miami, FL</p>
        </div>
    </div>
</body>
</html>`;
}

function generateDashboardHTML(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clinic Dashboard - myPCP</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 0;
            background-color: #F9F5E9;
            color: #1E1E1E;
            min-height: 100vh;
        }
        .container {
            max-width: 1600px;
            margin: 0 auto;
            background: #F9F5E9;
            min-height: 100vh;
        }
        .header {
            background: white;
            color: #1E1E1E;
            padding: 15px 20px;
            border-bottom: 3px solid #3CB6AD;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 1400px;
            margin: 0 auto;
        }
        .logo-section {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .logo-image {
            height: 50px;
            width: auto;
        }
        .logo-fallback {
            height: 50px;
            width: 50px;
            background: #3CB6AD;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5em;
            color: white;
        }
        .clinic-info {
            text-align: left;
        }
        .clinic-info h1 {
            margin: 0;
            font-size: 1.6em;
            font-weight: 600;
            color: #2E8C83;
        }
        .clinic-info p {
            margin: 3px 0 0 0;
            font-size: 0.9em;
            color: #1E1E1E;
        }
        .dashboard-title {
            text-align: right;
            color: #1E1E1E;
        }
        .dashboard-title h2 {
            margin: 0;
            font-size: 1.3em;
            font-weight: 600;
            color: #2E8C83;
        }
        .dashboard-title p {
            margin: 3px 0 0 0;
            font-size: 0.85em;
            color: #1E1E1E;
        }
        .content {
            padding: 20px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            max-height: calc(100vh - 120px);
            overflow: hidden;
        }
        /* Force deployment refresh - v2 */
        .left-panel, .right-panel {
            display: flex;
            flex-direction: column;
            gap: 15px;
            height: 100%;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 15px;
        }
        .stat-card {
            background: white;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            border-left: 4px solid #3CB6AD;
            box-shadow: 0 2px 8px rgba(60, 182, 173, 0.1);
            transition: transform 0.2s ease;
        }
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(60, 182, 173, 0.15);
        }
        .stat-number {
            font-size: 1.8em;
            font-weight: bold;
            color: #2E8C83;
            margin-bottom: 4px;
        }
        .stat-label {
            color: #1E1E1E;
            font-size: 0.85em;
            font-weight: 500;
        }
        .section {
            background: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        .section h3 {
            color: #2E8C83;
            border-bottom: 2px solid #3CB6AD;
            padding-bottom: 8px;
            margin-bottom: 12px;
            font-size: 1.1em;
            font-weight: 600;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 6px;
            overflow: hidden;
            font-size: 0.85em;
            flex: 1;
        }
        .table th {
            background: #3CB6AD;
            color: white;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 0.8em;
        }
        .table td {
            padding: 8px 10px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 0.8em;
        }
        .table tr:hover {
            background: #F9F5E9;
        }
        .table tr:last-child td {
            border-bottom: none;
        }
        .table-container {
            flex: 1;
            overflow-y: auto;
            max-height: 200px;
        }
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.7em;
            font-weight: 500;
            text-transform: capitalize;
        }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-completed { background: #d4edda; color: #155724; }
        .status-confirmed { background: #cce5ff; color: #004085; }
        .status-scheduled { background: #e2e3e5; color: #383d41; }
        .chart-container {
            background: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            flex: 1;
        }
        .chart-placeholder {
            height: 120px;
            background: linear-gradient(135deg, #F9F5E9 0%, #e9ecef 100%);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            font-size: 0.9em;
            border: 2px dashed #3CB6AD;
        }
        .footer {
            background: white;
            padding: 10px 20px;
            text-align: center;
            color: #1E1E1E;
            border-top: 2px solid #3CB6AD;
            font-size: 0.8em;
        }
        .refresh-btn {
            background: #3CB6AD;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 0.8em;
            font-weight: 500;
            margin: 10px 0;
            transition: background 0.2s ease;
        }
        .refresh-btn:hover {
            background: #2E8C83;
        }
        .empty-state {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-style: italic;
            font-size: 0.85em;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px solid #e0e0e0;
            font-size: 0.8em;
        }
        .metric-row:last-child {
            border-bottom: none;
        }
        .metric-label {
            font-weight: 500;
            color: #1E1E1E;
        }
        .metric-value {
            font-weight: 600;
            color: #2E8C83;
        }
        @media (max-width: 1200px) {
            .content {
                grid-template-columns: 1fr;
                max-height: none;
            }
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: 10px;
                text-align: center;
            }
            .logo-section {
                justify-content: center;
            }
            .dashboard-title {
                text-align: center;
            }
            .clinic-info h1 {
                font-size: 1.3em;
            }
            .stats-grid {
                grid-template-columns: 1fr;
            }
            .content {
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="logo-section">
                    <img src="/logo.png" alt="myPCP Clinic Logo" class="logo-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="logo-fallback" style="display: none;">🏥</div>
                    <div class="clinic-info">
                        <h1>Internal Medicine Clinic</h1>
                        <p>Miami, FL • (305) 555-0123</p>
                    </div>
                </div>
                <div class="dashboard-title">
                    <h2>📊 Clinic Dashboard</h2>
                    <p>Real-time Analytics</p>
                </div>
            </div>
        </div>
        
        <div class="content">
            <!-- Left Panel -->
            <div class="left-panel">
                <!-- Key Metrics -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.totalPatients}</div>
                        <div class="stat-label">Total Patients</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.newPatientsThisMonth}</div>
                        <div class="stat-label">New This Month</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.upcomingAppointments}</div>
                        <div class="stat-label">Upcoming</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.pendingIntakes}</div>
                        <div class="stat-label">Pending Intakes</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.completedAppointments}</div>
                        <div class="stat-label">Completed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${data.stats.averageWaitTime}</div>
                        <div class="stat-label">Avg Wait</div>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div class="section">
                    <h3>📋 Recent Activity</h3>
                    <div class="table-container">
                        ${data.recentActivity.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Patient</th>
                                    <th>Time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.recentActivity.map(activity => `
                                    <tr>
                                        <td>${activity.type}</td>
                                        <td>${activity.name}</td>
                                        <td>${activity.time}</td>
                                        <td><span class="status-badge status-${activity.status}">${activity.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : `
                        <div class="empty-state">
                            No recent activity
                        </div>
                        `}
                    </div>
                </div>
            </div>
            
            <!-- Right Panel -->
            <div class="right-panel">
                <!-- Charts Section -->
                <div class="chart-container">
                    <h3>📈 Activity Trends</h3>
                    <div class="chart-placeholder">
                        📊 Charts with Google Sheets
                    </div>
                </div>
                
                <!-- Upcoming Appointments -->
                <div class="section">
                    <h3>📅 Upcoming Appointments</h3>
                    <div class="table-container">
                        ${data.upcomingAppointments.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th>Time</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.upcomingAppointments.map(appointment => `
                                    <tr>
                                        <td>${appointment.patient}</td>
                                        <td>${appointment.time}</td>
                                        <td>${appointment.type}</td>
                                        <td><span class="status-badge status-${appointment.status}">${appointment.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : `
                        <div class="empty-state">
                            No upcoming appointments
                        </div>
                        `}
                    </div>
                </div>
                
                <!-- System Health -->
                <div class="section">
                    <h3>⚙️ System Health</h3>
                    <div class="metric-row">
                        <span class="metric-label">Status</span>
                        <span class="metric-value">${data.systemHealth.status}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Uptime</span>
                        <span class="metric-value">${data.systemHealth.uptime}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Last Backup</span>
                        <span class="metric-value">${data.systemHealth.lastBackup}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">API Status</span>
                        <span class="metric-value">${data.systemHealth.apiStatus}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Mode</span>
                        <span class="metric-value">${data.message.includes('TEST MODE') ? 'Test Mode' : 'Production'}</span>
                    </div>
                    ${data.message.includes('TEST MODE') ? `
                    <div class="metric-row" style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-top: 10px;">
                        <span class="metric-label" style="color: #856404; font-weight: 600;">🔗 Setup Google Sheets</span>
                        <span class="metric-value" style="color: #856404;">
                            <a href="/setup-guide" style="color: #2E8C83; text-decoration: none;">View Setup Guide</a>
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
        
        <div class="footer">
            <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
            <p>Last updated: ${new Date(data.stats.lastUpdated).toLocaleString()}</p>
            <p style="margin-top: 10px; font-size: 0.9em; color: #999;">
                myPCP Clinic Automation System | 
                <a href="/" style="color: #3CB6AD; text-decoration: none;">Patient Form</a> | 
                <a href="/health" style="color: #3CB6AD; text-decoration: none;">System Health</a>
            </p>
        </div>
    </div>
</body>
</html>`;
}

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
