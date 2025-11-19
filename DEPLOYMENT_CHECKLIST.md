# 🚀 Deployment Checklist

## Phase 1: Deploy to Railway (Testing)

### Step 1: Commit & Push to GitHub ✅
- [ ] Stage all changes: `git add .`
- [ ] Commit: `git commit -m "Pre-launch: All features verified and ready"`
- [ ] Push to GitHub: `git push`

### Step 2: Deploy to Railway
- [ ] Connect GitHub repo to Railway (if not already)
- [ ] Railway auto-deploys on push (or manually trigger)
- [ ] Check deployment logs for errors
- [ ] Verify app is live: `https://your-app.railway.app`

### Step 3: Configure Environment Variables in Railway
Make sure these are set:
- [ ] `DATABASE_URL` - Neon PostgreSQL connection string
- [ ] `JWT_SECRET` - Random secret key
- [ ] `STRIPE_SECRET_KEY` - Stripe test key (for now)
- [ ] `STRIPE_PUBLISHABLE_KEY` - Stripe test publishable key
- [ ] `RESEND_API_KEY` - Resend API key
- [ ] `FROM_EMAIL` - `Hustl <noreply@hustl.app>` (or your domain)
- [ ] `APP_BASE_URL` - Your Railway URL (e.g., `https://your-app.railway.app`)
- [ ] `FRONTEND_BASE_URL` - Same as APP_BASE_URL
- [ ] `MAPBOX_TOKEN` - Mapbox API token
- [ ] `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- [ ] `R2_ACCESS_KEY_ID` - R2 access key
- [ ] `R2_SECRET_ACCESS_KEY` - R2 secret key
- [ ] `R2_BUCKET` - R2 bucket name
- [ ] `R2_PUBLIC_BASE` - R2 public URL
- [ ] `FEEDBACK_EMAIL` - Email for feedback submissions
- [ ] `ADMIN_EMAIL` - Your admin email (optional)
- [ ] `SKIP_STRIPE_CHECK=true` - Keep this for testing
- [ ] `NODE_ENV=production`

### Step 4: Test Everything on Railway
Test all critical flows:

#### Authentication
- [ ] Sign up with new email
- [ ] Receive welcome email
- [ ] Receive verification email with code
- [ ] Verify email (enter code or click link)
- [ ] Login works
- [ ] Password reset works

#### Job Posting
- [ ] Login as customer
- [ ] Set zipcode in profile
- [ ] Post a new job
- [ ] Job appears in feed
- [ ] Job is filtered by location

#### Job Application
- [ ] Login as hustler (different account)
- [ ] Set zipcode in profile
- [ ] Browse jobs feed
- [ ] Jobs are sorted by distance
- [ ] Apply to a job
- [ ] Customer receives "New Offer" email

#### Job Assignment ⭐
- [ ] Customer accepts offer
- [ ] Hustler receives "🎉 Congratulations! You were picked..." email
- [ ] Hustler sees in-app notification
- [ ] Payment is pre-authorized
- [ ] Job status changes to ASSIGNED
- [ ] Messaging thread created

#### Messaging
- [ ] Customer sends message
- [ ] Hustler receives email notification
- [ ] Hustler sees in-app notification
- [ ] Hustler replies
- [ ] Customer receives email

#### Job Completion
- [ ] Hustler marks job complete
- [ ] Customer receives "Job Complete" email
- [ ] Customer confirms completion
- [ ] Payment is captured (test mode)
- [ ] Hustler receives "Payment Released" email
- [ ] Payout created

#### Location Filtering
- [ ] Set zipcode in profile
- [ ] Post job with zipcode
- [ ] Login as different user with nearby zipcode
- [ ] Verify jobs appear sorted by distance
- [ ] Test radius filter (5, 10, 20, 50, 100 miles)
- [ ] Jobs beyond radius are hidden

#### 72-Hour Cleanup
- [ ] Create test job
- [ ] Verify old jobs (72+ hours, no offers) are hidden
- [ ] Verify jobs with accepted offers remain visible

### Step 5: Verify Email Domain
- [ ] Check Resend dashboard
- [ ] Verify domain is configured (if using custom domain)
- [ ] Test emails are being delivered
- [ ] Check spam folder if emails not received

---

## Phase 2: Finalize for Production

### Step 6: Add LLC Information
- [ ] Add LLC name to footer/about page
- [ ] Add business address
- [ ] Update Terms of Service
- [ ] Update Privacy Policy
- [ ] Add business registration info (if needed)

### Step 7: Remove Stripe Test Flags
- [ ] Open `routes/jobs.js`
- [ ] Remove line 933: `const forceTestMode = true;`
- [ ] Remove line 1248: `const forceTestMode = true;`
- [ ] Remove line 1639: `const forceTestMode = true;`
- [ ] Update conditions: `if (!skipStripeCheck && !forceTestMode)` → `if (!skipStripeCheck)`
- [ ] Commit: `git commit -m "Remove Stripe test mode flags for production"`
- [ ] Push to GitHub

### Step 8: Switch Stripe to Live Mode
- [ ] Get live Stripe keys from Stripe Dashboard
- [ ] Update `STRIPE_SECRET_KEY` in Railway (use live key)
- [ ] Update `STRIPE_PUBLISHABLE_KEY` in Railway (use live key)
- [ ] Remove `SKIP_STRIPE_CHECK` from Railway environment
- [ ] Verify Stripe webhook endpoint is set up
- [ ] Test with small real payment first

### Step 9: Final Production Testing
- [ ] Test full payment flow with live Stripe
- [ ] Test refund flow
- [ ] Test payout flow
- [ ] Verify all emails are received
- [ ] Test on mobile devices
- [ ] Test on different browsers
- [ ] Monitor logs for errors

### Step 10: Go Live! 🎉
- [ ] Announce launch
- [ ] Monitor closely for first few days
- [ ] Watch for any errors in logs
- [ ] Check user feedback
- [ ] Monitor payment processing
- [ ] Monitor email delivery rates

---

## Quick Commands

### Git Commands
```bash
# Stage all changes
git add .

# Commit
git commit -m "Pre-launch: All features verified and ready"

# Push to GitHub
git push
```

### Railway Commands (if using CLI)
```bash
# Login to Railway
railway login

# Link project
railway link

# Deploy
railway up
```

---

## Troubleshooting

### If deployment fails:
1. Check Railway logs
2. Verify all environment variables are set
3. Check database connection
4. Verify API keys are correct

### If emails aren't sending:
1. Check Resend dashboard
2. Verify `RESEND_API_KEY` is correct
3. Check `FROM_EMAIL` is valid
4. Check spam folder

### If payments fail:
1. Verify Stripe keys are correct
2. Check Stripe dashboard for errors
3. Verify webhook is set up
4. Check `SKIP_STRIPE_CHECK` is removed (after Phase 2)

---

## Post-Launch Monitoring

### Daily Checks (First Week):
- [ ] Check error logs
- [ ] Monitor email delivery
- [ ] Monitor payment processing
- [ ] Check user feedback
- [ ] Monitor performance metrics

### Weekly Checks (First Month):
- [ ] Review user registrations
- [ ] Review job postings
- [ ] Review payment stats
- [ ] Check for any issues
- [ ] Gather user feedback

---

**Good luck with the launch! 🚀**

