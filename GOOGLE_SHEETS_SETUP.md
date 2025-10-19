# Google Sheets Integration Setup Guide

## 🎯 **Quick Setup (5 minutes)**

### **Step 1: Create Google Cloud Project**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "New Project" → Name it "myPCP Clinic Automation"
3. Enable these APIs:
   - Google Sheets API
   - Gmail API
   - Google Calendar API

### **Step 2: Create Credentials**
1. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
2. Application type: "Web application"
3. Add authorized JavaScript origins:
   - `http://localhost:3001`
   - `https://mypcp-clinic-automation.onrender.com`
4. Add authorized redirect URIs:
   - `http://localhost:3001`
   - `https://mypcp-clinic-automation.onrender.com`
5. Download the JSON file

### **Step 3: Create Google Sheet**
1. Go to [Google Sheets](https://sheets.google.com)
2. Create new sheet: "myPCP Clinic Data"
3. Copy the Sheet ID from URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
4. Add these headers in Row 1:
   ```
   Timestamp | Full Name | DOB | Email | Phone | Address | Reason for Visit | 
   Current Medications | Allergies | Past Conditions | Insurance Provider | 
   Insurance ID | Emergency Contact | Emergency Phone | Form ID | Status
   ```

### **Step 4: Get Refresh Token**
Run this command in your project directory:
```bash
node scripts/get-refresh-token.js
```

### **Step 5: Add Environment Variables to Render**
Go to your Render dashboard → Environment tab → Add these variables:

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_refresh_token_here
GOOGLE_SHEET_ID=your_sheet_id_here
GMAIL_USER=your_clinic_email@gmail.com
```

### **Step 6: Test Integration**
1. Submit a test form at: https://mypcp-clinic-automation.onrender.com/patient-form
2. Check your Google Sheet - data should appear automatically
3. Check dashboard - should show "Production Mode" instead of "Test Mode"

## 🔧 **What This Enables**

### **Automatic Data Sync**
- ✅ Patient intake forms → Google Sheets
- ✅ Appointment data → Google Sheets  
- ✅ Email confirmations → Gmail
- ✅ Calendar integration → Google Calendar

### **Dashboard Features**
- ✅ Real-time patient statistics
- ✅ Appointment tracking
- ✅ Email automation
- ✅ Data backup to Google Drive

### **Email Automation**
- ✅ Welcome emails to new patients
- ✅ Appointment confirmations
- ✅ Reminder emails
- ✅ Follow-up surveys

## 🚨 **Troubleshooting**

### **"invalid_client" Error**
- Check that all environment variables are set correctly
- Verify the refresh token is valid
- Make sure APIs are enabled in Google Cloud Console

### **Sheet Not Updating**
- Verify GOOGLE_SHEET_ID is correct
- Check that the sheet is shared with your service account
- Ensure headers match the expected format

### **Email Not Sending**
- Verify GMAIL_USER is set to your clinic email
- Check that Gmail API is enabled
- Ensure the email has "Less secure app access" enabled

## 📊 **Expected Results**

After setup, your dashboard will show:
- **Mode**: Production (instead of Test Mode)
- **API Status**: Connected
- **Real patient data** from Google Sheets
- **Live appointment tracking**
- **Email automation working**

## 🆘 **Need Help?**

If you encounter issues:
1. Check the logs in Render dashboard
2. Verify all environment variables are set
3. Test the Google Sheets connection manually
4. Contact support with specific error messages

---

**🎉 Once set up, your clinic will have a fully automated patient management system!**
