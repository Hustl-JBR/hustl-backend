# 🔑 Environment Variables Checklist

## ✅ What You Already Have (Most Likely)

Based on your existing setup, you probably already have these in Railway:

- ✅ `DATABASE_URL` - PostgreSQL connection (Railway auto-sets this)
- ✅ `JWT_SECRET` - For authentication (you mentioned you have this)
- ✅ `STRIPE_SECRET_KEY` - Stripe secret key
- ✅ `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- ✅ `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- ✅ `RESEND_API_KEY` - Email service
- ✅ `R2_ACCOUNT_ID` - Cloudflare R2 account
- ✅ `R2_ACCESS_KEY_ID` - R2 access key
- ✅ `R2_SECRET_ACCESS_KEY` - R2 secret key
- ✅ `R2_BUCKET_NAME` - R2 bucket name
- ✅ `R2_PUBLIC_URL` - R2 public URL
- ✅ `ADMIN_EMAIL` - Admin email (probably `team.hustlapp@outlook.com`)
- ✅ `NODE_ENV` - Set to `production`
- ✅ `PORT` - Usually `8080` (Railway may auto-set)

## ❌ What You Still Need to Add

### 1. **GOOGLE_MAPS_API_KEY** ⚠️ REQUIRED for GPS Tracking
**Why:** Used for displaying maps in the GPS tracking feature (Phase 3)

**How to get it:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Maps JavaScript API** and **Geocoding API**
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the API key
6. (Optional) Restrict the key to your Railway domain for security

**Add to Railway:**
```
Name: GOOGLE_MAPS_API_KEY
Value: AIza... (your Google Maps API key)
```

**Note:** Google Maps has a free tier ($200/month credit), which should be plenty for starting out.

---

### 2. **APP_BASE_URL** ⚠️ RECOMMENDED
**Why:** Used in email links and referral URLs

**What to set:**
```
Name: APP_BASE_URL
Value: https://your-railway-app.up.railway.app
```
*(Replace with your actual Railway URL - find it in Railway dashboard → Settings → Domains)*

**Note:** If you don't set this, it defaults to `http://localhost:8080` which will break email links.

---

### 3. **FRONTEND_BASE_URL** (Optional)
**Why:** Used for CORS and frontend redirects

**What to set:**
```
Name: FRONTEND_BASE_URL
Value: https://your-frontend-domain.com
```
*(Only needed if your frontend is on a different domain than your backend)*

**Note:** If frontend and backend are on the same Railway domain, you can skip this.

---

## 🔍 Optional Variables (Nice to Have)

These have defaults, but you can customize them:

### Email Settings
```
FROM_EMAIL=Hustl <noreply@hustl.app>
```
*(Default: "Hustl <noreply@hustl.app>")*

### Feature Flags
```
SKIP_STRIPE_CHECK=false
```
*(Set to `true` only for testing without Stripe - default: `false`)*

```
REQUIRE_EMAIL_VERIFICATION=false
```
*(Set to `true` to require email verification - default: `false`)*

### Job Cleanup
```
JOB_CLEANUP_HOURS=72
```
*(Hours before auto-completing jobs - default: 72)*

### Cron Job (for recurring jobs)
```
CRON_API_KEY=your-secret-key-here
```
*(Only needed if you set up external cron job for recurring jobs - see RECURRING_JOBS_SETUP.md)*

---

## 📋 Quick Checklist

### Must Add (Required):
- [ ] `GOOGLE_MAPS_API_KEY` - For GPS tracking maps
- [ ] `APP_BASE_URL` - For email links and referrals

### Should Check (Verify they exist):
- [ ] `JWT_SECRET` - You said you have this ✅
- [ ] `STRIPE_SECRET_KEY` - You probably have this ✅
- [ ] `STRIPE_PUBLISHABLE_KEY` - You probably have this ✅
- [ ] `STRIPE_WEBHOOK_SECRET` - You probably have this ✅
- [ ] `RESEND_API_KEY` - You probably have this ✅
- [ ] `R2_*` variables - You probably have these ✅
- [ ] `DATABASE_URL` - Railway auto-sets this ✅
- [ ] `ADMIN_EMAIL` - You probably have this ✅

### Optional (Can add later):
- [ ] `FRONTEND_BASE_URL` - Only if frontend is separate
- [ ] `FROM_EMAIL` - Customize email sender name
- [ ] `CRON_API_KEY` - Only if using external cron for recurring jobs

---

## 🚀 How to Add Missing Variables in Railway

1. Go to [railway.app](https://railway.app)
2. Click on your **Hustl project**
3. Click on your **service** (backend)
4. Click **Variables** tab
5. Click **"New Variable"**
6. Enter the **Name** and **Value**
7. Click **"Add"**
8. Railway will auto-redeploy

---

## ✅ Verification

After adding variables, check Railway logs to verify:
- No errors about missing environment variables
- Server starts successfully
- WebSocket connects (check for `[WebSocket] User connected` messages)
- GPS tracking works (if you test it)

---

## 📝 Summary

**You need to add:**
1. `GOOGLE_MAPS_API_KEY` - Get from Google Cloud Console
2. `APP_BASE_URL` - Your Railway URL

**Everything else you probably already have!** 🎉


