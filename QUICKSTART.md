# 🚀 Quick Start Guide - myPCP Clinic Automation System

Get your clinic automation system up and running in 15 minutes!

## 📋 Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Google account with access to Google Cloud Console
- [ ] Calendly account
- [ ] Formspree account
- [ ] Gmail account with App Password enabled

## ⚡ 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Interactive Setup
```bash
npm run setup
```
This will guide you through all the configuration steps.

### 3. Start the Server
```bash
npm start
```

### 4. Test the System
```bash
# Health check
curl http://localhost:3000/health

# Dashboard
curl http://localhost:3000/dashboard
```

## 🔧 Essential Configuration

### Google API Setup (5 minutes)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable APIs: Sheets, Gmail, Calendar
4. Create OAuth 2.0 credentials
5. Download credentials JSON

### Calendly Setup (2 minutes)
1. Go to [Calendly Integrations](https://calendly.com/integrations/api_webhooks)
2. Create webhook: `http://your-domain.com/webhook/calendly`
3. Select events: `invitee.created`, `invitee.canceled`, `invitee.rescheduled`

### Formspree Setup (2 minutes)
1. Create form at [Formspree](https://formspree.io/)
2. Add webhook: `http://your-domain.com/webhook/formspree`
3. Copy form ID and API key

## 🎯 Test Your Setup

### 1. Test Form Submission
Visit: `http://localhost:3000/public/intake-form.html`

### 2. Test Webhooks
```bash
# Test Formspree webhook
curl -X POST http://localhost:3000/webhook/formspree \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Patient",
    "email": "test@example.com",
    "dob": "1990-01-01",
    "reasonForVisit": "Test visit"
  }'
```

### 3. Test Manual Triggers
```bash
# Send reminders
curl -X POST http://localhost:3000/trigger/reminders

# Generate weekly report
curl -X POST http://localhost:3000/trigger/weekly-report
```

## 🚀 Deploy to Production

### Option 1: Railway (Recommended)
```bash
npm install -g @railway/cli
railway login
railway up
```

### Option 2: Docker
```bash
docker build -t mypcp-automation .
docker run -p 3000:3000 --env-file .env mypcp-automation
```

### Option 3: Render
1. Connect your GitHub repository
2. Add environment variables
3. Deploy automatically

## 📊 Monitor Your System

### Dashboard
Visit: `http://your-domain.com/dashboard`

### Logs
```bash
# View logs
tail -f logs/combined.log

# View errors
tail -f logs/error.log
```

## 🔍 Troubleshooting

### Common Issues

**"Google API Error"**
- Check API credentials
- Verify API quotas
- Ensure OAuth flow completed

**"Email Not Sending"**
- Verify Gmail App Password
- Check spam folders
- Validate email addresses

**"Webhook Not Working"**
- Check webhook URLs
- Verify webhook secrets
- Review server logs

### Get Help
1. Check logs in `logs/` directory
2. Review the full README.md
3. Create an issue in the repository

## 🎉 You're Ready!

Your clinic automation system is now running! The system will:

✅ Automatically process patient intake forms  
✅ Send AI-powered triage summaries to staff  
✅ Send confirmation emails to patients  
✅ Send appointment reminders  
✅ Generate weekly performance reports  
✅ Track all data in Google Sheets  

## 📈 Next Steps

1. **Customize Email Templates** - Edit templates in `services/emailService.js`
2. **Add More AI Prompts** - Customize AI analysis in `services/aiService.js`
3. **Set Up Looker Studio** - Connect to your Google Sheets for advanced analytics
4. **Configure Notifications** - Set up SMS or additional email alerts
5. **Scale Up** - Add more clinic locations or staff members

## 🆘 Need Help?

- 📖 Full documentation: `README.md`
- 🐛 Report issues: Create a GitHub issue
- 💬 Get support: Check the troubleshooting section

---

**Happy automating! Your clinic is now running on autopilot! 🏥✨**
