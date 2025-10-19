const { google } = require('googleapis');
const readline = require('readline');

// You'll need to replace these with your actual values from Google Cloud Console
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET_HERE';
const REDIRECT_URI = 'http://localhost:3001/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function getRefreshToken() {
  try {
    // Generate the URL for authorization
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/calendar'
      ],
    });

    console.log('🔑 Google OAuth Setup');
    console.log('====================');
    console.log('');
    console.log('1. Open this URL in your browser:');
    console.log(authUrl);
    console.log('');
    console.log('2. Sign in with your Google account');
    console.log('3. Grant permissions to the app');
    console.log('4. Copy the authorization code from the URL');
    console.log('');

    rl.question('Enter the authorization code: ', async (code) => {
      try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('');
        console.log('✅ Success! Here are your tokens:');
        console.log('================================');
        console.log('');
        console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('');
        console.log('📋 Copy this value to your Render environment variables');
        console.log('');
        
        rl.close();
      } catch (error) {
        console.error('❌ Error getting tokens:', error.message);
        rl.close();
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
  }
}

console.log('⚠️  IMPORTANT: Update CLIENT_ID and CLIENT_SECRET in this script first!');
console.log('Edit scripts/get-refresh-token.js and replace YOUR_CLIENT_ID_HERE and YOUR_CLIENT_SECRET_HERE');
console.log('');

getRefreshToken();
