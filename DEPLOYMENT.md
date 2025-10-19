# 🚀 Deploy Your myPCP Clinic Automation System Online

This guide will help you deploy your clinic automation system to the cloud so it can be accessed from anywhere.

## 🌐 **Deployment Options**

### **Option 1: Railway (Recommended - Easiest)**

Railway is perfect for Node.js apps and has a generous free tier.

#### **Step 1: Create Railway Account**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (recommended)
3. Connect your GitHub account

#### **Step 2: Deploy from GitHub**
1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - myPCP Clinic Automation System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mypcp-automation.git
   git push -u origin main
   ```

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will automatically detect it's a Node.js app

#### **Step 3: Configure Environment Variables**
In Railway dashboard, go to your project → Variables tab and add:

```
CLINIC_NAME=myPCP Internal Medicine Clinic
CLINIC_EMAIL=info@bemypcp.com
CLINIC_PHONE=(305) 555-0123
CLINIC_ADDRESS=123 Medical Plaza, Miami, FL 33101
CLINIC_WEBSITE=https://your-domain.com
PORT=3000
NODE_ENV=production
WEBHOOK_SECRET=your_secure_webhook_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_google_refresh_token
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_CALENDAR_ID=your_google_calendar_id
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
CALENDLY_API_TOKEN=your_calendly_token
CALENDLY_WEBHOOK_SECRET=your_calendly_webhook_secret
FORMSPREE_FORM_ID=your_formspree_form_id
FORMSPREE_API_KEY=your_formspree_api_key
OPENAI_API_KEY=your_openai_api_key
AI_MODEL=gpt-3.5-turbo
USE_LOCAL_AI=false
TRIAGE_EMAIL=triage@bemypcp.com
ADMIN_EMAIL=admin@bemypcp.com
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_32_character_encryption_key
REMINDER_HOURS_BEFORE=48
REPORT_DAY_OF_WEEK=1
REPORT_TIME=09:00
```

#### **Step 4: Get Your Live URL**
Railway will give you a URL like: `https://your-app-name.railway.app`

---

### **Option 2: Render (Also Great)**

#### **Step 1: Create Render Account**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

#### **Step 2: Deploy**
1. **Push to GitHub** (same as Railway)
2. **Create Web Service:**
   - Go to Render dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Environment:** Node

#### **Step 3: Environment Variables**
Add the same environment variables as Railway in Render's Environment tab.

---

### **Option 3: Heroku (Classic)**

#### **Step 1: Install Heroku CLI**
```bash
# On macOS
brew tap heroku/brew && brew install heroku

# Or download from https://devcenter.heroku.com/articles/heroku-cli
```

#### **Step 2: Deploy**
```bash
# Login to Heroku
heroku login

# Create app
heroku create mypcp-clinic-automation

# Set environment variables
heroku config:set CLINIC_NAME="myPCP Internal Medicine Clinic"
heroku config:set CLINIC_EMAIL="info@bemypcp.com"
# ... (add all your environment variables)

# Deploy
git push heroku main
```

---

### **Option 4: Vercel (For Static + API)**

#### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

#### **Step 2: Deploy**
```bash
vercel
```

---

## 🔧 **Pre-Deployment Checklist**

### **1. Update Webhook URLs**
After deployment, update your webhook URLs:

**Calendly Webhooks:**
- URL: `https://your-app.railway.app/webhook/calendly`

**Formspree Webhooks:**
- URL: `https://your-app.railway.app/webhook/formspree`

### **2. Update Google OAuth**
Update your Google OAuth redirect URI:
- `https://your-app.railway.app/auth/google/callback`

### **3. Test Your Deployment**
```bash
# Test health endpoint
curl https://your-app.railway.app/health

# Test patient form
# Open: https://your-app.railway.app/intake-form.html
```

---

## 📱 **Custom Domain (Optional)**

### **Railway Custom Domain**
1. Go to Railway project → Settings → Domains
2. Add your custom domain (e.g., `clinic.bemypcp.com`)
3. Update DNS records as instructed
4. Update environment variables with new domain

### **SSL Certificate**
Railway automatically provides SSL certificates for custom domains.

---

## 🔒 **Security Considerations**

### **Environment Variables**
- Never commit `.env` files to GitHub
- Use strong, unique secrets for production
- Rotate API keys regularly

### **HTTPS**
- All platforms provide HTTPS by default
- Your form will be secure for patient data

### **Rate Limiting**
- The system includes built-in rate limiting
- Consider upgrading if you expect high traffic

---

## 📊 **Monitoring & Maintenance**

### **Logs**
- Railway: View logs in dashboard
- Render: View logs in dashboard
- Heroku: `heroku logs --tail`

### **Uptime Monitoring**
Consider setting up uptime monitoring:
- [UptimeRobot](https://uptimerobot.com)
- [Pingdom](https://pingdom.com)

### **Backups**
- Google Sheets data is automatically backed up
- Consider regular database backups if you add a database

---

## 🎯 **Quick Start (Railway)**

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "myPCP Clinic Automation System"
   git remote add origin https://github.com/YOUR_USERNAME/mypcp-automation.git
   git push -u origin main
   ```

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub
   - Select your repository
   - Add environment variables
   - Deploy!

3. **Update Webhooks:**
   - Calendly: `https://your-app.railway.app/webhook/calendly`
   - Formspree: `https://your-app.railway.app/webhook/formspree`

4. **Test:**
   - Health: `https://your-app.railway.app/health`
   - Form: `https://your-app.railway.app/intake-form.html`

---

## 🆘 **Troubleshooting**

### **Common Issues**

**"Application Error"**
- Check environment variables are set correctly
- Check logs for specific error messages

**"Webhook Not Working"**
- Verify webhook URLs are correct
- Check webhook secrets match

**"Google API Errors"**
- Verify OAuth credentials
- Check API quotas

**"Email Not Sending"**
- Verify Gmail App Password
- Check spam folders

### **Getting Help**
- Check platform-specific documentation
- Review application logs
- Test endpoints individually

---

**Your myPCP clinic automation system will be live and accessible from anywhere once deployed!** 🏥✨
