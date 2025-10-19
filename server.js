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
    let stats;
    if (TEST_MODE) {
      // Generate mock data for demo
      stats = {
        success: true,
        message: 'Dashboard (TEST MODE)',
        clinic: {
          name: 'myPCP Internal Medicine Clinic',
          location: 'Miami, FL',
          phone: '(305) 555-0123',
          email: 'info@bemypcp.com'
        },
        stats: {
          totalPatients: 1247,
          newPatientsThisMonth: 23,
          upcomingAppointments: 8,
          pendingIntakes: 3,
          completedAppointments: 156,
          averageWaitTime: '12 minutes',
          lastUpdated: new Date().toISOString()
        },
        recentActivity: [
          { type: 'New Patient', name: 'John Smith', time: '2 hours ago', status: 'completed' },
          { type: 'Appointment', name: 'Maria Garcia', time: '4 hours ago', status: 'confirmed' },
          { type: 'Intake Form', name: 'Robert Johnson', time: '6 hours ago', status: 'pending' },
          { type: 'Follow-up', name: 'Sarah Wilson', time: '1 day ago', status: 'scheduled' },
          { type: 'New Patient', name: 'Michael Brown', time: '2 days ago', status: 'completed' }
        ],
        upcomingAppointments: [
          { patient: 'Alice Johnson', time: '9:00 AM', type: 'Annual Physical', status: 'confirmed' },
          { patient: 'Bob Smith', time: '10:30 AM', type: 'Follow-up', status: 'confirmed' },
          { patient: 'Carol Davis', time: '2:00 PM', type: 'New Patient', status: 'pending' },
          { patient: 'David Wilson', time: '3:30 PM', type: 'Consultation', status: 'confirmed' }
        ],
        systemHealth: {
          status: 'operational',
          uptime: Math.floor(process.uptime() / 3600) + ' hours',
          lastBackup: '2 hours ago',
          apiStatus: 'healthy'
        }
      };
    } else {
      stats = await googleService.getDashboardStats();
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
            padding: 20px; 
            background: linear-gradient(135deg, #3CB6AD 0%, #2E8C83 100%);
            color: #1E1E1E;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
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
        .clinic-info {
            margin-top: 15px;
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 10px;
            padding: 25px;
            text-align: center;
            border-left: 4px solid #3CB6AD;
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-2px);
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #3CB6AD;
            margin: 0;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .main-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .card {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            border-left: 4px solid #3CB6AD;
        }
        .card h3 {
            margin: 0 0 20px 0;
            color: #2E8C83;
            font-size: 1.3em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .activity-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .activity-item:last-child {
            border-bottom: none;
        }
        .activity-info {
            flex: 1;
        }
        .activity-type {
            font-weight: 600;
            color: #2E8C83;
        }
        .activity-name {
            color: #555;
            margin-top: 2px;
        }
        .activity-time {
            color: #888;
            font-size: 0.9em;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .status-completed { background: #d4edda; color: #155724; }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-confirmed { background: #d1ecf1; color: #0c5460; }
        .status-scheduled { background: #e2e3e5; color: #383d41; }
        .appointment-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: white;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 3px solid #3CB6AD;
        }
        .appointment-info {
            flex: 1;
        }
        .appointment-patient {
            font-weight: 600;
            color: #2E8C83;
        }
        .appointment-details {
            color: #666;
            font-size: 0.9em;
            margin-top: 2px;
        }
        .appointment-time {
            font-weight: 600;
            color: #3CB6AD;
        }
        .system-status {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4CAF50;
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
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            margin: 20px 0;
        }
        .refresh-btn:hover {
            background: #2E8C83;
        }
        @media (max-width: 768px) {
            .main-grid {
                grid-template-columns: 1fr;
            }
            .stats-grid {
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Clinic Dashboard</h1>
            <div class="clinic-info">
                <h2>${data.clinic.name}</h2>
                <p>${data.clinic.location} • ${data.clinic.phone} • ${data.clinic.email}</p>
            </div>
        </div>
        
        <div class="content">
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${data.stats.totalPatients.toLocaleString()}</div>
                    <div class="stat-label">Total Patients</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.newPatientsThisMonth}</div>
                    <div class="stat-label">New This Month</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.upcomingAppointments}</div>
                    <div class="stat-label">Upcoming Appointments</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.pendingIntakes}</div>
                    <div class="stat-label">Pending Intakes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.completedAppointments}</div>
                    <div class="stat-label">Completed Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${data.stats.averageWaitTime}</div>
                    <div class="stat-label">Avg Wait Time</div>
                </div>
            </div>
            
            <div class="main-grid">
                <div class="card">
                    <h3>📋 Recent Activity</h3>
                    ${data.recentActivity.map(activity => `
                        <div class="activity-item">
                            <div class="activity-info">
                                <div class="activity-type">${activity.type}</div>
                                <div class="activity-name">${activity.name}</div>
                                <div class="activity-time">${activity.time}</div>
                            </div>
                            <span class="status-badge status-${activity.status}">${activity.status}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="card">
                    <h3>📅 Today's Appointments</h3>
                    ${data.upcomingAppointments.map(appointment => `
                        <div class="appointment-item">
                            <div class="appointment-info">
                                <div class="appointment-patient">${appointment.patient}</div>
                                <div class="appointment-details">${appointment.type}</div>
                            </div>
                            <div class="appointment-time">${appointment.time}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="card">
                <h3>⚙️ System Status</h3>
                <div class="system-status">
                    <div class="status-indicator"></div>
                    <span><strong>Status:</strong> ${data.systemHealth.status}</span>
                </div>
                <div class="system-status">
                    <div class="status-indicator"></div>
                    <span><strong>Uptime:</strong> ${data.systemHealth.uptime}</span>
                </div>
                <div class="system-status">
                    <div class="status-indicator"></div>
                    <span><strong>Last Backup:</strong> ${data.systemHealth.lastBackup}</span>
                </div>
                <div class="system-status">
                    <div class="status-indicator"></div>
                    <span><strong>API Status:</strong> ${data.systemHealth.apiStatus}</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <button class="refresh-btn" onclick="window.location.reload()">🔄 Refresh Dashboard</button>
            </div>
        </div>
        
        <div class="footer">
            <p>Last updated: ${new Date(data.stats.lastUpdated).toLocaleString()}</p>
            <p>myPCP Internal Medicine Clinic - Miami, FL</p>
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
