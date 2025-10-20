# Database Setup Guide

## MongoDB Atlas Setup (Free Cloud Database)

### Step 1: Create MongoDB Atlas Account
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Click "Try Free" and create an account
3. Choose the FREE tier (M0 Sandbox)

### Step 2: Create a Cluster
1. Click "Build a Database"
2. Choose "FREE" tier (M0 Sandbox)
3. Select a cloud provider (AWS, Google Cloud, or Azure)
4. Choose a region close to you
5. Name your cluster (e.g., "mypcp-clinic")
6. Click "Create Cluster"

### Step 3: Create Database User
1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create a username (e.g., "mypcp-admin")
5. Generate a secure password (save it!)
6. Set privileges to "Read and write to any database"
7. Click "Add User"

### Step 4: Whitelist IP Addresses
1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Clusters" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" and version "4.1 or later"
5. Copy the connection string
6. Replace `<password>` with your database user password
7. Replace `<dbname>` with `mypcp-clinic`

### Step 6: Set Environment Variable
Add this to your Vercel environment variables:

```
MONGODB_URI=mongodb+srv://mypcp-admin:YOUR_PASSWORD@mypcp-clinic.xxxxx.mongodb.net/mypcp-clinic?retryWrites=true&w=majority
```

### Step 7: Deploy
1. Commit your changes
2. Deploy to Vercel
3. The system will automatically connect to your database

## Benefits of This Setup

✅ **Permanent Storage**: All patient data is stored permanently in the cloud
✅ **No Data Loss**: Data persists even if Vercel functions restart
✅ **Scalable**: Can handle thousands of patients
✅ **Secure**: Encrypted connections and access controls
✅ **Free**: MongoDB Atlas free tier supports up to 512MB storage
✅ **Backup**: Automatic backups included
✅ **Access**: Access your data from anywhere

## What Happens Next

1. **First Form Submission**: Creates the database and collections
2. **All Future Submissions**: Stored permanently in the database
3. **Dashboard**: Shows data from the permanent database
4. **Excel Export**: Exports all data from the database
5. **No More Data Loss**: Everything is permanently stored

## Database Collections

- `patients`: All patient intake forms
- `daily_patients`: Daily patient summaries for reporting

## Support

If you need help with the setup, the system will fall back to local storage and log any database connection issues.
