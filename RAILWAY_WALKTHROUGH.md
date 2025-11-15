# 🚂 Complete Railway Walkthrough - From Zero to Live

## Part 1: Create Project (If You Haven't)

1. **Go to Railway**: https://railway.app
2. **Login** with GitHub
3. **Click "New Project"** (big button, top right)
4. **Select "Deploy from GitHub repo"**
5. **Choose your repository** from the list
6. Railway will start deploying automatically!

## Part 2: Wait for First Deployment

1. You'll see a **build log** appear
2. Wait 2-3 minutes
3. Look for:
   - ✅ **"Build successful"** = Good!
   - ❌ **"Build failed"** = Check logs

## Part 3: Add Environment Variables

1. **Click on your service** (the box that appeared)
2. Click **"Variables"** tab (at the top)
3. Click **"New Variable"** button
4. Add these one by one:

### Variable 1: DATABASE_URL
- **Name**: `DATABASE_URL`
- **Value**: Your Neon database connection string
- Click **"Add"**

### Variable 2: JWT_SECRET
- **Name**: `JWT_SECRET`
- **Value**: Any random string (like `my-super-secret-key-12345`)
- Click **"Add"**

### Variable 3: STRIPE_SECRET_KEY
- **Name**: `STRIPE_SECRET_KEY`
- **Value**: Your Stripe key (starts with `sk_test_` or `sk_live_`)
- Click **"Add"**

### Variable 4: PORT
- **Name**: `PORT`
- **Value**: `8080`
- Click **"Add"**

### Variable 5: NODE_ENV
- **Name**: `NODE_ENV`
- **Value**: `production`
- Click **"Add"**

### Variable 6: FRONTEND_BASE_URL (Add this LAST)
- **Name**: `FRONTEND_BASE_URL`
- **Value**: We'll get this in the next step!

## Part 4: Get Your Railway URL

1. Click **"Settings"** tab (next to Variables)
2. Scroll down to **"Domains"** section
3. You'll see a URL like: `https://your-app-name.up.railway.app`
4. **Copy this entire URL**
5. Go back to **"Variables"** tab
6. Find `FRONTEND_BASE_URL` (or add it if you haven't)
7. Paste your Railway URL as the value
8. Click **"Save"**

Railway will automatically redeploy!

## Part 5: Check Deployment Status

1. Look at the top of your service page
2. You'll see a status indicator:
   - 🟢 **Green** = Running (success!)
   - 🟡 **Yellow** = Building (wait...)
   - 🔴 **Red** = Error (check logs)

## Part 6: Test Your App

1. Go back to **Settings** → **Domains**
2. **Click on your URL** (or copy and paste in browser)
3. Your app should load!
4. If you see errors, check the browser console (F12)

## Part 7: View Logs (If Something's Wrong)

1. Click **"Deployments"** tab
2. Click the **latest deployment** (top one)
3. Scroll through the logs
4. Look for errors (usually in red)
5. Common errors:
   - "Cannot connect to database" → Check DATABASE_URL
   - "Missing environment variable" → Add the missing variable
   - "Port error" → Usually fine, Railway handles this

## 🎯 What You Need From Me

To help you further, I need:

1. **Your Railway URL** (from Settings → Domains)
2. **Deployment status** (green/yellow/red?)
3. **Any error messages** (from logs or browser console)

## 📋 Quick Reference

**Where to find things in Railway:**

```
Railway Dashboard
└── Your Project
    └── Your Service
        ├── Settings → Domains → YOUR URL
        ├── Variables → Environment variables
        ├── Deployments → Build logs
        └── Metrics → Performance stats
```

**Your URL will be:**
- Format: `https://[name].up.railway.app`
- Found in: Settings → Domains
- Use for: FRONTEND_BASE_URL variable

## 🆘 Common Questions

**Q: I don't see a project**
A: Click "New Project" → "Deploy from GitHub repo"

**Q: I don't see a service**
A: The service appears after you connect a repo

**Q: I don't see a URL**
A: Wait for deployment to finish (green status), then check Settings → Domains

**Q: The URL doesn't work**
A: Make sure status is green, wait 2-3 minutes, try in a new tab

**Q: I see errors in logs**
A: Share the error message with me and I'll help fix it!

