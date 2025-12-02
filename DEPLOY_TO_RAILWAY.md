# 🚀 Deploy Changes to Live Railway App

## Step 1: Push Code to GitHub

**Option A: Using GitHub Desktop (Easiest)**

1. Open **GitHub Desktop**
2. Make sure you're in the `hustl-backend` repository
3. You should see all changed files listed:
   - `public/index.html` (mobile nav, smaller toggle)
   - `prisma/schema.prisma` (gender/bio fields)
   - `routes/users.js` (gender/bio support)
   - `routes/stripe-connect.js` (Stripe fixes)
   - `routes/jobs.js` (delete job)
   - etc.
4. **Write commit message:**
   ```
   Mobile nav improvements: hamburger menu, smaller mode toggle, Profile/About in dropdown
   ```
5. Click **"Commit to main"**
6. Click **"Push origin"** (top right button)
7. Wait for "Pushed to origin/main" message

**Option B: Using Command Line**

```powershell
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
git add .
git commit -m "Mobile nav improvements: hamburger menu, smaller mode toggle, Profile/About in dropdown"
git push origin main
```

## Step 2: Railway Auto-Deploys

1. Go to **Railway dashboard**: https://railway.app
2. Click on your **hustl** project
3. Click **"Deployments"** tab
4. You should see a **new deployment starting** automatically
5. Wait 2-5 minutes for it to complete
6. Status should change to **"Active"** (green checkmark)

## Step 3: Add Database Columns (CRITICAL!)

**The gender field won't work until you add these columns!**

### Option A: Railway Database Console (Easiest)

1. In Railway dashboard, click on your **PostgreSQL database** service
2. Click **"Query"** or **"Connect"** button
3. Run this SQL:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
   ```
4. Click **"Run"** or **"Execute"**
5. Should see "Success" or "Query executed"

### Option B: Prisma Migrate (If you have DATABASE_URL)

```powershell
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
npx prisma migrate deploy
```

(Only works if `DATABASE_URL` is set in your `.env` file)

## Step 4: Test Live App

1. Go to: **https://hustl-production.up.railway.app/**
2. **Hard refresh** (Ctrl+Shift+R or Cmd+Shift+R)
3. **Test:**
   - Log in
   - Check if mode toggle is smaller ✅
   - On mobile (or resize browser <768px):
     - Hamburger menu (☰) should appear
     - Click it → Profile and About should show
   - Click Customer/Hustler → Should go to Home page
   - Go to Profile → Gender field should appear

## ✅ Checklist

- [ ] Code pushed to GitHub?
- [ ] Railway deployment successful? (check Deployments tab)
- [ ] Database columns added? (bio, gender)
- [ ] Hard refresh browser?
- [ ] Tested on live site?

## 🐛 If Something Doesn't Work

### Code Not Updating?
- Check Railway → Deployments → Is latest deployment "Active"?
- Hard refresh browser (Ctrl+Shift+R)
- Clear browser cache

### Gender Field Not Showing?
- **Did you run the SQL to add columns?** (Step 3)
- Check Railway database → Run the SQL again
- Hard refresh browser

### Mobile Menu Not Working?
- Make sure screen width is ≤768px
- Check browser console (F12) for errors
- Hard refresh browser

## 📝 Quick Reference

**Push to GitHub:**
```powershell
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
git add .
git commit -m "Your message here"
git push origin main
```

**Add Database Columns (in Railway):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
```

**Check Deployment:**
- Railway → Your Project → Deployments → Latest should be "Active"

That's it! Your changes will be live in a few minutes! 🚀

