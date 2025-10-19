# 🔧 Service Account Setup Guide

## ✅ **What You Need to Do**

### **Step 1: Share Your Google Sheet**
1. **Open your Google Sheet:** https://docs.google.com/spreadsheets/d/1jnIHeJaswP4YZh4c41V4VwJlDFjNNZW9ALyB-rVV_hg/edit
2. **Click "Share" button** (top right)
3. **Add this email:** `mypcp-clinic-automation@mypcp-automation.iam.gserviceaccount.com`
4. **Give it "Editor" permissions**
5. **Click "Send"**

### **Step 2: Get Your Service Account Private Key**
1. **Go to Google Cloud Console:** https://console.cloud.google.com/
2. **Select your project:** mypcp-automation
3. **Go to:** IAM & Admin → Service Accounts
4. **Click on:** mypcp-clinic-automation@mypcp-automation.iam.gserviceaccount.com
5. **Go to "Keys" tab**
6. **Click "Add Key" → "Create new key" → "JSON"**
7. **Download the JSON file**

### **Step 3: Extract the Private Key**
1. **Open the downloaded JSON file**
2. **Find the "private_key" field** (it's a long string starting with "-----BEGIN PRIVATE KEY-----")
3. **Copy the entire private key** (including the BEGIN and END lines)
4. **Replace all `\n` with `\\n`** (escape the newlines)

### **Step 4: Add Environment Variables to Render**
1. **Go to your Render dashboard**
2. **Click on your service:** mypcp-clinic-automation
3. **Go to "Environment" tab**
4. **Add these variables:**

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=mypcp-clinic-automation@mypcp-automation.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----
GOOGLE_SHEET_ID=1jnIHeJaswP4YZh4c41V4VwJlDFjNNZW9ALyB-rVV_hg
GMAIL_USER=mypcpclinic@gmail.com
```

### **Step 5: Deploy and Test**
1. **Click "Save Changes" in Render**
2. **Your app will automatically redeploy**
3. **Test your patient form:** https://mypcp-clinic-automation.onrender.com/patient-form
4. **Check your dashboard:** https://mypcp-clinic-automation.onrender.com/dashboard

## 🎯 **What Will Happen After Setup**

✅ **Patient forms will automatically sync to Google Sheets**  
✅ **Email confirmations will be sent**  
✅ **Dashboard will show real data instead of test data**  
✅ **System will switch from "Test Mode" to "Production Mode"**  
✅ **No more authentication errors in logs**

## 🚨 **Important Notes**

- **Keep your private key secure** - never share it publicly
- **The private key must have escaped newlines** (`\\n` instead of `\n`)
- **Make sure the service account has Editor access to your Google Sheet**
- **Your system will work immediately after adding the environment variables**

## 🔍 **Troubleshooting**

**If you get errors:**
1. **Check that the private key is properly escaped** (all `\n` should be `\\n`)
2. **Verify the service account email is correct**
3. **Make sure the Google Sheet is shared with the service account**
4. **Check Render logs for specific error messages**

**Need help?** The system will show detailed error messages in the Render logs if something goes wrong.

---

## 🎉 **You're Almost Done!**

Once you complete these steps, your myPCP Clinic Automation System will be fully functional with Google Sheets integration! 🚀
