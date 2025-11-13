# 🚀 Step-by-Step Setup Guide

Follow these steps in order. I've completed all the code, so you just need to set up accounts and add API keys.

---

## STEP 0: Install Node.js First! ⚠️

**If you get "npm is not recognized" error, you need to install Node.js first!**

See **`INSTALL_NODEJS.md`** for instructions.

Once Node.js is installed, come back here and continue.

---

## STEP 0.5: Fix PowerShell (If Needed) ⚠️

**If you get "running scripts is disabled" error:**

**Option 1: Use Command Prompt instead** (Easiest!)
- Press `Windows Key + R`
- Type: `cmd` and press Enter
- Use Command Prompt instead of PowerShell (npm works there)

**Option 2: Fix PowerShell** (See `FIX_POWERSHELL.md` for details)
- Run PowerShell as Administrator
- Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
- Type `Y` and press Enter

---

## STEP 1: Install Dependencies (2 minutes)

**Make sure Node.js is installed first!** (See Step 0 above)

Open PowerShell, Command Prompt, or Terminal and run:

```powershell
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
npm install
```

**Wait for it to finish** (might take 2-3 minutes)

---

## STEP 2: Create .env File (1 minute)

1. In your folder, you should see `.env.example`
2. **Copy it** and rename to `.env`
   - Right-click `.env.example` → Copy
   - Right-click → Paste
   - Rename the copy to `.env`

Or in PowerShell:
```bash
copy .env.example .env
```

---

## STEP 3: Get API Keys (15-20 minutes)

You need to sign up for these services and get API keys. I'll walk you through each one:

### 3A. Neon Database (Postgres) - FREE

1. Go to: https://neon.tech
2. Click "Sign Up" (use GitHub or email)
3. Click "Create Project"
4. Name it: `hustl`
5. Click "Create Project"
6. **Copy the connection string** (looks like: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
7. Paste it in your `.env` file as `DATABASE_URL=`

**Time:** ~3 minutes

---

### 3B. Stripe (Payments) - FREE for testing

1. Go to: https://stripe.com
2. Click "Sign up"
3. Create account
4. Go to: https://dashboard.stripe.com/test/apikeys
5. **Copy "Secret key"** (starts with `sk_test_`)
6. Paste in `.env` as `STRIPE_SECRET_KEY=`
7. **Webhook secret** - we'll get this later (leave blank for now)

**Time:** ~5 minutes

---

### 3C. Mapbox (Maps/Geocoding) - FREE tier

1. Go to: https://mapbox.com
2. Click "Sign up"
3. Create account
4. Go to: https://account.mapbox.com/access-tokens/
5. **Copy "Default public token"** (starts with `pk.`)
6. Paste in `.env` as `MAPBOX_TOKEN=`

**Time:** ~3 minutes

---

### 3D. Cloudflare R2 (File Storage) - FREE tier

1. Go to: https://cloudflare.com
2. Sign up / Log in
3. Go to: R2 → Create bucket
4. Name it: `hustl-uploads`
5. Go to: Manage R2 API Tokens
6. Create API token with R2 permissions
7. **Copy:**
   - Account ID → `R2_ACCOUNT_ID=`
   - Access Key ID → `R2_ACCESS_KEY_ID=`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY=`
8. Set `R2_BUCKET=hustl-uploads`
9. `R2_PUBLIC_BASE` - leave blank for now (optional)

**Time:** ~5 minutes

---

### 3E. Resend (Email) - FREE tier

1. Go to: https://resend.com
2. Sign up
3. Go to: API Keys
4. Create API key
5. **Copy the key** (starts with `re_`)
6. Paste in `.env` as `RESEND_API_KEY=`

**Time:** ~3 minutes

---

### 3F. Generate JWT Secret (30 seconds)

Open PowerShell and run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copy the long string** it outputs and paste in `.env` as:
```
JWT_SECRET=paste-the-long-string-here
```

---

## STEP 4: Fill in .env File

Open `.env` in Notepad and fill in all the values you just collected:

```env
DATABASE_URL=postgresql://... (from Neon)
STRIPE_SECRET_KEY=sk_test_... (from Stripe)
STRIPE_WEBHOOK_SECRET= (leave blank for now)
MAPBOX_TOKEN=pk.... (from Mapbox)
R2_ACCOUNT_ID=... (from Cloudflare)
R2_ACCESS_KEY_ID=... (from Cloudflare)
R2_SECRET_ACCESS_KEY=... (from Cloudflare)
R2_BUCKET=hustl-uploads
R2_PUBLIC_BASE= (leave blank)
RESEND_API_KEY=re_... (from Resend)
PORT=8080
APP_BASE_URL=http://localhost:8080
NODE_ENV=development
JWT_SECRET=... (the long string you generated)
```

**Save the file!**

---

## STEP 5: Set Up Database (2 minutes)

Run these commands:

```bash
npm run db:generate
npm run db:migrate
```

The first command generates the database client.
The second creates all the tables in your Neon database.

**Wait for both to finish!**

---

## STEP 6: Start the Server (30 seconds)

```bash
npm run dev
```

You should see:
```
🚀 Hustl backend running at http://localhost:8080
📁 Serving static files from: ...
```

---

## STEP 7: Test It! (1 minute)

1. Open your browser
2. Go to: http://localhost:8080
3. You should see your Hustl app!
4. Try signing up for an account
5. Try posting a job

---

## ✅ You're Done!

Your app is now running locally with:
- ✅ Real database (Neon Postgres)
- ✅ Real payments (Stripe)
- ✅ Real maps (Mapbox)
- ✅ Real file storage (R2)
- ✅ Real emails (Resend)

---

## 🐛 Troubleshooting

**"Cannot find module" error?**
→ Run `npm install` again

**"Database connection failed"?**
→ Check your `DATABASE_URL` in `.env` (make sure it has `?sslmode=require` at the end)

**"Port 8080 already in use"?**
→ Change `PORT=8080` to `PORT=3000` in `.env` and restart

**"Prisma error"?**
→ Run `npm run db:generate` again

---

## 📝 Next Steps (After Testing)

1. **Push to GitHub** (see `BACKUP_GUIDE.md`)
2. **Deploy to Railway** (see `DEPLOYMENT.md`)
3. **Set up Stripe webhook** (after deployment)

---

## 💾 Backups

Your folder is already in OneDrive, so it's automatically backed up! ✅

For code version control, push to GitHub (see `BACKUP_GUIDE.md`).

---

**Need help?** Check:
- `SETUP.md` - More detailed setup
- `DEPLOYMENT.md` - Railway deployment
- `BACKUP_GUIDE.md` - Backup options

