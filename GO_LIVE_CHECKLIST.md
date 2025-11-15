# 🚀 GO LIVE CHECKLIST - Production Deployment

## ✅ Pre-Deployment Steps

### 1. Remove Test Mode
**IMPORTANT:** Make sure `SKIP_STRIPE_CHECK` is **NOT** set in production!

- Remove or comment out `SKIP_STRIPE_CHECK=true` from your `.env` file
- The app will use real Stripe accounts in production

### 2. Environment Variables Required

Create/update your `.env` file with these **production** values:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="your-neon-production-connection-string"

# JWT Secret (use a strong random string)
JWT_SECRET="your-super-secret-jwt-key-here-min-32-chars"

# Stripe (LIVE MODE keys - starts with sk_live_)
STRIPE_SECRET_KEY="sk_live_..."
# Note: You can start with test keys (sk_test_) to test with real accounts

# Email (Resend - for notifications)
RESEND_API_KEY="re_..."
FEEDBACK_EMAIL="your-email@example.com"  # Where feedback emails go

# Cloudflare R2 (for profile pictures)
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="hustl-uploads"
R2_ENDPOINT="https://..."
R2_PUBLIC_URL="https://..."

# Server Configuration
PORT=8080
NODE_ENV=production
FRONTEND_BASE_URL="https://yourdomain.com"  # Your actual domain

# DO NOT SET THIS IN PRODUCTION:
# SKIP_STRIPE_CHECK=false  (or just remove it)
```

### 3. Stripe Setup

#### For Testing with Real Accounts:
1. Go to https://dashboard.stripe.com
2. Use **Test Mode** keys (starts with `sk_test_`)
3. Create 2 test accounts:
   - Account 1: Customer account
   - Account 2: Hustler account (needs Stripe Connect)
4. For hustler account:
   - Go to Profile → Connect Stripe
   - Complete Stripe Connect onboarding (test mode)
   - This will create a `stripeAccountId` for the hustler

#### For Real Transactions:
1. Switch to **Live Mode** in Stripe dashboard
2. Use live keys (starts with `sk_live_`)
3. Complete Stripe Connect onboarding in live mode
4. Start with small transactions ($1-5) to test

### 4. Database Migration

Make sure your production database is up to date:

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (if needed)
npm run db:migrate
```

### 5. Test Locally First

Before deploying:
1. Remove `SKIP_STRIPE_CHECK` from `.env`
2. Test the full flow locally:
   - Create account
   - Post a job
   - Apply as hustler
   - Connect Stripe (hustler)
   - Accept offer (customer)
   - Complete job
   - Confirm payment

## 🌐 Deployment Options

### Option 1: Railway (Recommended - Easy & Fast)
1. Go to https://railway.app
2. Sign up/login
3. Click "New Project" → "Deploy from GitHub repo"
4. Connect your GitHub repo
5. Add environment variables in Railway dashboard
6. Deploy!

**Railway automatically:**
- Detects Node.js
- Runs `npm install`
- Runs `npm start`
- Provides HTTPS URL

### Option 2: Render
1. Go to https://render.com
2. Sign up/login
3. Click "New" → "Web Service"
4. Connect GitHub repo
5. Settings:
   - Build Command: `npm install && npm run db:generate`
   - Start Command: `npm start`
6. Add environment variables
7. Deploy!

### Option 3: Fly.io
1. Install Fly CLI: `npm install -g @fly/cli`
2. Run: `fly launch`
3. Follow prompts
4. Add environment variables: `fly secrets set KEY=value`
5. Deploy: `fly deploy`

### Option 4: Vercel (Frontend + Backend)
1. Go to https://vercel.com
2. Import GitHub repo
3. Configure:
   - Framework: Other
   - Build Command: `npm install && npm run db:generate`
   - Output Directory: `public`
   - Install Command: `npm install`
4. Add environment variables
5. Deploy!

## 📋 Post-Deployment Checklist

- [ ] App is accessible via URL
- [ ] Can create account
- [ ] Can post a job
- [ ] Can apply as hustler
- [ ] Can connect Stripe (hustler)
- [ ] Can accept offer (customer)
- [ ] Payment flow works
- [ ] Job completion works
- [ ] Messages work
- [ ] Profile pictures upload
- [ ] Email notifications work (if configured)

## 🔐 Security Checklist

- [ ] `JWT_SECRET` is strong and unique
- [ ] `SKIP_STRIPE_CHECK` is NOT set
- [ ] Database connection string is secure
- [ ] CORS is configured for your domain only
- [ ] HTTPS is enabled (automatic on most platforms)
- [ ] Environment variables are set in hosting platform (not in code)

## 💰 Testing with Real Money

**Start Small!**
1. Use Stripe **Test Mode** first (free, no real money)
2. Test the full flow with test accounts
3. When ready, switch to **Live Mode**
4. Start with $1-5 transactions
5. Test both customer and hustler accounts
6. Verify payments go through correctly
7. Verify Stripe Connect payouts work

## 🐛 Troubleshooting

### Payment Errors
- Check Stripe dashboard for errors
- Verify Stripe keys are correct (test vs live)
- Check server logs for detailed errors

### Stripe Connect Issues
- Hustler must complete onboarding
- Check `stripeAccountId` is saved in database
- Verify Stripe Connect is enabled in Stripe dashboard

### Database Issues
- Verify `DATABASE_URL` is correct
- Check Prisma migrations ran successfully
- Check Neon dashboard for connection status

## 📞 Support

- Stripe Support: https://support.stripe.com
- Railway Support: https://docs.railway.app
- Neon Support: https://neon.tech/docs

## 🎉 You're Ready!

Once deployed:
1. Share the URL with your test accounts
2. Create 2 accounts (customer + hustler)
3. Test the full flow with small transactions
4. Monitor Stripe dashboard for payments
5. Check server logs for any errors

Good luck! 🚀

