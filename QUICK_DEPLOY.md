# ⚡ Quick Deploy Guide - Get Live in 10 Minutes

## Step 1: Prepare Your Code

1. **Remove Test Mode** (if enabled):
   - Open `.env` file
   - Remove or comment out: `SKIP_STRIPE_CHECK=true`
   - Save file

2. **Verify Environment Variables**:
   Make sure you have these in `.env`:
   ```env
   DATABASE_URL="your-neon-connection-string"
   JWT_SECRET="your-secret-key"
   STRIPE_SECRET_KEY="sk_test_..."  # Start with test mode!
   PORT=8080
   NODE_ENV=production
   FRONTEND_BASE_URL="https://your-app.railway.app"  # Update after deploy
   ```

## Step 2: Deploy to Railway (Easiest Option)

### Option A: Deploy from GitHub

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```

2. **Deploy on Railway**:
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repo
   - Railway auto-detects Node.js

3. **Add Environment Variables**:
   - Click on your project
   - Go to "Variables" tab
   - Add all variables from your `.env` file
   - **IMPORTANT:** Don't add `SKIP_STRIPE_CHECK` (or set it to `false`)

4. **Get Your URL**:
   - Railway gives you a URL like: `https://your-app.railway.app`
   - Update `FRONTEND_BASE_URL` in Railway variables

5. **Deploy!**
   - Railway automatically deploys
   - Wait 2-3 minutes
   - Visit your URL!

### Option B: Deploy from Local (Railway CLI)

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**:
   ```bash
   railway login
   ```

3. **Initialize**:
   ```bash
   railway init
   ```

4. **Add Variables**:
   ```bash
   railway variables set DATABASE_URL="your-url"
   railway variables set JWT_SECRET="your-secret"
   railway variables set STRIPE_SECRET_KEY="sk_test_..."
   # ... add all other variables
   ```

5. **Deploy**:
   ```bash
   railway up
   ```

## Step 3: Test Your Deployment

1. **Visit your URL**: `https://your-app.railway.app`
2. **Create 2 test accounts**:
   - Account 1: Customer (email: test1@example.com)
   - Account 2: Hustler (email: test2@example.com)
3. **Test the flow**:
   - Customer posts a job ($5 test job)
   - Hustler applies
   - Hustler connects Stripe (test mode)
   - Customer accepts & pays
   - Complete job
   - Confirm payment

## Step 4: Set Up Stripe Connect (For Hustlers)

1. **Hustler Account**:
   - Login as hustler
   - Go to Profile
   - Click "Connect Stripe"
   - Complete Stripe Connect onboarding (test mode)
   - This creates a Stripe Connect account

2. **Verify**:
   - Check Stripe Dashboard → Connect → Accounts
   - You should see the connected account

## Step 5: Test Real Transactions

**Start with Stripe Test Mode:**
- Use test card: `4242 4242 4242 4242`
- Any future expiry date
- Any CVC
- Test with $1-5 transactions

**When Ready for Real Money:**
1. Switch Stripe to **Live Mode**
2. Update `STRIPE_SECRET_KEY` to live key (`sk_live_...`)
3. Complete Stripe Connect onboarding in live mode
4. Start with small real transactions

## 🎯 Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Deployed to Railway/Render/etc.
- [ ] Environment variables added
- [ ] `SKIP_STRIPE_CHECK` removed/disabled
- [ ] App accessible via URL
- [ ] Can create accounts
- [ ] Stripe Connect works
- [ ] Payment flow works

## 🐛 Common Issues

**"Payment failed"**
- Check Stripe dashboard for errors
- Verify Stripe keys are correct
- Check server logs

**"Hustler needs Stripe"**
- Hustler must complete Stripe Connect onboarding
- Check Profile → Connect Stripe

**"Database error"**
- Verify `DATABASE_URL` is correct
- Check Neon dashboard

## 📞 Need Help?

- Railway Docs: https://docs.railway.app
- Stripe Docs: https://stripe.com/docs
- Check server logs in Railway dashboard

## 🚀 You're Live!

Your app is now accessible at: `https://your-app.railway.app`

Start testing with real accounts and small transactions!

