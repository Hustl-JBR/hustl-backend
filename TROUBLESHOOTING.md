# 🔧 Troubleshooting Railway Deployment

## "Error Connecting to Source" - How to Fix

### Step 1: Check Railway Deployment Status

1. Go to your Railway project
2. Click on your service
3. Check the **"Deployments"** tab:
   - ✅ **Green/Success** = Deployment worked
   - ❌ **Red/Failed** = Check the logs
   - 🟡 **Building** = Still deploying (wait 2-3 minutes)

### Step 2: Check Railway Logs

1. In Railway, click on your service
2. Click **"View Logs"** or **"Deployments"** → Click latest deployment
3. Look for errors like:
   - `Error: Cannot connect to database`
   - `Error: Missing environment variable`
   - `Error: Port already in use`

### Step 3: Verify Environment Variables

Make sure ALL these are set in Railway:

**Required:**
- ✅ `DATABASE_URL` - Your Neon connection string
- ✅ `JWT_SECRET` - Any random string (32+ characters)
- ✅ `STRIPE_SECRET_KEY` - Your Stripe key (starts with `sk_test_` or `sk_live_`)
- ✅ `PORT` - Set to `8080`
- ✅ `NODE_ENV` - Set to `production`
- ✅ `FRONTEND_BASE_URL` - Your Railway URL (e.g., `https://your-app.up.railway.app`)

**Check:**
- Go to Railway → Your Service → Variables tab
- Make sure all variables are there
- No typos in variable names

### Step 4: Check Database Connection

1. Go to your **Neon dashboard**
2. Copy your connection string
3. Make sure it's set in Railway as `DATABASE_URL`
4. Test the connection string format:
   ```
   postgresql://user:password@host/database?sslmode=require
   ```

### Step 5: Check Your App URL

1. In Railway, go to **Settings** → **Domains**
2. Copy your Railway URL
3. Visit it in your browser
4. Check browser console (F12) for specific errors

### Step 6: Common Issues & Fixes

#### Issue: "Cannot connect to database"
**Fix:**
- Verify `DATABASE_URL` is correct in Railway
- Check Neon dashboard - is database active?
- Make sure connection string includes `?sslmode=require`

#### Issue: "Missing environment variable"
**Fix:**
- Check Railway logs for which variable is missing
- Add it to Railway Variables tab
- Railway will auto-redeploy

#### Issue: "CORS error"
**Fix:**
- Make sure `FRONTEND_BASE_URL` matches your Railway URL exactly
- Check server.js CORS configuration

#### Issue: "Port error"
**Fix:**
- Railway handles ports automatically
- You can remove `PORT=8080` or keep it (Railway will override if needed)

### Step 7: Test Your Deployment

1. Visit your Railway URL
2. Open browser console (F12)
3. Look for specific error messages
4. Check Network tab for failed requests

### Step 8: Redeploy if Needed

If nothing works:
1. In Railway, click your service
2. Click **"..."** menu (three dots)
3. Select **"Redeploy"**
4. Wait for deployment to complete

## 🐛 Still Having Issues?

**Check these:**
1. Railway deployment logs (most important!)
2. Browser console errors (F12)
3. Network tab for failed API calls
4. Database connection in Neon dashboard

**Share with me:**
- Railway deployment logs (copy/paste)
- Browser console errors
- Your Railway URL (if it's accessible)

## ✅ Success Indicators

Your app is working if:
- ✅ Railway shows green "Active" status
- ✅ You can visit your Railway URL
- ✅ No errors in browser console (except those harmless SVG warnings)
- ✅ You can create an account
- ✅ API calls work (check Network tab)

