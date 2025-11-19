# 🚀 How to Use make-admin.js Script

## ⚡ EASIEST Method - Use the Script I Created!

I've created a script called `make-admin.js` that makes this super easy!

### Step 1: Edit the Script

1. Open `make-admin.js` in your code editor
2. Find line 8:
   ```javascript
   const yourEmail = 'your-email@example.com';
   ```
3. Change it to your actual email:
   ```javascript
   const yourEmail = 'your-actual-email@example.com';
   ```
4. Save the file

### Step 2: Get Your Production Database URL

**From Railway:**
1. Go to: https://railway.app
2. Click on your **Hustl project**
3. Click on your **database service** (Postgres/Neon)
4. Click **Variables** tab
5. Find `DATABASE_URL` (or `POSTGRES_URL` or similar)
6. **Copy the entire connection string**
   - Looks like: `postgresql://user:pass@host:port/dbname?sslmode=require`

### Step 3: Run the Script

**Option A: Set DATABASE_URL and Run (Recommended)**

Open PowerShell in your project folder:

```powershell
# Navigate to project
cd "c:\Users\jbrea\OneDrive\Desktop\hustl-backend"

# Set DATABASE_URL (replace with your actual connection string)
$env:DATABASE_URL="postgresql://user:pass@host:port/dbname?sslmode=require"

# Run the script
node make-admin.js
```

**Option B: Use .env File**

1. Make sure your `.env` file has `DATABASE_URL` set to your production database
2. Run:
   ```powershell
   cd "c:\Users\jbrea\OneDrive\Desktop\hustl-backend"
   node make-admin.js
   ```

### Step 4: Check Results

You should see:
```
✅ SUCCESS! User is now admin:
   Email: your-email@example.com
   Roles: [ 'ADMIN' ]
```

### Step 5: Test Admin Access

1. **Log out** of your production website
2. **Log back in** (to refresh your session)
3. Go to: `https://hustljobs.com/admin.html`
4. You should see the admin dashboard! 🎉

---

## 🔧 Troubleshooting

### Error: "Please edit this file..."
- **Fix:** You forgot to change the email! Edit line 8 in `make-admin.js`

### Error: "User not found"
- **Fix:** Check your email address - make sure it matches exactly what you used to sign up

### Error: "Database connection error"
- **Fix:** 
  1. Make sure `DATABASE_URL` is set correctly
  2. Get it from Railway → Database → Variables
  3. Make sure it's the production database URL (not local)

### Error: "Cannot find module '@prisma/client'"
- **Fix:** Run `npm install` first:
  ```powershell
  npm install
  ```

---

## 📝 Quick Reference

**File to edit:** `make-admin.js` (line 8 - change email)

**Command to run:**
```powershell
cd "c:\Users\jbrea\OneDrive\Desktop\hustl-backend"
$env:DATABASE_URL="your-database-url-here"
node make-admin.js
```

**Verify it worked:**
1. Log out and back in
2. Go to: `https://hustljobs.com/admin.html`

---

**That's it! Much easier than finding SQL in Railway! 🎉**

