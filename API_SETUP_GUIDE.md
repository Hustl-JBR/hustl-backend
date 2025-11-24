# 🚀 Complete API Setup Guide - Environment Variables & Configuration

This guide walks you through setting up ALL environment variables needed for the new features (WebSocket, Stripe Payment Element, etc.).

---

## 📋 **STEP 1: Get Your Stripe Keys**

### 1.1 Go to Stripe Dashboard
- **URL:** https://dashboard.stripe.com
- **Login** to your Stripe account (or create one if you don't have it)

### 1.2 Get Test Mode Keys (for development)
1. Make sure you're in **Test Mode** (toggle in top right)
2. Go to **Developers** → **API keys**
3. Copy these two keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) - Click "Reveal test key"

### 1.3 Get Live Mode Keys (for production)
1. Switch to **Live Mode** (toggle in top right)
2. Go to **Developers** → **API keys**
3. Copy these two keys:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`) - Click "Reveal live key"

**⚠️ IMPORTANT:** Keep secret keys secure! Never commit them to GitHub.

---

## 📋 **STEP 2: Set Up Environment Variables in Railway**

Railway is where your backend is hosted. You need to add environment variables there.

### 2.1 Go to Railway Dashboard
- **URL:** https://railway.app
- **Login** to your Railway account

### 2.2 Navigate to Your Project
1. Click on your **Hustl backend project**
2. Click on the **service** (usually named "hustl-backend" or similar)
3. Click on the **Variables** tab (or **Settings** → **Variables**)

### 2.3 Add These Environment Variables

Click **"New Variable"** for each one:

#### **Stripe Keys (REQUIRED)**
```
Name: STRIPE_SECRET_KEY
Value: sk_test_... (use test key for now, switch to live later)
```

```
Name: STRIPE_PUBLISHABLE_KEY
Value: pk_test_... (use test key for now, switch to live later)
```

#### **JWT Secret (REQUIRED for WebSocket)**
```
Name: JWT_SECRET
Value: [Generate a random string - see instructions below]
```

**To generate JWT_SECRET:**
- Option 1: Run this in terminal: `openssl rand -base64 32`
- Option 2: Use this online generator: https://randomkeygen.com/
- Option 3: Use any long random string (at least 32 characters)

#### **App URLs (REQUIRED)**
```
Name: APP_BASE_URL
Value: https://your-railway-app.up.railway.app
```
*(Replace with your actual Railway URL - find it in Railway dashboard)*

```
Name: FRONTEND_BASE_URL
Value: https://your-frontend-domain.com
```
*(Replace with your actual frontend URL - or use Railway URL if frontend is on same domain)*

#### **Database (Already Set Up)**
```
Name: DATABASE_URL
Value: [Your Neon database URL - should already be set]
```

#### **Other Variables (Check if they exist)**
Make sure these are also set (they might already be there):
- `NODE_ENV` = `production`
- `PORT` = `8080` (or let Railway auto-set it)
- `SKIP_STRIPE_CHECK` = `false` (set to `true` only for testing without Stripe)

### 2.4 Save and Redeploy
1. After adding all variables, Railway will **automatically redeploy**
2. Wait for deployment to complete (check the **Deployments** tab)

---

## 📋 **STEP 3: Set Up Environment Variables in GitHub (Optional - for CI/CD)**

If you use GitHub Actions or want to store secrets for CI/CD:

### 3.1 Go to GitHub Repository
- **URL:** https://github.com/your-username/hustl-backend
- Navigate to your repository

### 3.2 Go to Settings → Secrets
1. Click **Settings** tab
2. Click **Secrets and variables** → **Actions** (or **Secrets** in older GitHub)
3. Click **"New repository secret"**

### 3.3 Add Secrets (Same as Railway)

Add the same secrets you added to Railway:
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `JWT_SECRET`
- `DATABASE_URL`
- `APP_BASE_URL`
- `FRONTEND_BASE_URL`

**⚠️ Note:** GitHub secrets are only used if you have CI/CD workflows. Railway uses its own variables, not GitHub secrets.

---

## 📋 **STEP 4: Install WebSocket Package**

The WebSocket server requires the `ws` package. Run this command:

```bash
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
npm install ws
```

This will add `ws` to your `package.json` dependencies.

---

## 📋 **STEP 5: Update Your .env File (Local Development)**

If you're testing locally, update your `.env` file in the project root:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT
JWT_SECRET=your-generated-secret-here

# URLs
APP_BASE_URL=http://localhost:8080
FRONTEND_BASE_URL=http://localhost:8080

# Database
DATABASE_URL=your-neon-database-url

# Other
NODE_ENV=development
PORT=8080
SKIP_STRIPE_CHECK=false
```

---

## 📋 **STEP 6: Test the Setup**

### 6.1 Test Stripe Config Endpoint
```bash
# Get your auth token first (login via API)
curl -X GET https://your-railway-url.up.railway.app/payments/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Should return:
```json
{
  "publishableKey": "pk_test_..."
}
```

### 6.2 Test WebSocket Connection
1. Open browser console on your frontend
2. Check for `[WebSocket] Connected` message
3. If you see errors, check:
   - JWT_SECRET is set correctly
   - WebSocket URL is correct (should be `wss://your-railway-url.up.railway.app/ws`)

---

## 📋 **STEP 7: Deploy to Railway**

### 7.1 Push Code to GitHub
```bash
cd c:\Users\jbrea\OneDrive\Desktop\hustl-backend
git add .
git commit -m "Add WebSocket server and Stripe Payment Element endpoints"
git push origin main
```

### 7.2 Railway Auto-Deploys
- Railway will automatically detect the push
- It will redeploy with your new environment variables
- Check the **Deployments** tab to see progress

### 7.3 Verify Deployment
1. Go to Railway dashboard
2. Check **Deployments** tab - should show "Deployed successfully"
3. Check **Logs** tab - should see:
   ```
   🚀 Hustl backend running on port 8080
   🔌 WebSocket server ready at ws://...
   ```

---

## 🔍 **Troubleshooting**

### Problem: WebSocket connection fails
**Solution:**
- Check `JWT_SECRET` is set in Railway
- Check WebSocket URL uses `wss://` (secure) in production, `ws://` in development
- Check browser console for specific error messages

### Problem: Stripe Payment Element doesn't load
**Solution:**
- Verify `STRIPE_PUBLISHABLE_KEY` is set correctly
- Check `/payments/config` endpoint returns the key
- Make sure you're using the correct key (test vs live)

### Problem: Payment intent creation fails
**Solution:**
- Check `STRIPE_SECRET_KEY` is set correctly
- Verify you're using test keys in test mode
- Check Railway logs for specific error messages

### Problem: Environment variables not updating
**Solution:**
- After adding variables in Railway, trigger a manual redeploy
- Go to **Deployments** → **Redeploy**

---

## ✅ **Checklist**

Before going live, make sure:

- [ ] All environment variables are set in Railway
- [ ] `ws` package is installed (`npm install ws`)
- [ ] Stripe keys are correct (test mode for testing, live for production)
- [ ] JWT_SECRET is set and secure
- [ ] WebSocket connection works (check browser console)
- [ ] Payment Element loads correctly
- [ ] Code is pushed to GitHub
- [ ] Railway deployment is successful

---

## 🎯 **Quick Reference: All Required Variables**

```env
# Stripe (REQUIRED)
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_... or pk_live_...

# JWT (REQUIRED for WebSocket)
JWT_SECRET=your-random-secret-here

# URLs (REQUIRED)
APP_BASE_URL=https://your-railway-url.up.railway.app
FRONTEND_BASE_URL=https://your-frontend-url.com

# Database (REQUIRED - should already be set)
DATABASE_URL=postgresql://...

# Optional
NODE_ENV=production
PORT=8080
SKIP_STRIPE_CHECK=false
```

---

## 📞 **Need Help?**

If you run into issues:
1. Check Railway logs (Deployments → View Logs)
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Make sure `ws` package is installed

---

**That's it! Your API is now ready for WebSocket and Stripe Payment Element! 🎉**

