const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'setup' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Helper function to ask yes/no questions
function askYesNo(question) {
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

// Main setup function
async function setup() {
  try {
    console.log('\n🏥 myPCP Clinic Automation System Setup');
    console.log('=====================================\n');

    // Check if .env file exists
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const overwrite = await askYesNo('.env file already exists. Do you want to overwrite it?');
      if (!overwrite) {
        console.log('Setup cancelled.');
        rl.close();
        return;
      }
    }

    // Collect configuration
    const config = await collectConfiguration();
    
    // Create .env file
    await createEnvFile(config);
    
    // Setup Google Sheets
    await setupGoogleSheets(config);
    
    // Setup webhooks
    await setupWebhooks(config);
    
    // Create directories
    await createDirectories();
    
    // Generate form HTML
    await generateFormHTML();
    
    console.log('\n✅ Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start the server: npm start');
    console.log('3. Test the system with the provided endpoints');
    console.log('4. Configure your Calendly and Formspree webhooks');
    
  } catch (error) {
    logger.error('Setup failed', { error: error.message });
    console.error('\n❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Collect configuration from user
async function collectConfiguration() {
  console.log('📋 Configuration Setup');
  console.log('----------------------\n');

  const config = {};

  // Clinic Information
  console.log('🏥 Clinic Information:');
  config.CLINIC_NAME = await askQuestion('Clinic Name: ') || 'myPCP Internal Medicine Clinic';
  config.CLINIC_EMAIL = await askQuestion('Clinic Email: ') || 'info@bemypcp.com';
  config.CLINIC_PHONE = await askQuestion('Clinic Phone: ') || '(305) 555-0123';
  config.CLINIC_ADDRESS = await askQuestion('Clinic Address: ') || '123 Medical Plaza, Miami, FL 33101';
  config.CLINIC_WEBSITE = await askQuestion('Clinic Website: ') || 'https://bemypcp.com';

  // Server Configuration
  console.log('\n🖥️  Server Configuration:');
  config.PORT = await askQuestion('Server Port (default: 3000): ') || '3000';
  config.NODE_ENV = await askQuestion('Environment (development/production): ') || 'development';
  config.WEBHOOK_SECRET = await askQuestion('Webhook Secret (generate random): ') || generateRandomString(32);

  // Google API Configuration
  console.log('\n📊 Google API Configuration:');
  console.log('You need to create a Google Cloud Project and enable the following APIs:');
  console.log('- Google Sheets API');
  console.log('- Gmail API');
  console.log('- Google Calendar API');
  console.log('\nVisit: https://console.cloud.google.com/');
  
  config.GOOGLE_CLIENT_ID = await askQuestion('Google Client ID: ');
  config.GOOGLE_CLIENT_SECRET = await askQuestion('Google Client Secret: ');
  config.GOOGLE_REDIRECT_URI = await askQuestion('Google Redirect URI (default: http://localhost:3000/auth/google/callback): ') || 'http://localhost:3000/auth/google/callback';
  config.GOOGLE_REFRESH_TOKEN = await askQuestion('Google Refresh Token (will be generated): ') || '';
  config.GOOGLE_SHEET_ID = await askQuestion('Google Sheet ID: ');
  config.GOOGLE_CALENDAR_ID = await askQuestion('Google Calendar ID: ');

  // Gmail Configuration
  console.log('\n📧 Gmail Configuration:');
  config.GMAIL_USER = await askQuestion('Gmail Address: ');
  config.GMAIL_APP_PASSWORD = await askQuestion('Gmail App Password: ');

  // Calendly Configuration
  console.log('\n📅 Calendly Configuration:');
  console.log('Get your API token from: https://calendly.com/integrations/api_webhooks');
  config.CALENDLY_API_TOKEN = await askQuestion('Calendly API Token: ');
  config.CALENDLY_WEBHOOK_SECRET = await askQuestion('Calendly Webhook Secret: ') || generateRandomString(32);

  // Formspree Configuration
  console.log('\n📝 Formspree Configuration:');
  console.log('Create a form at: https://formspree.io/');
  config.FORMSPREE_FORM_ID = await askQuestion('Formspree Form ID: ');
  config.FORMSPREE_API_KEY = await askQuestion('Formspree API Key: ');

  // AI Configuration
  console.log('\n🤖 AI Configuration:');
  const useLocalAI = await askYesNo('Do you want to use local AI (LM Studio)?');
  config.USE_LOCAL_AI = useLocalAI ? 'true' : 'false';
  
  if (useLocalAI) {
    config.LOCAL_AI_URL = await askQuestion('Local AI URL (default: http://localhost:1234/v1/chat/completions): ') || 'http://localhost:1234/v1/chat/completions';
    config.OPENAI_API_KEY = '';
    config.AI_MODEL = 'llama-3';
  } else {
    config.OPENAI_API_KEY = await askQuestion('OpenAI API Key: ');
    config.AI_MODEL = await askQuestion('AI Model (default: gpt-3.5-turbo): ') || 'gpt-3.5-turbo';
    config.LOCAL_AI_URL = '';
  }

  // Email Templates
  console.log('\n📬 Email Configuration:');
  config.TRIAGE_EMAIL = await askQuestion('Triage Email: ') || 'triage@bemypcp.com';
  config.ADMIN_EMAIL = await askQuestion('Admin Email: ') || 'admin@bemypcp.com';

  // Security
  console.log('\n🔒 Security Configuration:');
  config.JWT_SECRET = await askQuestion('JWT Secret (generate random): ') || generateRandomString(32);
  config.ENCRYPTION_KEY = await askQuestion('Encryption Key (32 characters): ') || generateRandomString(32);

  // Automation Settings
  console.log('\n⏰ Automation Settings:');
  config.REMINDER_HOURS_BEFORE = await askQuestion('Reminder Hours Before Appointment (default: 48): ') || '48';
  config.REPORT_DAY_OF_WEEK = await askQuestion('Weekly Report Day (1=Monday, default: 1): ') || '1';
  config.REPORT_TIME = await askQuestion('Weekly Report Time (default: 09:00): ') || '09:00';

  return config;
}

// Create .env file
async function createEnvFile(config) {
  console.log('\n📝 Creating .env file...');
  
  const envContent = Object.entries(config)
    .map(([key, value]) => `${key}="${value}"`)
    .join('\n');

  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ .env file created successfully');
}

// Setup Google Sheets
async function setupGoogleSheets(config) {
  console.log('\n📊 Setting up Google Sheets...');
  
  try {
    // This would typically involve OAuth flow
    // For now, we'll just log the instructions
    console.log('📋 Google Sheets Setup Instructions:');
    console.log('1. Create a new Google Sheet');
    console.log('2. Share it with your service account email');
    console.log('3. Copy the Sheet ID from the URL');
    console.log('4. The system will automatically create the required sheets');
    
    console.log('✅ Google Sheets setup instructions provided');
  } catch (error) {
    console.log('⚠️  Google Sheets setup will need to be completed manually');
    logger.error('Google Sheets setup error', { error: error.message });
  }
}

// Setup webhooks
async function setupWebhooks(config) {
  console.log('\n🔗 Webhook Setup Instructions:');
  
  console.log('\n📅 Calendly Webhooks:');
  console.log('1. Go to https://calendly.com/integrations/api_webhooks');
  console.log('2. Create a new webhook with URL: http://your-domain.com/webhook/calendly');
  console.log('3. Select events: invitee.created, invitee.canceled, invitee.rescheduled');
  
  console.log('\n📝 Formspree Webhooks:');
  console.log('1. Go to your Formspree form settings');
  console.log('2. Add webhook URL: http://your-domain.com/webhook/formspree');
  console.log('3. Test the webhook connection');
  
  console.log('✅ Webhook setup instructions provided');
}

// Create necessary directories
async function createDirectories() {
  console.log('\n📁 Creating directories...');
  
  const directories = [
    'logs',
    'public',
    'templates',
    'uploads'
  ];

  for (const dir of directories) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } else {
      console.log(`📁 Directory already exists: ${dir}`);
    }
  }
}

// Generate form HTML
async function generateFormHTML() {
  console.log('\n📝 Generating patient intake form...');
  
  try {
    const FormspreeService = require('../services/formspreeService');
    const formspreeService = new FormspreeService();
    
    const formHTML = formspreeService.generateFormHTML();
    
    const formPath = path.join(__dirname, '..', 'public', 'intake-form.html');
    fs.writeFileSync(formPath, formHTML);
    
    console.log('✅ Patient intake form generated at: public/intake-form.html');
  } catch (error) {
    console.log('⚠️  Could not generate form HTML automatically');
    logger.error('Form HTML generation error', { error: error.message });
  }
}

// Generate random string
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Run setup if called directly
if (require.main === module) {
  setup().catch(console.error);
}

module.exports = { setup };
