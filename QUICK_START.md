# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Install Dependencies
```bash
cd C:\Users\jbrea\OneDrive\Desktop\hustl-backend
npm install
```

### 2. Create .env File
```bash
# Copy the example
copy .env.example .env

# Then edit .env and add your API keys:
# - DATABASE_URL (from Neon)
# - STRIPE_SECRET_KEY (from Stripe)
# - MAPBOX_TOKEN (from Mapbox)
# - R2_* (from Cloudflare)
# - RESEND_API_KEY (from Resend)
# - JWT_SECRET (generate one)
```

### 3. Set Up Database
```bash
npm run db:generate
npm run db:migrate
```

### 4. Start Server
```bash
npm run dev
```

### 5. Open Browser
Go to: `http://localhost:8080`

## ✅ That's It!

Your app is now running. Try:
- Sign up for an account
- Post a job
- Browse jobs

## 📚 Need More Help?

- **Setup details**: See `SETUP.md`
- **Deployment**: See `DEPLOYMENT.md`
- **Backups**: See `BACKUP_GUIDE.md`
- **Project status**: See `PROJECT_STATUS.md`

## 🔧 Troubleshooting

**"Cannot find module" error?**
→ Run `npm install` again

**Database connection error?**
→ Check `DATABASE_URL` in `.env`

**Port already in use?**
→ Change `PORT=8080` to another port in `.env`

## 💾 Backups

Your folder is already in OneDrive, so it's automatically backed up! ✅

For additional backups:
- Push to GitHub (see `BACKUP_GUIDE.md`)
- Railway deployment (see `DEPLOYMENT.md`)




