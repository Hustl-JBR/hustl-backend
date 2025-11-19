# ✅ Post-Deployment Checklist - What to Do Now

**Your app is live! Here's what to do next:**

---

## 🧪 Step 1: Test Your Live App

### 1.1 Get Your Railway URL
1. Go to Railway dashboard
2. Click on your project
3. Go to **"Settings"** → **"Domains"**
4. Copy your Railway URL: `https://your-app.railway.app`

### 1.2 Test Everything
Open your live URL and test:

**Basic Functionality:**
- [ ] Homepage loads correctly
- [ ] Can see job listings
- [ ] Navigation works (Home, Find Jobs, Post Job, Messages, Profile)

**User Accounts:**
- [ ] Can sign up (create new account)
- [ ] Can log in
- [ ] Can log out
- [ ] Can update profile

**Job Features:**
- [ ] Can post a job
- [ ] Can view job details
- [ ] Can apply for jobs (as hustler)
- [ ] Can accept offers (as customer)
- [ ] Can mark job as complete
- [ ] Can confirm completion with 6-digit code

**Messaging:**
- [ ] Can send messages
- [ ] Can receive messages
- [ ] Unread message badge works

**Reviews:**
- [ ] Can leave reviews after job completion
- [ ] Reviews show on profiles

**Mobile:**
- [ ] Test on phone or resize browser
- [ ] Hamburger menu works
- [ ] Everything looks good on mobile

---

## 🔐 Step 2: Verify Environment Variables

### 2.1 Check Railway Variables
1. Railway → Your Project → **"Variables"** tab
2. Make sure these are set:

**Required:**
- [ ] `DATABASE_URL` - Your Neon database connection string
- [ ] `JWT_SECRET` - Random secret string
- [ ] `PORT` - Should be `8080` (or Railway auto-sets it)
- [ ] `NODE_ENV` - Should be `production`

**If Using:**
- [ ] `STRIPE_SECRET_KEY` - For payments
- [ ] `STRIPE_PUBLISHABLE_KEY` - For payments
- [ ] `R2_ACCOUNT_ID` - For file uploads
- [ ] `R2_ACCESS_KEY_ID` - For file uploads
- [ ] `R2_SECRET_ACCESS_KEY` - For file uploads
- [ ] `R2_BUCKET_NAME` - For file uploads
- [ ] `MAPBOX_ACCESS_TOKEN` - For maps
- [ ] `RESEND_API_KEY` - For emails
- [ ] `APP_BASE_URL` - Your Railway URL

### 2.2 Update APP_BASE_URL
1. Get your Railway URL (from Step 1.1)
2. Railway → Variables
3. Set `APP_BASE_URL` to your Railway URL:
   ```
   APP_BASE_URL=https://your-app.railway.app
   ```
4. Railway will redeploy automatically

---

## 🗄️ Step 3: Verify Database

### 3.1 Check Database Connection
1. Railway → **"Deployments"** tab
2. Click latest deployment
3. Check **"Logs"** for database errors
4. Should see: "Database connected" or similar

### 3.2 Run Migrations (If Needed)
If you see database errors:

**Option A: Railway Dashboard**
1. Railway → Settings → Service
2. Look for "Run Command" or "Deploy Script"
3. Run: `npm run db:generate`
4. Then: `npm run db:migrate`

**Option B: Railway CLI**
```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Run migrations
railway run npm run db:generate
railway run npm run db:migrate
```

---

## 📧 Step 4: Test Email (If Using)

### 4.1 Test Email Sending
1. Sign up a new account
2. Check if you receive welcome email
3. Post a job and accept an offer
4. Check if notification emails work

### 4.2 Verify Resend Setup
- [ ] `RESEND_API_KEY` is set in Railway
- [ ] Resend account is verified
- [ ] Email domain is set up (if using custom domain)

---

## 💳 Step 5: Set Up Stripe (When Ready)

### 5.1 Test Mode (For Now)
1. Go to https://dashboard.stripe.com
2. Make sure you're in **"Test mode"**
3. Get test keys:
   - Secret key: `sk_test_...`
   - Publishable key: `pk_test_...`
4. Add to Railway variables

### 5.2 Test Payments
1. Create a test job
2. Accept an offer
3. Try to pay (use test card: `4242 4242 4242 4242`)
4. Verify payment flow works

### 5.3 Go Live (When Ready)
1. Complete Stripe account verification
2. Switch to **"Live mode"**
3. Get live keys
4. Update Railway variables
5. Update frontend code to use live keys
6. Test with real small payment

---

## 🌐 Step 6: Get Custom Domain (Optional but Recommended)

### 6.1 Buy Domain
1. Go to Namecheap.com (or similar)
2. Search for domain (e.g., `hustl.app`)
3. Buy it (~$10-20/year)

### 6.2 Connect to Railway
1. Railway → Settings → Domains
2. Click "Custom Domain"
3. Enter your domain
4. Add DNS records to Namecheap
5. Wait for SSL (automatic, 5-10 min)

### 6.3 Update APP_BASE_URL
Update to your custom domain:
```
APP_BASE_URL=https://yourdomain.com
```

**Full guide:** See `DOMAIN_SETUP.md`

---

## 📊 Step 7: Set Up Monitoring

### 7.1 Railway Monitoring
- Railway dashboard shows:
  - Deployment status
  - Logs in real-time
  - Resource usage
  - Errors

### 7.2 Set Up Alerts (Optional)
1. Railway → Settings → Notifications
2. Add email for:
   - Deployment failures
   - High resource usage
   - Errors

### 7.3 Check Logs Regularly
1. Railway → Deployments
2. Click latest deployment
3. Check "Logs" tab
4. Look for errors or warnings

---

## 🐛 Step 8: Common Issues to Watch For

### Issue: "Cannot connect to database"
**Fix:**
- Check `DATABASE_URL` is correct
- Verify database is running
- Check SSL mode: `?sslmode=require`

### Issue: "JWT secret missing"
**Fix:**
- Add `JWT_SECRET` to Railway variables
- Generate new secret if needed
- Redeploy

### Issue: "Port already in use"
**Fix:**
- Railway sets `PORT` automatically
- Use `process.env.PORT || 8080` in code
- Should already be set correctly

### Issue: "Module not found"
**Fix:**
- Check `package.json` has all dependencies
- Railway runs `npm install` automatically
- Check build logs

### Issue: "CORS errors"
**Fix:**
- Update `CORS_ORIGIN` in Railway variables
- Set to your Railway URL or `*` for testing

---

## ✅ Step 9: Pre-Launch Checklist

Before sharing with real users:

- [ ] All features tested on live site
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] Email sending works
- [ ] Payments work (test mode)
- [ ] No console errors
- [ ] Mobile responsive works
- [ ] Custom domain set up (optional)
- [ ] Terms & Privacy pages accessible
- [ ] Error handling works
- [ ] Logs are clean

---

## 🚀 Step 10: Go Live!

### 10.1 Share Your App
- Share your Railway URL (or custom domain)
- Test with a few friends first
- Get feedback

### 10.2 Monitor Closely
- Watch Railway logs
- Check for errors
- Monitor user signups
- Track job postings

### 10.3 Iterate
- Fix bugs as they come up
- Add features based on feedback
- Improve based on usage

---

## 📋 Quick Reference

### Your Live URLs:
- **Railway URL:** `https://your-app.railway.app`
- **Custom Domain:** `https://yourdomain.com` (if set up)

### Important Links:
- **Railway Dashboard:** https://railway.app
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Neon Database:** https://neon.tech
- **Resend (Email):** https://resend.com

### Update Your App:
1. Make changes locally
2. Test locally
3. Commit: `git commit -m "Your message"`
4. Push: `git push origin main`
5. Railway auto-deploys!

---

## 🎉 You're Live!

**Congratulations!** Your app is deployed and running.

**Next priorities:**
1. ✅ Test everything thoroughly
2. ✅ Set up custom domain (optional)
3. ✅ Get Stripe live mode ready
4. ✅ Start getting users
5. ✅ Monitor and improve

**Remember:**
- Railway auto-deploys on every push
- Check logs regularly
- Test before sharing widely
- Iterate based on feedback

**You're ready to grow! 🚀**


