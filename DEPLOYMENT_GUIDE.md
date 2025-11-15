# 🚀 Hustl Deployment Guide

## API Keys & Services Needed

### ✅ Already Set Up
- **Neon PostgreSQL Database** - Your data is being saved! ✅
- **Express Backend** - Running on port 8080
- **Prisma ORM** - Database management

### 🔑 Keys You Need to Get

1. **Stripe** (for payments)
   - Get from: https://dashboard.stripe.com/apikeys
   - Need: `STRIPE_SECRET_KEY` (starts with `sk_`)
   - Add to `.env` file

2. **Resend** (for emails - optional)
   - Get from: https://resend.com/api-keys
   - Need: `RESEND_API_KEY`
   - Add to `.env` file

3. **Cloudflare R2** (for image uploads - optional)
   - Get from: https://dash.cloudflare.com
   - Need: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`
   - Add to `.env` file

### 📝 Current .env File Setup

Create a `.env` file in the `backend` folder:

```env
# Database (Neon)
DATABASE_URL="your-neon-connection-string"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-here"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."

# Email (optional)
RESEND_API_KEY="re_..."

# R2 Storage (optional)
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="hustl-uploads"
R2_ENDPOINT="https://..."
R2_PUBLIC_URL="https://..."

# Server
PORT=8080
NODE_ENV=production
FRONTEND_BASE_URL="https://yourdomain.com"
```

## 🌐 Domain & Hosting

### When to Get a Domain
**Get a domain when you're ready to go live!** You can:
- Start with a free subdomain (like `hustl.vercel.app`)
- Or buy a domain now (like `hustl.com` from Namecheap, GoDaddy, etc.)

### Recommended Hosting Options

1. **Vercel** (Easiest - Free tier available)
   - Deploy frontend + backend together
   - Automatic HTTPS
   - Free subdomain: `your-app.vercel.app`

2. **Railway** (Good for full-stack)
   - Easy database connection
   - Auto-deploy from GitHub
   - ~$5/month

3. **Render** (Free tier available)
   - Free PostgreSQL database
   - Auto-deploy from GitHub
   - Free tier is slower but works

4. **Fly.io** (Good performance)
   - Global edge deployment
   - Free tier available

### Domain Setup Steps

1. **Buy domain** (Namecheap, GoDaddy, etc.)
2. **Point DNS to your host:**
   - Vercel: Add domain in dashboard, update DNS records
   - Railway: Add custom domain in settings
3. **Update `.env`:**
   - Set `FRONTEND_BASE_URL="https://yourdomain.com"`

## 💾 Database Status

**YES! All data is being saved to your Neon PostgreSQL database!**

- ✅ User accounts
- ✅ Jobs
- ✅ Offers/Applications
- ✅ Messages/Threads
- ✅ Payments (via Stripe)

Your Prisma schema defines all tables. Check `backend/prisma/schema.prisma` to see the structure.

## 📋 Pre-Launch Checklist

- [ ] Get Stripe API keys (test mode first!)
- [ ] Set up `.env` file with all keys
- [ ] Test payment flow in Stripe test mode
- [ ] Choose hosting platform
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Get domain (or use free subdomain)
- [ ] Point domain to hosting
- [ ] Test everything on live site
- [ ] Switch Stripe to live mode when ready
- [ ] Set up email notifications (optional)

## 🎯 Quick Start for Production

1. **Get your keys** (Stripe minimum)
2. **Update `.env`** with production values
3. **Deploy to Vercel/Railway/etc.**
4. **Point your domain**
5. **Test everything!**

## 📞 Need Help?

- Stripe: https://stripe.com/docs
- Neon: https://neon.tech/docs
- Vercel: https://vercel.com/docs

Your app is ready to go live once you have the API keys! 🎉



