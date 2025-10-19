# Deploy to Vercel

## Prerequisites
1. Install Vercel CLI: `npm i -g vercel`
2. Have a Vercel account (free tier available)

## Deployment Steps

### 1. Login to Vercel
```bash
vercel login
```

### 2. Deploy the Project
```bash
vercel
```

### 3. Set Environment Variables
After deployment, set your environment variables in the Vercel dashboard:

**Required Environment Variables:**
- `CLINIC_NAME` = "myPCP Internal Medicine Clinic"
- `CLINIC_ADDRESS` = "123 Medical Plaza, Miami, FL 33101"
- `CLINIC_PHONE` = "(305) 555-0123"
- `CLINIC_EMAIL` = "info@bemypcp.com"
- `CLINIC_WEBSITE` = "https://bemypcp.com"
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` = "mypcp-clinic-automation@mypcp-automation.iam.gserviceaccount.com"
- `GOOGLE_PRIVATE_KEY` = "-----BEGIN PRIVATE KEY-----\n[YOUR_PRIVATE_KEY]\n-----END PRIVATE KEY-----\n"
- `GOOGLE_SHEET_ID` = "1jnIHeJaswP4YZh4c41V4VwJlDFjNNZW9ALyB-rVV_hg"
- `GMAIL_USER` = "mypcpclinic@gmail.com"
- `NODE_ENV` = "production"

**Important:** Remove `DISABLE_GOOGLE_APIS=true` if it exists!

### 4. Redeploy After Setting Environment Variables
```bash
vercel --prod
```

### 5. Custom Domain (Optional)
You can set up a custom domain in the Vercel dashboard under Project Settings > Domains.

## Benefits of Vercel over Render:
- ✅ Faster deployments
- ✅ Better performance with global CDN
- ✅ Automatic HTTPS
- ✅ Better developer experience
- ✅ Free tier with generous limits
- ✅ Automatic scaling
- ✅ Better monitoring and analytics

## Testing Your Deployment
1. Visit your Vercel URL (provided after deployment)
2. Test the health endpoint: `https://your-app.vercel.app/health`
3. Test the dashboard: `https://your-app.vercel.app/dashboard`
4. Test the patient form: `https://your-app.vercel.app/test-form`
