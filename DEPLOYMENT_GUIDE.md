# Complete Deployment Guide 🚀

**Step-by-step guide to deploy Hustl to Railway and get it live!**

---

## 📋 Prerequisites

Before starting, make sure you have:
- [ ] GitHub account (you have it!)
- [ ] Railway account (sign up at https://railway.app)
- [ ] Code pushed to GitHub
- [ ] All environment variables ready

---

## 🎯 Step 1: Push Code to GitHub

### 1.1 Check Your Changes
```powershell
git status
```

### 1.2 Add Your Files
```powershell
# Add all changes
git add .

# OR add specific files
git add public/index.html
git add routes/
git add server.js
```

### 1.3 Commit with Message
```powershell
git commit -m "Add dark mode and prepare for deployment"
```

### 1.4 Push to GitHub
```powershell
git push origin main
```

**✅ Done!** Your code is now on GitHub.

---

## 🚂 Step 2: Deploy to Railway

### 2.1 Sign In to Railway
1. Go to https://railway.app
2. Click "Login" or "Start a New Project"
3. Sign in with GitHub (recommended)

### 2.2 Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `hustl-backend` repository
4. Click "Deploy Now"

### 2.3 Railway Auto-Detection
Railway should automatically:
- Detect it's a Node.js project
- Find `package.json`
- Set build command: `npm install`
- Set start command: `npm start`

**If it doesn't auto-detect:**
- Go to Settings → Build & Deploy
- Build Command: `npm install`
- Start Command: `npm start`

---

## 🔐 Step 3: Set Environment Variables

### 3.1 Open Variables Tab
1. In Railway project, click "Variables" tab
2. Click "New Variable"

### 3.2 Add Required Variables

Add these one by one:

```bash
# Database
DATABASE_URL=your_neon_postgres_url

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_here

# Server
PORT=8080
NODE_ENV=production

# Stripe (get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2 (if using)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Mapbox (if using)
MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Email (Resend)
RESEND_API_KEY=re_...

# App URL (Railway will give you this after deploy)
APP_BASE_URL=https://your-app.railway.app
```

### 3.3 Get Your Database URL
1. Go to https://neon.tech (or your database provider)
2. Create a project if you haven't
3. Copy the connection string
4. Format: `postgresql://user:password@host/database?sslmode=require`

### 3.4 Generate JWT Secret
```powershell
# In PowerShell, generate a random string:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

Or use an online generator: https://randomkeygen.com

---

## 🗄️ Step 4: Set Up Database

### 4.1 Run Migrations
Railway can run migrations automatically, OR:

1. Go to Railway project
2. Click "Settings" → "Service"
3. Add a "Deploy Script" or use Railway CLI:

```powershell
# Install Railway CLI (if not installed)
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migrations
railway run npm run db:migrate
```

### 4.2 Generate Prisma Client
```powershell
railway run npm run db:generate
```

---

## 🌐 Step 5: Get Your Live URL

### 5.1 Find Your Domain
1. In Railway project, click "Settings"
2. Scroll to "Domains"
3. Railway gives you a free domain: `your-app.railway.app`
4. Copy this URL

### 5.2 Update APP_BASE_URL
1. Go to "Variables" tab
2. Update `APP_BASE_URL` to your Railway URL:
   ```
   APP_BASE_URL=https://your-app.railway.app
   ```
3. Railway will redeploy automatically

---

## ✅ Step 6: Test Your Deployment

### 6.1 Check Deployment Status
1. In Railway, go to "Deployments" tab
2. Wait for "Deploy Succeeded" (green checkmark)
3. Click on the deployment to see logs

### 6.2 Test the Live Site
1. Open your Railway URL: `https://your-app.railway.app`
2. Test these:
   - [ ] Homepage loads
   - [ ] Can sign up
   - [ ] Can log in
   - [ ] Can post a job
   - [ ] Can view jobs
   - [ ] Can send messages

### 6.3 Check Logs
1. In Railway, click "Deployments"
2. Click latest deployment
3. Check "Logs" tab for errors

---

## 🔧 Step 7: Fix Common Issues

### Issue: "Cannot connect to database"
**Fix:**
- Check `DATABASE_URL` is correct
- Make sure database allows connections from Railway IPs
- Check SSL mode: `?sslmode=require`

### Issue: "Port already in use"
**Fix:**
- Railway sets `PORT` automatically
- Use `process.env.PORT || 8080` in `server.js`
- Don't hardcode port

### Issue: "Module not found"
**Fix:**
- Make sure `package.json` has all dependencies
- Railway runs `npm install` automatically
- Check build logs

### Issue: "JWT secret missing"
**Fix:**
- Add `JWT_SECRET` to Railway variables
- Generate a new secret
- Redeploy

---

## 🎨 Step 8: Custom Domain (Optional)

### 8.1 Buy a Domain
- Namecheap: https://namecheap.com
- Google Domains: https://domains.google
- Cloudflare: https://cloudflare.com/products/registrar

**Popular options:**
- `hustl.app` (~$20/year)
- `gethustl.com` (~$12/year)
- `hustl.work` (~$15/year)

### 8.2 Connect to Railway
1. In Railway, go to "Settings" → "Domains"
2. Click "Custom Domain"
3. Enter your domain
4. Railway gives you DNS records to add

### 8.3 Update DNS
1. Go to your domain registrar
2. Add the DNS records Railway provided
3. Wait 5-60 minutes for DNS to propagate
4. Railway will automatically get SSL certificate

### 8.4 Update APP_BASE_URL
Update the variable to your custom domain:
```
APP_BASE_URL=https://yourdomain.com
```

---

## 📊 Step 9: Monitor Your App

### 9.1 Railway Dashboard
- View deployments
- See logs in real-time
- Monitor resource usage
- Check errors

### 9.2 Set Up Alerts (Optional)
1. Railway → Settings → Notifications
2. Add email for:
   - Deployment failures
   - High resource usage
   - Errors

---

## 🔄 Step 10: Update Your App

### 10.1 Make Changes Locally
1. Edit files
2. Test locally
3. Commit and push to GitHub

### 10.2 Railway Auto-Deploys
- Railway watches your GitHub repo
- Automatically deploys on push to `main`
- You'll see new deployment in Railway

### 10.3 Manual Deploy (if needed)
1. Railway → Deployments
2. Click "Redeploy" on latest deployment

---

## 💰 Step 11: Stripe Live Mode

### 11.1 Complete Stripe Setup
1. Go to https://dashboard.stripe.com
2. Complete account verification
3. Add bank account for payouts

### 11.2 Get Live Keys
1. Stripe Dashboard → Developers → API keys
2. Switch from "Test mode" to "Live mode"
3. Copy:
   - Secret key: `sk_live_...`
   - Publishable key: `pk_live_...`

### 11.3 Update Railway Variables
1. Update `STRIPE_SECRET_KEY` with live key
2. Update `STRIPE_PUBLISHABLE_KEY` with live key
3. Update frontend code to use live key
4. Redeploy

### 11.4 Set Up Webhooks
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-app.railway.app/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copy webhook secret
5. Add to Railway: `STRIPE_WEBHOOK_SECRET`

---

## ✅ Deployment Checklist

Before going live:

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] App deploys successfully
- [ ] Can access live URL
- [ ] Can sign up/log in
- [ ] Can post jobs
- [ ] Can send messages
- [ ] Stripe connected (test mode first)
- [ ] Custom domain set up (optional)
- [ ] Monitoring set up

---

## 🆘 Troubleshooting

### App Won't Deploy
1. Check build logs in Railway
2. Verify `package.json` is correct
3. Check all dependencies are listed
4. Make sure `server.js` exists

### App Deploys But Crashes
1. Check runtime logs
2. Verify environment variables
3. Check database connection
4. Look for error messages

### Can't Access Site
1. Check deployment status (should be "Succeeded")
2. Verify domain is correct
3. Check DNS settings (if custom domain)
4. Wait a few minutes for DNS propagation

### Database Errors
1. Verify `DATABASE_URL` is correct
2. Check database is running
3. Run migrations: `railway run npm run db:migrate`
4. Check database logs

---

## 📞 Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Check Railway logs for specific errors
- Ask for help with specific error messages

---

## 🎉 You're Live!

Once everything is working:
1. Share your app URL
2. Test with real users
3. Monitor for issues
4. Iterate based on feedback

**Congratulations! Your app is live! 🚀**
