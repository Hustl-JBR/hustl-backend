# 🚨 URGENT: Deploy Changes to Railway

## The Problem
- ✅ Code is updated locally
- ❌ Changes NOT on Railway yet
- ❌ Gender field won't show (needs database migration)
- ❌ Stripe button fixes not live

## ✅ Solution: 3 Steps

### STEP 1: Push Code to GitHub

**Using GitHub Desktop:**
1. Open GitHub Desktop
2. You should see changed files:
   - `prisma/schema.prisma`
   - `public/index.html`
   - `routes/users.js`
   - `routes/stripe-connect.js`
   - `routes/jobs.js`
3. Write commit message: `Add gender field, fix Stripe, add delete job`
4. Click "Commit to main"
5. Click "Push origin" (top right button)
6. Wait for "Pushed to origin/main"

**OR using Command Line:**
```powershell
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
git add .
git commit -m "Add gender field, fix Stripe, add delete job"
git push origin main
```

### STEP 2: Wait for Railway to Deploy

1. Go to Railway dashboard
2. Click your project
3. Click "Deployments" tab
4. You should see a new deployment starting
5. Wait until status is "Active" (green checkmark)
6. This takes 2-5 minutes

### STEP 3: Add Database Columns (CRITICAL!)

**Gender field won't show until you add these columns!**

**Option A: Railway Database Console (Easiest)**
1. Railway → Your PostgreSQL database service
2. Click "Query" or "Connect" button
3. Run this SQL:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
   ```
4. Click "Run" or "Execute"
5. Should see "Success" or "Query executed"

**Option B: Prisma Migrate**
```bash
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
npx prisma migrate deploy
```
(Only works if DATABASE_URL is set in your .env)

## ✅ After Deployment

1. Go to `https://hustl-production.up.railway.app/`
2. **Hard refresh** (Ctrl+Shift+R or Ctrl+F5)
3. Log in
4. Go to Profile
5. **Gender dropdown should appear!**
6. Try Stripe button

## 🐛 If Still Not Working

### Check 1: Is Code Pushed?
- Go to GitHub.com → Your repo
- Check if `prisma/schema.prisma` has `gender` and `bio` fields
- If not, push again

### Check 2: Is Railway Deployed?
- Railway → Deployments
- Latest should be "Active" (green)
- If "Failed" (red), click it and check logs

### Check 3: Database Columns Added?
- Run the SQL above in Railway database
- Check if columns exist:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name IN ('bio', 'gender');
  ```
- Should return 2 rows

### Check 4: Browser Cache?
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Or clear cache: Ctrl+Shift+Delete → Clear cache

## 📋 Quick Checklist

- [ ] Code pushed to GitHub?
- [ ] Railway deployment successful?
- [ ] Database columns added (bio, gender)?
- [ ] Hard refresh browser?
- [ ] Gender field appears in Profile?

## 🆘 Need Help?

Share:
1. GitHub push status (did it work?)
2. Railway deployment status (Active/Failed?)
3. Did you run the SQL to add columns?
4. Browser console errors (F12 → Console)

Let's get this live! 🚀

