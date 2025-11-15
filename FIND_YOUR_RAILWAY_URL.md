# 🔍 How to Find Your Railway URL - Step by Step

## Step 1: Log into Railway

1. Go to: **https://railway.app**
2. Click **"Login"** (top right)
3. Login with your GitHub account

## Step 2: Find Your Project

1. After logging in, you'll see your **Dashboard**
2. Look for your project (it should be named after your GitHub repo, like "hustl-app" or "hustl-backend")
3. **Click on the project name** to open it

## Step 3: Find Your Service

1. Inside your project, you'll see a **service** (usually named after your repo)
2. **Click on the service** (it might be a box/card that says your repo name)

## Step 4: Get Your URL (Two Ways)

### Method 1: Settings Tab (Easiest)

1. Click on your service
2. Click the **"Settings"** tab (at the top)
3. Scroll down to **"Domains"** section
4. You'll see your URL there! It looks like:
   - `https://your-app-name.up.railway.app`
   - OR
   - `https://your-app-name-production.up.railway.app`

5. **Copy this URL** - this is your app's address!

### Method 2: Deployments Tab

1. Click on your service
2. Click the **"Deployments"** tab
3. Click on the **latest deployment** (top one)
4. Look for a section that says **"Public URL"** or **"Domain"**
5. **Copy this URL**

## Step 5: Check Deployment Status

While you're looking at your service:

1. Look at the top of the page - you'll see:
   - 🟢 **Green dot** = Running (good!)
   - 🟡 **Yellow dot** = Building (wait a few minutes)
   - 🔴 **Red dot** = Error (check logs)

2. If it's **green**, your app is live!

## Step 6: View Logs (If Something's Wrong)

1. Click on your service
2. Click **"View Logs"** or **"Deployments"** tab
3. Click the **latest deployment**
4. Scroll through the logs to see what's happening
5. Look for errors (they'll be in red)

## Step 7: Update FRONTEND_BASE_URL

Once you have your Railway URL:

1. Go back to your service
2. Click **"Variables"** tab
3. Find `FRONTEND_BASE_URL` (or add it if it's not there)
4. Set it to your Railway URL (the one you copied)
5. Railway will automatically redeploy

## 📸 What You Should See

**In Railway Dashboard:**
```
Projects
└── hustl-app (or your repo name)
    └── Service: hustl-backend
        ├── Settings → Domains → YOUR URL HERE
        ├── Variables → Your environment variables
        └── Deployments → Build logs
```

## 🎯 Quick Checklist

- [ ] Logged into Railway
- [ ] Found your project
- [ ] Clicked on your service
- [ ] Went to Settings → Domains
- [ ] Copied your URL
- [ ] Checked if status is green
- [ ] Updated FRONTEND_BASE_URL variable

## 🆘 Still Can't Find It?

**If you don't see a project:**
- You might need to create one first
- Click "New Project" → "Deploy from GitHub repo"
- Select your repository

**If you see an error:**
- Check the "Deployments" tab
- Look at the logs
- Share the error message with me

**If the URL doesn't work:**
- Wait 2-3 minutes after deployment
- Make sure status is green
- Try the URL in a new browser tab

## 💡 Your Railway URL Format

Your URL will look like one of these:
- `https://hustl-app-production.up.railway.app`
- `https://hustl-backend-production.up.railway.app`
- `https://[random-name].up.railway.app`

The exact name depends on what Railway generated for you!

