# ⚡ Quick Deployment Guide

## 🚀 Deploy to Railway in 5 Steps

### Step 1: Prepare Your Code
```bash
# Make sure everything is committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Set Up Railway Project
1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `hustl-backend` repository
5. Railway will auto-detect Node.js

### Step 3: Add PostgreSQL Database
1. In Railway project, click **"New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway automatically sets `DATABASE_URL` ✅

### Step 4: Add Environment Variables
In Railway → Your Project → **Variables** tab, add:

```bash
# Required - Copy these exactly:
JWT_SECRET=your-super-secret-jwt-key-here
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
RESEND_API_KEY=re_your_resend_key
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://your_r2_url.com
GOOGLE_MAPS_API_KEY=your_google_maps_key
ADMIN_EMAIL=team.hustlapp@outlook.com
NODE_ENV=production
PORT=8080
```

**Where to get these:**
- `JWT_SECRET`: Generate a random string (keep it secret!)
- `STRIPE_*`: From [Stripe Dashboard](https://dashboard.stripe.com)
- `RESEND_API_KEY`: From [Resend Dashboard](https://resend.com)
- `R2_*`: From [Cloudflare R2 Dashboard](https://dash.cloudflare.com)
- `GOOGLE_MAPS_API_KEY`: From [Google Cloud Console](https://console.cloud.google.com)

### Step 5: Run Database Migrations
After first deployment:

1. In Railway → Your Project → **Deployments**
2. Click **"..."** → **"Run Command"**
3. Enter: `npx prisma migrate deploy`
4. Click **"Run"**

**OR** use Railway CLI:
```bash
railway login
railway link
railway run npx prisma migrate deploy
```

### ✅ Done! Your app is live!

Railway will give you a URL like: `https://your-app.railway.app`

---

## 🔍 Verify It Works

1. **Open your Railway URL** in browser
2. **Check browser console** (F12) - should see no errors
3. **Test signup** - create a test account
4. **Test job posting** - post a test job
5. **Check Railway logs** - should see "Hustl backend running"

---

## 🐛 If Something Breaks

### Database Connection Error?
- Check `DATABASE_URL` is set (Railway auto-sets this)
- Verify database is running in Railway

### WebSocket Not Working?
- Check `JWT_SECRET` is set
- Verify token is being sent in WebSocket connection

### Static Files Not Loading?
- Make sure `public` folder is in your repo
- Check Railway logs for file serving errors

### Payment Not Working?
- Verify Stripe keys are **live keys** (not test keys)
- Check Stripe webhook is configured

---

## 📞 Need Help?

Check the full deployment guide: `DEPLOYMENT_CHECKLIST.md`
