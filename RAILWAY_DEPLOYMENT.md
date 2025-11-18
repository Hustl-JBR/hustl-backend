# Railway Deployment Guide for Hustl

This guide will walk you through deploying your Hustl app to Railway so it's live and accessible to users.

## Prerequisites

- GitHub account with your code pushed to a repository
- Railway account (sign up at https://railway.app)
- All your API keys and credentials ready

---

## Step 1: Prepare Your Repository

1. **Make sure everything is committed and pushed to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Verify your `package.json` has these scripts:**
   ```json
   {
     "scripts": {
       "start": "node server.js",
       "dev": "nodemon server.js"
     }
   }
   ```

---

## Step 2: Connect Railway to GitHub

1. **Go to Railway Dashboard** (https://railway.app/dashboard)
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Authorize Railway** to access your GitHub account
5. **Select your Hustl repository**
6. **Railway will automatically detect** it's a Node.js project

---

## Step 3: Set Up Environment Variables

Railway needs all your secrets and API keys. Go to your project settings → **Variables** tab and add:

### Database (Neon PostgreSQL)
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```
*(Get this from your Neon dashboard → Connection String)*

### JWT Authentication
```
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
```
*(Generate a long random string - this should be different from your local one)*

### Stripe (Payment Processing)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
*(Use your LIVE Stripe keys, not test keys)*

### Mapbox (Geocoding)
```
MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoi...
```

### Cloudflare R2 (File Storage)
```
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=hustl-uploads
R2_PUBLIC_BASE=https://your-r2-domain.com
```

### Email Service (Resend)
```
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
```

### ZipCode API (Optional)
```
ZIPCODE_API_KEY=your-key-if-using
```

### App Configuration
```
NODE_ENV=production
APP_BASE_URL=https://your-app-name.railway.app
PORT=8080
SKIP_STRIPE_CHECK=false
```
*(Set `SKIP_STRIPE_CHECK=false` when going live)*

---

## Step 4: Configure Build Settings

1. **Go to your service settings** in Railway
2. **Click on "Settings" tab**
3. **Set Build Command:**
   ```
   npm install && npx prisma generate
   ```
4. **Set Start Command:**
   ```
   npm start
   ```
5. **Set Root Directory:** (if needed)
   ```
   ./
   ```

---

## Step 5: Run Database Migrations

**Option A: Via Railway CLI (Recommended)**
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link your project: `railway link`
4. Run migrations: `railway run npx prisma migrate deploy`

**Option B: Via Railway Dashboard**
1. Go to your service
2. Click "Deployments" → "New Deployment"
3. Use a one-off command: `npx prisma migrate deploy`

**Option C: Add to package.json**
Add this script:
```json
{
  "scripts": {
    "postinstall": "npx prisma generate",
    "migrate": "npx prisma migrate deploy"
  }
}
```

---

## Step 6: Configure Static File Serving

Your `public/` folder needs to be served. Make sure your `server.js` has:

```javascript
// Serve static files from public directory
app.use(express.static('public'));

// Serve index.html for all routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

---

## Step 7: Set Up Custom Domain (Optional)

1. **In Railway dashboard**, go to your service → **Settings** → **Domains**
2. **Click "Generate Domain"** to get a Railway domain (e.g., `hustl-production.up.railway.app`)
3. **Or add your custom domain:**
   - Click "Custom Domain"
   - Enter your domain (e.g., `hustl.app`)
   - Follow Railway's DNS instructions

---

## Step 8: Update Frontend URLs

If you're using a custom domain, update any hardcoded URLs in your frontend:

1. **Check `public/index.html`** for any `localhost:8080` references
2. **Update API calls** to use relative paths (they should already be `/jobs`, `/users`, etc.)
3. **Update email links** in `services/email.js` to use your production URL

---

## Step 9: Test Your Deployment

1. **Visit your Railway URL** (e.g., `https://your-app.railway.app`)
2. **Test key features:**
   - ✅ User registration/login
   - ✅ Job posting
   - ✅ Job browsing
   - ✅ Applying to jobs
   - ✅ Messaging
   - ✅ Payment flow (use test mode first!)
   - ✅ File uploads

---

## Step 10: Monitor and Debug

**Railway Dashboard:**
- **Logs**: View real-time logs in the "Deployments" tab
- **Metrics**: Check CPU, memory usage
- **Errors**: Railway will show deployment errors

**Common Issues:**
- **"Cannot find module"**: Make sure `package.json` has all dependencies
- **"Database connection failed"**: Check `DATABASE_URL` is correct
- **"Port already in use"**: Railway sets `PORT` automatically, use `process.env.PORT || 8080`
- **"Prisma client not generated"**: Add `npx prisma generate` to build command

---

## Step 11: Enable Production Features

Once everything works:

1. **Switch Stripe to Live Mode:**
   - Update `STRIPE_SECRET_KEY` to live key
   - Set `SKIP_STRIPE_CHECK=false`
   - Test with real (small) transactions first

2. **Set up monitoring:**
   - Railway has built-in monitoring
   - Consider adding error tracking (Sentry, etc.)

3. **Set up backups:**
   - Neon PostgreSQL has automatic backups
   - Consider exporting data regularly

---

## Security Checklist

Before going fully live:

- ✅ All environment variables are set (no hardcoded secrets)
- ✅ JWT_SECRET is a long, random string
- ✅ Database uses SSL (`?sslmode=require`)
- ✅ Stripe webhooks are configured
- ✅ CORS is properly configured (if needed)
- ✅ File uploads have size limits
- ✅ API endpoints validate user authentication
- ✅ No test/development code in production

---

## Quick Reference Commands

```bash
# Deploy to Railway (automatic on git push)
git push origin main

# View logs
railway logs

# Run migrations
railway run npx prisma migrate deploy

# Open Railway dashboard
railway open

# Check service status
railway status
```

---

## Troubleshooting

**Deployment fails:**
- Check Railway logs for specific errors
- Verify all environment variables are set
- Make sure `package.json` has correct scripts

**App doesn't load:**
- Check if port is set correctly (`process.env.PORT`)
- Verify static files are being served
- Check Railway logs for errors

**Database errors:**
- Verify `DATABASE_URL` is correct
- Check if migrations ran successfully
- Ensure database allows connections from Railway's IPs

**Payment issues:**
- Verify Stripe keys are correct (live vs test)
- Check webhook endpoints are configured
- Test with Stripe test mode first

---

## Next Steps After Deployment

1. **Test thoroughly** with real users (start small)
2. **Monitor performance** and errors
3. **Set up alerts** for critical issues
4. **Plan for scaling** if traffic grows
5. **Consider adding:**
   - Error tracking (Sentry)
   - Analytics (Google Analytics, etc.)
   - Performance monitoring
   - User feedback system

---

## Support

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app

---

**You're almost there! Your app is ready to go live. 🚀**



