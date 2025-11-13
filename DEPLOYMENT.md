# Deployment Guide - Railway

## Prerequisites

- Railway account (paid tier)
- GitHub repository set up
- All environment variables ready

## Step 1: Connect GitHub to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `Hustl-JBR/Hustl` repository

## Step 2: Configure Build Settings

Railway will auto-detect Node.js. Configure:

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Root Directory:**
```
./
```
(Or leave blank if root is the backend folder)

## Step 3: Add Environment Variables

In Railway dashboard, add all variables from `.env.example`:

- `DATABASE_URL` - Your Neon connection string
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `MAPBOX_TOKEN` - Mapbox token
- `R2_ACCOUNT_ID` - R2 account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET` - R2 bucket name
- `R2_PUBLIC_BASE` - R2 public URL
- `RESEND_API_KEY` - Resend API key
- `JWT_SECRET` - Your JWT secret
- `PORT` - Leave as `8080` (Railway sets this automatically)
- `APP_BASE_URL` - Your Railway app URL (e.g., `https://your-app.railway.app`)
- `NODE_ENV` - Set to `production`

## Step 4: Set Up Database

1. In Railway, add a PostgreSQL service (or use external Neon)
2. If using Railway PostgreSQL, copy the `DATABASE_URL` to environment variables
3. Run migrations:
   - Option A: Run locally pointing to production DB (temporarily)
   - Option B: Add migration script to Railway build

## Step 5: Set Up Stripe Webhook

1. In Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-app.railway.app/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
4. Copy webhook secret to Railway environment variables

## Step 6: Deploy

1. Push code to GitHub:
   ```bash
   git add .
   git commit -m "Deploy to Railway"
   git push
   ```

2. Railway will automatically deploy

3. Check deployment logs in Railway dashboard

## Step 7: Verify

1. Check health endpoint: `https://your-app.railway.app/health`
2. Test signup/login
3. Test job posting
4. Check Stripe webhook is receiving events

## Custom Domain (Optional)

1. In Railway, go to Settings → Domains
2. Add your custom domain
3. Update `APP_BASE_URL` environment variable
4. Update Stripe webhook URL

## Monitoring

- Check Railway dashboard for logs
- Set up error tracking (Sentry, etc.)
- Monitor database usage in Neon dashboard

## Rollback

If something breaks:
1. Go to Railway dashboard
2. Click on deployment
3. Click "Redeploy" on previous successful deployment

## Cost Optimization

- Use Neon free tier for development
- Railway paid tier for production
- Monitor usage in both dashboards




