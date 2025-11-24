# 🚀 Hustl Deployment Checklist

## Pre-Deployment Checklist

### ✅ Phase 1-4 Features Complete
- [x] Phase 1: Quick Wins (skeletons, pull-to-refresh, typing indicators, empty states, suggested pricing)
- [x] Phase 2: Core UX (onboarding, filter chips, WebSocket, in-app payment, verification badges)
- [x] Phase 3: Advanced Features (earnings dashboard, referrals, GPS tracking, help center, recurring jobs)
- [x] Phase 4: Polish (animations, performance, A/B testing, feedback)

### 📋 Database Setup

#### 1. Run Prisma Migrations
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate deploy
```

**Important Tables Created:**
- `users` (with referralCode, referredByUserId)
- `jobs` (with recurrence fields, location tracking)
- `referrals` (referral system)
- `location_updates` (GPS tracking)
- `reviews`, `offers`, `threads`, `messages`, etc.

#### 2. Verify Database Connection
- Check `DATABASE_URL` in Railway environment variables
- Format: `postgresql://user:password@host:port/database?sslmode=require`

### 🔐 Environment Variables (Railway)

#### Required Variables:
```bash
# Database
DATABASE_URL=postgresql://...

# JWT Authentication
JWT_SECRET=your-secret-key-here

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Resend)
RESEND_API_KEY=re_...

# File Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...

# Google Maps (for GPS tracking)
GOOGLE_MAPS_API_KEY=...

# Admin Email (for support/feedback)
ADMIN_EMAIL=team.hustlapp@outlook.com

# Server
PORT=8080
NODE_ENV=production
HOST=0.0.0.0
```

#### Optional Variables:
```bash
# CORS (if needed)
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 📦 Dependencies

#### Install All Dependencies:
```bash
npm install
```

#### Key Dependencies:
- `express` - Web server
- `prisma` - Database ORM
- `stripe` - Payments
- `ws` - WebSocket server
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing
- `resend` - Email service
- `@aws-sdk/client-s3` - R2 storage

### 🔧 Backend Setup

#### 1. Verify Server Configuration
- Check `server.js` has all routes registered
- Verify WebSocket server is configured
- Ensure static file serving is set up

#### 2. Test Locally First
```bash
# Start development server
npm start

# Or with nodemon for auto-reload
npm run dev
```

#### 3. Test Key Endpoints
- `GET /` - Should serve index.html
- `POST /auth/signup` - User registration
- `GET /jobs` - Job listings
- `WebSocket /ws` - Real-time connection

### 🌐 Frontend Setup

#### 1. Verify Static Files
- `/public/index.html` - Main app
- `/public/app-core.js` - Core utilities
- `/public/mobile-core.js` - Mobile optimizations
- `/public/api-integration.js` - API layer
- `/public/analytics.js` - Analytics
- `/public/service-worker.js` - Offline support

#### 2. Check API Integration
- Verify `BACKEND_URL` in `index.html` uses `window.location.origin`
- Check WebSocket connection URL
- Verify Stripe publishable key is set

### 🚢 Railway Deployment

#### Step 1: Connect Repository
1. Go to [Railway Dashboard](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

#### Step 2: Configure Build Settings
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Root Directory**: `.` (root)

#### Step 3: Add Environment Variables
1. Go to your project → Variables tab
2. Add all required variables from above
3. **Important**: Set `NODE_ENV=production`

#### Step 4: Add PostgreSQL Database
1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will create database and set `DATABASE_URL` automatically
3. Copy the `DATABASE_URL` for your local `.env` if needed

#### Step 5: Run Migrations
After first deployment, run migrations:
```bash
# Via Railway CLI
railway run npx prisma migrate deploy

# Or via Railway dashboard → Deployments → Run Command
```

#### Step 6: Deploy
1. Push to `main` branch (auto-deploys)
2. Or click "Deploy" in Railway dashboard
3. Wait for build to complete
4. Check logs for errors

### 🔍 Post-Deployment Verification

#### 1. Check Server Logs
```bash
# In Railway dashboard → Deployments → View Logs
# Look for:
# ✅ "Hustl backend running at http://..."
# ✅ "Registered API Routes"
# ✅ No errors
```

#### 2. Test API Endpoints
```bash
# Health check
curl https://your-app.railway.app/

# Test auth (should return 401 without token)
curl https://your-app.railway.app/auth/me
```

#### 3. Test Frontend
- Open your Railway URL in browser
- Check browser console for errors
- Test signup/login
- Test job posting
- Test WebSocket connection (check Network tab)

#### 4. Test WebSocket
```javascript
// In browser console
const ws = new WebSocket('wss://your-app.railway.app/ws?token=YOUR_TOKEN');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### 🐛 Common Issues & Fixes

#### Issue: Database Connection Failed
**Fix:**
- Verify `DATABASE_URL` is set correctly
- Check database is running in Railway
- Ensure `?sslmode=require` is in connection string

#### Issue: WebSocket Not Connecting
**Fix:**
- Verify `JWT_SECRET` matches auth secret
- Check WebSocket path is `/ws`
- Ensure token is passed in query string: `?token=...`

#### Issue: Static Files Not Loading
**Fix:**
- Verify `public` folder is in root directory
- Check `express.static('public')` in server.js
- Ensure files are committed to git

#### Issue: Stripe Payment Fails
**Fix:**
- Verify `STRIPE_SECRET_KEY` is set (use live key in production)
- Check `STRIPE_PUBLISHABLE_KEY` matches in frontend
- Verify webhook endpoint is configured

#### Issue: Service Worker Not Registering
**Fix:**
- Service workers require HTTPS (Railway provides this)
- Check browser console for registration errors
- Verify `/service-worker.js` is accessible

### 📊 Monitoring Setup

#### 1. Railway Logs
- View real-time logs in Railway dashboard
- Set up alerts for errors

#### 2. Error Tracking (Optional)
- Set up Sentry for error tracking
- Add to `server.js`:
```javascript
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

#### 3. Analytics
- Analytics events are sent to `/analytics/track`
- Can integrate with PostHog, Mixpanel, or Google Analytics

### 🔄 Continuous Deployment

#### Auto-Deploy on Push
- Railway auto-deploys on push to `main` branch
- Can configure branch in Railway settings

#### Manual Deploy
- Click "Deploy" in Railway dashboard
- Or use Railway CLI: `railway up`

### 📝 Deployment Commands Summary

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Run migrations (production)
npx prisma migrate deploy

# 4. Start server
npm start

# 5. Test locally
curl http://localhost:8080/

# 6. Deploy to Railway
# (Auto-deploys on git push, or use Railway CLI)
railway up
```

### ✅ Final Checklist

Before going live:
- [ ] All environment variables set in Railway
- [ ] Database migrations run successfully
- [ ] Test signup/login flow
- [ ] Test job posting
- [ ] Test payment flow (with test card)
- [ ] Test WebSocket connection
- [ ] Test file uploads
- [ ] Verify service worker registers
- [ ] Check mobile responsiveness
- [ ] Test offline functionality
- [ ] Verify analytics tracking
- [ ] Test feedback submission
- [ ] Check error logs for issues

### 🎉 You're Ready to Deploy!

Once all checks pass, your app is ready for production. Users can now:
- Sign up and log in
- Post and apply for jobs
- Make payments securely
- Use real-time messaging
- Track earnings
- Share referral codes
- Use GPS tracking
- Get help from support center
- Submit feedback

---

## Need Help?

If you encounter issues:
1. Check Railway logs for errors
2. Verify all environment variables are set
3. Test endpoints individually
4. Check browser console for frontend errors
5. Verify database connection

Good luck with your deployment! 🚀
