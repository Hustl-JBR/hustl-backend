# 🚀 Deploy Your Changes to Railway NOW

## ⚠️ Problem: Changes Not Showing on Live Site

Your changes (gender field, Stripe fixes) are in the code but **not deployed to Railway yet**.

## ✅ Solution: Push to GitHub → Railway Auto-Deploys

### Step 1: Check What Changed

The files I edited are in:
```
C:\Users\jbrea\OneDrive\Desktop\hustl-backend\
```

**Key files changed:**
- ✅ `prisma/schema.prisma` - Added gender and bio fields
- ✅ `public/index.html` - Added gender dropdown, fixed Stripe button
- ✅ `routes/users.js` - Added gender/bio support
- ✅ `routes/stripe-connect.js` - Fixed Stripe button errors
- ✅ `routes/jobs.js` - Added delete job endpoint

### Step 2: Push to GitHub

**Option A: Using GitHub Desktop (Easiest)**

1. Open GitHub Desktop
2. Make sure you're in the `hustl-backend` repository
3. You should see all the changed files
4. Write a commit message: `Add gender field, fix Stripe button, add delete job`
5. Click "Commit to main"
6. Click "Push origin" (top right)
7. Wait for push to complete

**Option B: Using Command Line**

```bash
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
git add .
git commit -m "Add gender field, fix Stripe button, add delete job"
git push origin main
```

### Step 3: Railway Will Auto-Deploy

- Railway watches your GitHub repo
- When you push, it automatically starts a new deployment
- Check Railway dashboard → Deployments → Should see new deployment starting

### Step 4: Wait for Deployment

1. Go to Railway dashboard
2. Click on your project
3. Click "Deployments" tab
4. Watch for the new deployment
5. Wait until it says "Active" or "Success"

### Step 5: Add Database Columns (CRITICAL!)

**The gender field won't show until you add the database columns!**

**Go to Railway → Your Database → Query and run:**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
```

**OR use Prisma migrate:**

1. In Railway, go to your service
2. Click "Settings" → "Variables"
3. Make sure `DATABASE_URL` is set
4. In your local terminal:
   ```bash
   cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
   npx prisma migrate deploy
   ```

### Step 6: Test

1. Go to `https://hustl-production.up.railway.app/`
2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
3. Log in
4. Go to Profile
5. **Gender field should appear!**
6. Try Stripe button

## 🐛 If Still Not Working

### Check 1: Is Railway Connected to Right Repo?

1. Railway → Your Project → Settings
2. Check "Source" → Should show your GitHub repo
3. Check branch → Should be "main"

### Check 2: Is Code Actually Pushed?

1. Go to your GitHub repo in browser
2. Check if `prisma/schema.prisma` has `gender` and `bio` fields
3. Check if `public/index.html` has `profileGenderInput`

### Check 3: Railway Deployment Status

1. Railway → Deployments
2. Check latest deployment:
   - ✅ Green = Success
   - ⚠️ Yellow = Building
   - ❌ Red = Failed (check logs)

### Check 4: Database Migration

**Gender field won't show if database columns don't exist!**

Run the SQL above in Railway database console.

## 📋 Quick Checklist

- [ ] Code pushed to GitHub?
- [ ] Railway deployment successful?
- [ ] Database columns added (bio, gender)?
- [ ] Hard refresh browser (Ctrl+F5)?
- [ ] Checked browser console for errors (F12)?

## 🆘 Still Not Working?

Share:
1. Railway deployment status (success/failed?)
2. Browser console errors (F12 → Console tab)
3. Whether you ran the database migration
4. Screenshot of Profile page

Let's get this deployed! 🚀

