# 🚀 Deploy to Railway - Quick Steps

## Step 1: Commit Your Changes

### Open PowerShell or Git Bash in this folder:
```
C:\Users\jbrea\OneDrive\Desktop\hustl-backend
```

### Run these commands:

```powershell
# 1. Check what changed
git status

# 2. Add all changes
git add .

# 3. Commit with this message:
git commit -m "Remove dark mode and prepare for deployment"

# 4. Push to GitHub
git push origin main
```

**That's it for GitHub!** ✅

---

## Step 2: Deploy to Railway

### 2.1 Go to Railway
1. Open https://railway.app in your browser
2. Sign in with GitHub (click "Login with GitHub")
3. Authorize Railway to access your GitHub

### 2.2 Create New Project
1. Click **"New Project"** button
2. Select **"Deploy from GitHub repo"**
3. Find your `hustl-backend` repository
4. Click on it
5. Railway will start deploying automatically!

### 2.3 Wait for First Deploy
- Railway will detect it's a Node.js project
- It will run `npm install` automatically
- Wait for "Deploy Succeeded" (green checkmark)
- This might take 2-5 minutes

---

## Step 3: Set Environment Variables

### 3.1 Open Variables Tab
1. In your Railway project, click **"Variables"** tab
2. Click **"New Variable"**

### 3.2 Add These Variables (One by One):

**Database:**
```
DATABASE_URL=your_neon_database_url_here
```

**JWT Secret (generate a random string):**
```
JWT_SECRET=your_super_secret_random_string_here
```

**Server:**
```
PORT=8080
NODE_ENV=production
```

**Stripe (if you have it):**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Cloudflare R2 (if using):**
```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

**Mapbox (if using):**
```
MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

**Email (Resend):**
```
RESEND_API_KEY=re_...
```

**App URL (get this AFTER first deploy):**
```
APP_BASE_URL=https://your-app.railway.app
```

### 3.3 Get Your Database URL
1. Go to https://neon.tech (or your database provider)
2. Open your project
3. Copy the connection string
4. It looks like: `postgresql://user:password@host/database?sslmode=require`

### 3.4 Generate JWT Secret
Use this PowerShell command:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Or use: https://randomkeygen.com (use "CodeIgniter Encryption Keys")

---

## Step 4: Run Database Migrations

### Option A: Using Railway Dashboard
1. Railway → Your Project → Settings
2. Look for "Deploy Script" or "Run Command"
3. Run: `npm run db:generate`
4. Then run: `npm run db:migrate`

### Option B: Using Railway CLI
```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npm run db:generate
railway run npm run db:migrate
```

---

## Step 5: Get Your Live URL

1. In Railway project, click **"Settings"**
2. Scroll to **"Domains"** section
3. Railway gives you a free domain: `your-app.railway.app`
4. Copy this URL

### Update APP_BASE_URL:
1. Go to **"Variables"** tab
2. Update `APP_BASE_URL` to your Railway URL:
   ```
   APP_BASE_URL=https://your-app.railway.app
   ```
3. Railway will redeploy automatically

---

## Step 6: Test Your Live App

1. Open your Railway URL in browser
2. Test these:
   - [ ] Homepage loads
   - [ ] Can sign up
   - [ ] Can log in
   - [ ] Can post a job
   - [ ] Can view jobs

---

## ✅ You're Live!

Your app is now deployed at: `https://your-app.railway.app`

---

## 🆘 Troubleshooting

### "Deploy Failed"
- Check Railway logs (click on deployment)
- Make sure `package.json` has all dependencies
- Check for syntax errors

### "Cannot connect to database"
- Verify `DATABASE_URL` is correct
- Make sure database allows connections
- Check SSL mode: `?sslmode=require`

### "Module not found"
- Railway runs `npm install` automatically
- Check build logs for errors
- Make sure all dependencies are in `package.json`

### App crashes on startup
- Check runtime logs in Railway
- Verify all environment variables are set
- Check `server.js` for errors

---

## 📋 Quick Checklist

Before deploying:
- [ ] Code committed to GitHub
- [ ] All changes pushed
- [ ] Railway account created
- [ ] Database URL ready
- [ ] JWT secret generated
- [ ] Other API keys ready (if using)

After deploying:
- [ ] Railway project created
- [ ] All environment variables added
- [ ] Database migrations run
- [ ] App deploys successfully
- [ ] Can access live URL
- [ ] Can sign up/log in
- [ ] Features work on live site

---

## 🎉 Done!

Your app is live! Share your Railway URL with users.

**Next steps:**
- Get a custom domain (see `DOMAIN_SETUP.md`)
- Set up Stripe live mode (when ready)
- Monitor for errors
- Get user feedback
