# 🔑 Setup API Credentials for myPCP Clinic Automation

The system is currently showing authentication errors because the API credentials haven't been configured yet. Here's how to fix them:

## 🚨 **Current Issues**
- ❌ Google API authentication errors (`invalid_client`)
- ❌ Gmail authentication errors (`BadCredentials`)
- ❌ Patient form 404 error (now fixed)

## 🔧 **Quick Fixes**

### **1. Create a .env file with your credentials**

```bash
# Copy the example file
cp env.example .env
```

Then edit `.env` with your actual credentials:

```env
# Clinic Information
CLINIC_NAME=myPCP Internal Medicine Clinic
CLINIC_EMAIL=info@bemypcp.com
CLINIC_PHONE=(305) 555-0123
CLINIC_ADDRESS=123 Medical Plaza, Miami, FL 33101
CLINIC_WEBSITE=https://bemypcp.com

# Server Configuration
PORT=3001
NODE_ENV=development
WEBHOOK_SECRET=your_secure_webhook_secret_here

# Google API Credentials (REQUIRED)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_google_refresh_token_here
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_CALENDAR_ID=your_google_calendar_id_here

# Gmail Configuration (REQUIRED)
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password_here

# External Services
CALENDLY_API_TOKEN=your_calendly_token_here
CALENDLY_WEBHOOK_SECRET=your_calendly_webhook_secret_here
FORMSPREE_FORM_ID=your_formspree_form_id_here
FORMSPREE_API_KEY=your_formspree_api_key_here

# AI Service
OPENAI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-3.5-turbo
USE_LOCAL_AI=false

# Email Configuration
TRIAGE_EMAIL=triage@bemypcp.com
ADMIN_EMAIL=admin@bemypcp.com

# Security
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_32_character_encryption_key_here

# Automation Settings
REMINDER_HOURS_BEFORE=48
REPORT_DAY_OF_WEEK=1
REPORT_TIME=09:00
```

---

## 🔑 **How to Get Google API Credentials**

### **Step 1: Google Cloud Console**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable these APIs:
   - Google Sheets API
   - Gmail API
   - Google Calendar API

### **Step 2: Create OAuth Credentials**
1. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
2. Application type: "Web application"
3. Authorized redirect URIs:
   - `http://localhost:3001/auth/google/callback`
   - `https://your-domain.com/auth/google/callback` (for production)
4. Copy the Client ID and Client Secret

### **Step 3: Get Refresh Token**
Run this command to get your refresh token:
```bash
node scripts/setup.js
```

### **Step 4: Create Google Sheet**
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new sheet named "myPCP Patient Data"
3. Copy the sheet ID from the URL
4. Share the sheet with your Google account

### **Step 5: Create Google Calendar**
1. Go to [Google Calendar](https://calendar.google.com)
2. Create a new calendar for your clinic
3. Copy the calendar ID from settings

---

## 📧 **How to Get Gmail App Password**

### **Step 1: Enable 2-Factor Authentication**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification

### **Step 2: Generate App Password**
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Other (custom name)"
3. Enter "myPCP Clinic Automation"
4. Copy the 16-character password

---

## 🎯 **Quick Test Setup (Minimal)**

For testing purposes, you can use these minimal settings:

```env
# Minimal test configuration
CLINIC_NAME=myPCP Test Clinic
CLINIC_EMAIL=test@example.com
PORT=3001
NODE_ENV=development
WEBHOOK_SECRET=test_secret_123

# Disable external services for testing
USE_LOCAL_AI=true
DISABLE_GOOGLE_APIS=true
DISABLE_EMAIL_SERVICE=true
```

---

## 🚀 **After Setting Up Credentials**

1. **Restart the server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm start
   ```

2. **Test the endpoints:**
   ```bash
   # Test health
   curl http://localhost:3001/health
   
   # Test patient form
   open http://localhost:3001/intake-form.html
   ```

3. **Check logs for errors:**
   - Should see fewer authentication errors
   - Form should load properly

---

## 🆘 **Still Having Issues?**

### **Common Problems:**

**"invalid_client" errors:**
- Check Google Client ID and Secret are correct
- Verify redirect URI matches exactly
- Make sure APIs are enabled in Google Cloud Console

**"BadCredentials" for Gmail:**
- Use App Password, not regular password
- Make sure 2FA is enabled
- Check Gmail username is correct

**Form still not loading:**
- Check server is running on correct port
- Verify static files are being served
- Check browser console for errors

### **Need Help?**
- Check the logs in your terminal
- Verify all environment variables are set
- Test each service individually

---

**Once credentials are set up, your system will work perfectly!** 🎉
