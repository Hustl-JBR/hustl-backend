# 🚀 Exact Steps to Run - Step by Step

**Follow these steps exactly in order.**

---

## Step 1: Open Terminal/PowerShell

1. **Open VS Code** (or your code editor)
2. **Open Terminal** (View → Terminal, or press `` Ctrl + ` ``)
3. **Navigate to your project folder:**
   ```powershell
   cd "C:\Users\jbrea\OneDrive\Desktop\hustl-backend"
   ```

---

## Step 2: Run Database Migration (REQUIRED)

**This adds email verification fields to your database.**

### Option A: Using Railway CLI (Recommended)

1. **If you don't have Railway CLI installed:**
   ```powershell
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```powershell
   railway login
   ```

3. **Link your project:**
   ```powershell
   railway link
   ```
   (Select your project when prompted)

4. **Run the migration:**
   ```powershell
   railway run psql $DATABASE_URL -f migrations/add_email_verification.sql
   ```

---

### Option B: Using Direct Database Connection

1. **Get your database URL from Railway:**
   - Go to Railway Dashboard → Your Project → Variables
   - Copy the `DATABASE_URL` value

2. **Install psql (PostgreSQL client) if you don't have it:**
   - Download from: https://www.postgresql.org/download/windows/
   - Or use PostgreSQL installed on your system

3. **Run the migration:**
   ```powershell
   # Replace YOUR_DATABASE_URL with your actual DATABASE_URL from Railway
   psql "YOUR_DATABASE_URL" -f migrations/add_email_verification.sql
   ```

**Example:**
```powershell
psql "postgresql://user:password@host:port/database" -f migrations/add_email_verification.sql
```

---

### Option C: Using Node.js Script (Easiest - Use This!)

I'll create a script that runs the migration for you:

```powershell
# Just run this (it will use your DATABASE_URL from Railway or .env)
node scripts/run-migration.js
```

**Let me create this script for you...**

---

## Step 3: Clean Up Test Data (Optional but Recommended)

**This removes fake test users and jobs.**

1. **First, see what would be deleted (safe - just shows you):**
   ```powershell
   node scripts/cleanup-test-data.js --dry-run
   ```

2. **If that looks good, actually delete the test data:**
   ```powershell
   node scripts/cleanup-test-data.js
   ```
   (It will ask you to type "yes" to confirm)

---

## Step 4: Test Everything Works

**Test email verification:**

1. **Start your server:**
   ```powershell
   npm start
   ```
   (Or if you use `npm run dev`, use that)

2. **Create a new test account:**
   - Go to your app (http://localhost:8080)
   - Sign up with a new email
   - Check your email for verification code
   - Enter the code to verify

3. **Try posting a job:**
   - Should work after email verification
   - Should block you if email not verified

---

## Step 5: Push to GitHub

**Push all changes to GitHub:**

1. **Check what files changed:**
   ```powershell
   git status
   ```

2. **Add all changes:**
   ```powershell
   git add .
   ```

3. **Commit the changes:**
   ```powershell
   git commit -m "Add email verification, 72-hour cleanup, test data cleanup"
   ```

4. **Push to GitHub:**
   ```powershell
   git push
   ```

   **If using GitHub Desktop:**
   - Open GitHub Desktop
   - See all the changed files
   - Write commit message: "Add email verification, 72-hour cleanup, test data cleanup"
   - Click "Commit to main"
   - Click "Push origin"

---

## Step 6: Deploy to Railway

**Railway should auto-deploy when you push to GitHub!**

1. **Check Railway Dashboard:**
   - Go to https://railway.app
   - Your project should show "Deploying..." or "Success"
   - Wait for deployment to finish

2. **Verify deployment:**
   - Check Railway logs for errors
   - Test your live site at your domain

---

## 🆘 Troubleshooting

### "psql is not recognized"

**Solution: Install PostgreSQL or use Railway CLI**

**Option 1: Use Railway CLI (easier)**
```powershell
npm install -g @railway/cli
railway login
railway link
railway run psql $DATABASE_URL -f migrations/add_email_verification.sql
```

**Option 2: Use Node.js script (easiest)**
I'll create a Node.js script that runs the migration for you - no psql needed!

---

### "Cannot find module"

**Solution: Install dependencies**
```powershell
npm install
```

---

### "DATABASE_URL not found"

**Solution: Get it from Railway**
1. Go to Railway Dashboard
2. Your Project → Variables
3. Copy `DATABASE_URL`
4. Add to `.env` file:
   ```
   DATABASE_URL=your_database_url_here
   ```

---

### Migration already ran / Columns already exist

**This is fine!** The migration uses `IF NOT EXISTS` so it won't break if you run it twice.

---

## 📋 Quick Checklist

- [ ] Navigate to project folder in terminal
- [ ] Run database migration (Step 2)
- [ ] Clean up test data (Step 3) - optional
- [ ] Test email verification works (Step 4)
- [ ] Push to GitHub (Step 5)
- [ ] Verify Railway auto-deployed (Step 6)

---

## 🎯 Recommended Order

1. **Run migration** (required before email verification works)
2. **Clean up test data** (recommended before going live)
3. **Test everything** (make sure it works)
4. **Push to GitHub** (Railway will auto-deploy)

---

**Let me know if you need help with any step!** 🚀

