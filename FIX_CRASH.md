# 🔧 Fix Deployment Crash - Step by Step

## Step 1: Check Railway Logs (Most Important!)

1. **Go to Railway** → Your Service
2. **Click "Deployments" tab**
3. **Click the FAILED deployment** (red one, at the top)
4. **Scroll through the logs**
5. **Look for ERROR messages** (usually in red)
6. **Copy the last 20-30 lines** of the log

## Step 2: Common Crash Causes & Fixes

### Error 1: "Cannot find module" or "Module not found"

**What it means:**
- Missing dependency in package.json
- Or dependency installation failed

**Fix:**
- Check that all dependencies are in `package.json`
- Make sure `package.json` was pushed to GitHub
- Railway will run `npm install` automatically

### Error 2: "Cannot connect to database"

**What it means:**
- DATABASE_URL is wrong or missing
- Database connection failed

**Fix:**
1. Go to Railway → Variables
2. Check `DATABASE_URL` is set correctly
3. Verify your Neon database is active
4. Make sure connection string includes `?sslmode=require`

### Error 3: "Missing environment variable"

**What it means:**
- Required variable not set in Railway

**Fix:**
1. Check Railway → Variables tab
2. Make sure you have:
   - DATABASE_URL
   - JWT_SECRET
   - STRIPE_SECRET_KEY
   - NODE_ENV = production
   - PORT = 8080
   - FRONTEND_BASE_URL = https://hustl-production.up.railway.app

### Error 4: "Port already in use" or "EADDRINUSE"

**What it means:**
- Port conflict (usually not an issue on Railway)

**Fix:**
- Railway handles ports automatically
- You can remove `PORT=8080` variable (Railway will use its own port)
- Or keep it - Railway will override if needed

### Error 5: "Prisma Client not generated"

**What it means:**
- Prisma client needs to be generated before starting

**Fix:**
1. Railway needs to run `npx prisma generate` before `npm start`
2. Check Railway → Settings → Build Command
3. Set Build Command to: `npm install && npx prisma generate`
4. Set Start Command to: `npm start`

### Error 6: "Cannot find server.js" or "Entry point not found"

**What it means:**
- Railway can't find the main file

**Fix:**
1. Check Railway → Settings → Start Command
2. Should be: `npm start` or `node server.js`
3. Make sure `server.js` is in the root of your repo

## Step 3: Check Railway Settings

1. **Go to Railway** → Your Service → **Settings**
2. **Check these:**

### Build Command:
- Should be: `npm install && npx prisma generate`
- OR leave empty (Railway auto-detects)

### Start Command:
- Should be: `npm start`
- OR: `node server.js`

### Root Directory:
- Should be empty (or `/` if needed)

## Step 4: Most Likely Fix - Add Prisma Generate

Railway needs to generate Prisma client before starting:

1. **Go to Railway** → Your Service → **Settings**
2. **Find "Build Command"**
3. **Set it to:**
   ```
   npm install && npx prisma generate
   ```
4. **Find "Start Command"**
5. **Set it to:**
   ```
   npm start
   ```
6. **Save**
7. **Railway will redeploy automatically**

## Step 5: Check Your package.json

Make sure `package.json` has:
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

## 🆘 What I Need From You

**To help fix this, I need:**

1. **The error message from Railway logs:**
   - Go to Deployments → Failed deployment → Logs
   - Copy the last 20-30 lines
   - Look for red error text

2. **Railway Settings:**
   - What does "Build Command" say?
   - What does "Start Command" say?

3. **Your package.json:**
   - Does it have `"start": "node server.js"`?

## Quick Fix to Try First:

1. **Go to Railway** → Service → **Settings**
2. **Set Build Command:** `npm install && npx prisma generate`
3. **Set Start Command:** `npm start`
4. **Save** (Railway will redeploy)
5. **Wait 2-3 minutes**
6. **Check if it works**

Share the error message from Railway logs and I'll help you fix it!

