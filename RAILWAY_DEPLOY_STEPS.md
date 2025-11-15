# 🚂 Railway Deployment - Step by Step

## Step 1: Prepare Your Code (If Not Already on GitHub)

### Option A: If you already have a GitHub repo:
1. Make sure all your latest code is committed and pushed
2. Skip to Step 2

### Option B: If you need to create a GitHub repo:
1. Go to https://github.com/new
2. Repository name: `hustl-app` (or whatever you want)
3. Make it **Private** (recommended for now)
4. Don't initialize with README (you already have files)
5. Click "Create repository"

6. Then in your terminal (or GitHub Desktop):
   ```bash
   cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
   git init
   git add .
   git commit -m "Initial commit - ready for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/hustl-app.git
   git push -u origin main
   ```

## Step 2: Deploy to Railway

1. **Go to Railway**: https://railway.app
2. **Login** with your GitHub account (already connected ✅)
3. **Click "New Project"** (top right)
4. **Select "Deploy from GitHub repo"**
5. **Choose your repository** (hustl-app or whatever you named it)
6. Railway will automatically:
   - Detect it's a Node.js app
   - Start building
   - Try to deploy

## Step 3: Configure Environment Variables

**IMPORTANT:** Railway needs your environment variables!

1. In Railway, click on your project
2. Click on the **service** (your app)
3. Go to **"Variables"** tab
4. Click **"New Variable"** and add each of these:

### Required Variables:

```
DATABASE_URL=your-neon-connection-string
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
STRIPE_SECRET_KEY=sk_test_... (start with test mode!)
PORT=8080
NODE_ENV=production
FRONTEND_BASE_URL=https://your-app.railway.app (update after deploy)
```

### Optional (but recommended):

```
RESEND_API_KEY=re_... (for emails)
FEEDBACK_EMAIL=your-email@example.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=hustl-uploads
R2_ENDPOINT=https://...
R2_PUBLIC_URL=https://...
```

### ⚠️ IMPORTANT - DO NOT ADD:
- `SKIP_STRIPE_CHECK` - Remove this for production!

5. **Save** each variable
6. Railway will automatically **redeploy** when you add variables

## Step 4: Get Your URL

1. After deployment completes (2-3 minutes)
2. Click on your service
3. Go to **"Settings"** tab
4. Under **"Domains"**, you'll see your URL:
   - Example: `https://hustl-app-production.up.railway.app`
5. **Copy this URL**
6. Go back to **"Variables"** tab
7. Update `FRONTEND_BASE_URL` to your actual Railway URL
8. Railway will redeploy automatically

## Step 5: Test Your Deployment

1. Visit your Railway URL
2. You should see your Hustl app!
3. Test creating an account
4. Test posting a job
5. Test the full flow

## Step 6: Set Up Stripe Connect

1. Create 2 test accounts on your live app
2. For the hustler account:
   - Go to Profile
   - Click "Connect Stripe"
   - Complete Stripe Connect onboarding (test mode)
3. Test the payment flow with small amounts

## 🐛 Troubleshooting

### Build Fails:
- Check Railway logs (click on deployment → "View Logs")
- Make sure `package.json` has `"start": "node server.js"`
- Check that all dependencies are in `package.json`

### App Crashes:
- Check logs for errors
- Verify all environment variables are set
- Make sure `DATABASE_URL` is correct
- Check that `JWT_SECRET` is set

### Can't Access:
- Wait 2-3 minutes for deployment to complete
- Check if service is running (green = running)
- Verify your URL is correct

## ✅ Success Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Environment variables added
- [ ] Deployment successful (green status)
- [ ] App accessible via Railway URL
- [ ] Can create accounts
- [ ] Can post jobs
- [ ] Stripe Connect works

## 🎉 You're Live!

Your app is now accessible at: `https://your-app.railway.app`

Start testing with real Stripe accounts and small transactions!

