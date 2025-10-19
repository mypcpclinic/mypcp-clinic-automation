const fs = require('fs');
const path = require('path');

console.log('🔧 Service Account Setup Helper');
console.log('================================\n');

console.log('To complete the Google Sheets integration, you need to:');
console.log('\n1. Download your Service Account JSON file from Google Cloud Console');
console.log('2. Extract the private_key and client_email from the JSON file');
console.log('3. Add these environment variables to Render:\n');

console.log('Environment Variables to add to Render:');
console.log('----------------------------------------');
console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL=mypcp-clinic-automation@mypcp-automation.iam.gserviceaccount.com');
console.log('GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----');
console.log('GOOGLE_SHEET_ID=1jnIHeJaswP4YZh4c41V4VwJlDFjNNZW9ALyB-rVV_hg');
console.log('GMAIL_USER=mypcpclinic@gmail.com\n');

console.log('📋 Instructions:');
console.log('1. Go to Google Cloud Console → IAM & Admin → Service Accounts');
console.log('2. Click on your service account: mypcp-clinic-automation@mypcp-automation.iam.gserviceaccount.com');
console.log('3. Go to "Keys" tab → "Add Key" → "Create new key" → "JSON"');
console.log('4. Download the JSON file');
console.log('5. Open the JSON file and copy the "private_key" value');
console.log('6. Replace \\n with \\\\n in the private key (escape the newlines)');
console.log('7. Add the environment variables to Render\n');

console.log('✅ Once you add these environment variables to Render, your system will automatically connect to Google Sheets!');
console.log('\n🎯 Your system will then:');
console.log('- Automatically sync patient forms to Google Sheets');
console.log('- Send email confirmations');
console.log('- Show real data in the dashboard');
console.log('- Switch from "Test Mode" to "Production Mode"');
