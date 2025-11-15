# 🧪 Test Locally First - Step by Step

## Step 1: Run Database Migration

Add the `gender` and `bio` columns to your local database:

```powershell
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
npx prisma migrate dev --name add_gender_bio
```

**What this does:**
- Creates a migration file
- Adds `bio TEXT` and `gender VARCHAR(50)` columns to your `users` table
- Updates Prisma client

**If you get an error about columns already existing:**
- That's fine! The migration will handle it
- Or you can manually add them (see Step 1b below)

### Step 1b: Manual SQL (If Migration Doesn't Work)

If Prisma migrate doesn't work, you can add columns manually:

1. Connect to your database (Neon, Railway, or local PostgreSQL)
2. Run this SQL:
   ```sql
   ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
   ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
   ```

## Step 2: Generate Prisma Client

Make sure Prisma client is up to date:

```powershell
npx prisma generate
```

## Step 3: Start the Server

```powershell
npm run dev
```

**You should see:**
```
🚀 Hustl backend running at http://localhost:8080
📁 Serving static files from: ...
📱 Development mode - Access from your phone: http://[your-ip]:8080
```

## Step 4: Test in Browser

1. Open `http://localhost:8080` in your browser
2. **Hard refresh** (Ctrl+Shift+R) to clear cache
3. Create a test account:
   - Email: `test@local.com`
   - Password: `test123`
   - Role: Hustler (to test Stripe)
4. Go to **Profile** tab
5. **Check for Gender field:**
   - Should see a dropdown with: Select..., Male, Female, Other, Prefer not to say
6. **Test Stripe button:**
   - Click "Connect Stripe Account"
   - Check browser console (F12) for errors
   - If `SKIP_STRIPE_CHECK=true` in `.env`, it creates a fake account

## Step 5: Test Full Flow

### Test 1: Profile Updates
- [ ] Update name
- [ ] Update bio
- [ ] Select gender
- [ ] Click "Save Profile"
- [ ] Verify it saves (check console for errors)

### Test 2: Stripe Connection
- [ ] Click "Connect Stripe Account"
- [ ] Check for errors in console (F12)
- [ ] If test mode: Should create fake account
- [ ] If real mode: Should open Stripe onboarding

### Test 3: Create Job & Apply
- [ ] Create customer account
- [ ] Post a job ($10)
- [ ] Switch to hustler account
- [ ] Apply to job
- [ ] Switch back to customer
- [ ] Accept & pay (test card: `4242 4242 4242 4242`)

### Test 4: Job Completion
- [ ] Hustler marks job complete
- [ ] Get verification code
- [ ] Customer enters code
- [ ] Payment released

## Step 6: Check for Errors

**Browser Console (F12):**
- Look for red errors
- Share any errors you see

**Server Terminal:**
- Look for error messages
- Share any errors you see

## Common Issues

### Issue: "Cannot find module"
**Fix:** Run `npm install`

### Issue: "Database connection error"
**Fix:** Check `.env` file has correct `DATABASE_URL`

### Issue: "Port 8080 already in use"
**Fix:** 
- Change `PORT=3000` in `.env`
- Or stop whatever is using port 8080

### Issue: Gender field doesn't appear
**Fix:**
- Make sure migration ran successfully
- Check database has `bio` and `gender` columns
- Hard refresh browser (Ctrl+Shift+R)

### Issue: Stripe button doesn't work
**Fix:**
- Check browser console (F12) for errors
- Make sure you're logged in as a Hustler
- Check if `SKIP_STRIPE_CHECK` is set in `.env`

## Once Everything Works Locally

1. ✅ Test everything works
2. ✅ Fix any bugs
3. ✅ Then push to GitHub
4. ✅ Railway will auto-deploy
5. ✅ Run the same migration on Railway database

## Quick Commands Reference

```powershell
# Navigate to project
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend

# Run migration
npx prisma migrate dev --name add_gender_bio

# Generate Prisma client
npx prisma generate

# Start server
npm run dev

# Install dependencies (if needed)
npm install
```

Let's get it working locally! 🚀

