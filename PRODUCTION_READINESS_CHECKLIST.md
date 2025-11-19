# 🚀 Production Readiness Checklist - Go Live

**You're almost ready!** Here's what's working and what needs to be implemented/fixed before launch.

---

## ✅ What's Already Working

### Email Flows (Mostly Complete)
- ✅ **Signup confirmation email** - Working (sendSignupEmail)
- ✅ **Password reset email** - Working (sendPasswordResetEmail)
- ✅ **Email notifications for messages** - Working (sendNewMessageEmail)
- ✅ **Email notifications for job updates** - Working:
  - Job assigned (sendJobAssignedEmail)
  - Job complete (sendJobCompleteEmail with verification code)
  - Payment success (sendPaymentReceiptEmail)
  - Payout sent (sendPayoutSentEmail)

### Core Features
- ✅ **Job posting** - Working
- ✅ **Offers system** - Working
- ✅ **Payment flow** - Working (test mode)
- ✅ **Reviews/feedback system** - Working
- ✅ **6-digit verification code** - Working (for job completion)
- ✅ **UI fixes** - Recently completed (modal, profile photo, map links)

---

## ❌ What's Missing or Needs Fixing

### 🔴 Critical (Must Fix Before Launch)

#### 1. Email Verification (Signup)
**Status:** ❌ NOT IMPLEMENTED

**What you need:**
- Users should verify their email after signup (6-digit code OR verification link)
- Block users from posting jobs/applying until email is verified

**Current state:**
- Signup email is sent, but no verification required
- Users can use the app immediately without verifying email

**Implementation needed:**
- Add `emailVerified` boolean field to User model (or check Prisma schema)
- Add email verification endpoint: `POST /auth/verify-email`
- Generate 6-digit verification code or token
- Send verification email with code/link
- Require email verification before allowing job actions

**Files to update:**
- `routes/auth.js` - Add verify endpoint
- `services/email.js` - Add sendVerificationEmail function
- `public/index.html` - Add verification UI after signup
- `prisma/schema.prisma` - Add emailVerified field if missing

---

#### 2. Auto-Remove Jobs After 72 Hours
**Status:** ❌ NOT IMPLEMENTED

**What you need:**
- Jobs that sit for 72 hours without any offers accepted should be automatically removed/hidden from the feed

**Current state:**
- Jobs stay in feed indefinitely until manually cancelled
- No auto-cleanup system

**Implementation needed:**
- Create a scheduled job/cron task that runs daily
- Find jobs with status `OPEN` that are 72+ hours old with no accepted offers
- Either:
  - Hide them (set status to `EXPIRED` or add `isHidden` flag)
  - Or cancel them automatically (set status to `CANCELLED`)

**Files to create/update:**
- `scripts/cleanup-old-jobs.js` - Daily cleanup script
- `routes/jobs.js` - Filter out expired jobs from listings
- `prisma/schema.prisma` - Add `EXPIRED` status if needed

**Options:**
- **Option A:** Use Railway cron job (e.g., cron-job.org, GitHub Actions)
- **Option B:** Add cleanup on job listing endpoint (check age on every request)
- **Option C:** Use a background job library (node-cron, Bull, etc.)

---

#### 3. Stripe Live Mode Setup
**Status:** ⚠️ IN TEST MODE (needs switching)

**What you need:**
- Switch from test mode to live mode
- Remove all test mode bypasses
- Test with real payments (small amounts first)

**Current state:**
- Code has `SKIP_STRIPE_CHECK=true` and `forceTestMode = true` flags
- Stripe is bypassed for testing
- All payment flows are fake

**Implementation needed:**
1. **Remove test mode flags:**
   - Remove `SKIP_STRIPE_CHECK` from Railway environment variables
   - Remove `forceTestMode = true` from code:
     - `routes/jobs.js` (lines 721, 1002, 1358)
     - `routes/payments.js` (line 227)
     - `routes/offers.js` (line 321)
     - `routes/reviews.js` (line 43)
     - `routes/stripe-connect.js` (lines 30, 85)

2. **Switch to live keys:**
   - Get live Stripe keys from Stripe Dashboard
   - Update Railway variables:
     - `STRIPE_SECRET_KEY` → `sk_live_...` (not `sk_test_...`)
     - `STRIPE_PUBLISHABLE_KEY` → `pk_live_...` (not `pk_test_...`)

3. **Test with small amounts:**
   - Create test customer account
   - Create test hustler account
   - Complete Stripe Connect onboarding (live mode)
   - Post a $1-5 job
   - Complete full flow end-to-end
   - Verify payment goes through
   - Verify payout to hustler works

**Files to update:**
- `routes/jobs.js` - Remove `forceTestMode` flags
- `routes/payments.js` - Remove `forceTestMode` flag
- `routes/offers.js` - Remove `forceTestMode` flag
- `routes/reviews.js` - Remove `forceTestMode` flag
- `routes/stripe-connect.js` - Remove test mode bypasses
- Railway Dashboard → Variables → Update Stripe keys

---

### 🟡 Important (Should Fix Soon)

#### 4. Email Domain Verification
**Status:** ⚠️ PARTIAL

**What you need:**
- Verify your domain (`hustljobs.com`) in Resend
- Update `FROM_EMAIL` to use your domain

**Current state:**
- Using default Resend email (`noreply@hustl.app` or similar)
- May be in spam folder

**Fix:**
1. Go to Resend Dashboard → Domains
2. Add `hustljobs.com`
3. Add DNS records (SPF, DKIM) in Namecheap
4. Wait for verification (usually 5-10 minutes)
5. Update Railway variable:
   ```
   FROM_EMAIL=Hustl Jobs <noreply@hustljobs.com>
   ```

**Files to update:**
- Railway Dashboard → Variables → `FROM_EMAIL`
- No code changes needed (already using env var)

---

#### 5. Admin Panel
**Status:** ❓ NEEDS CLARIFICATION

**What you asked:**
- "Do we need an admin thing like you said?"

**Current state:**
- Owner view exists (accessible via `?owner=true` or burger menu)
- Owner can mark payouts done, view all jobs
- No full admin panel with moderation, user management, etc.

**Recommendation:**
- **MVP Launch:** Owner view is sufficient for now
- **Future:** Build full admin panel with:
  - User management (ban, unban, view profiles)
  - Job moderation (edit, hide, cancel)
  - Review moderation (hide, delete)
  - Dispute resolution
  - Refund management
  - Analytics dashboard

**For now:** Owner view should be enough. You can manage critical issues manually.

---

### 🟢 Nice to Have (Can Add Later)

#### 6. Performance Optimization
**Status:** ⚠️ NEEDS TESTING

**What you asked:**
- "Smooth flow, clear screens, snappy/quick responses when you click things"

**Current state:**
- UI was recently cleaned up
- May need performance testing under load

**Recommendation:**
- Test on real devices (iPhone, Android)
- Check network performance (slow 3G, 4G)
- Optimize image loading if needed
- Add loading states where missing
- Consider lazy loading for job lists

---

## 📋 Implementation Priority

### Before Launch (Critical)
1. ✅ **Email verification** - Add 6-digit code or link verification
2. ✅ **72-hour job cleanup** - Auto-hide/remove old jobs
3. ✅ **Stripe live mode** - Switch to live keys, remove test mode

### Week 1 Post-Launch (Important)
4. ✅ **Email domain verification** - Verify domain in Resend
5. ✅ **Monitor payments** - Watch for any Stripe errors
6. ✅ **Test email delivery** - Make sure emails aren't going to spam

### Month 1 (Nice to Have)
7. ✅ **Admin panel** - Build full admin dashboard
8. ✅ **Performance optimization** - Speed up slow areas
9. ✅ **Analytics** - Add basic tracking (PostHog, Google Analytics)

---

## 🔧 Quick Implementation Guides

### 1. Email Verification (Quick Implementation)

**Step 1:** Add field to User model (if not exists):
```prisma
// In prisma/schema.prisma
model User {
  // ... existing fields
  emailVerified Boolean @default(false) @map("email_verified")
}
```

**Step 2:** Create verification endpoint:
```javascript
// In routes/auth.js
router.post('/verify-email', authenticate, [
  body('code').trim().notEmpty(),
], async (req, res) => {
  // Check verification code matches
  // Update user.emailVerified = true
  // Return success
});
```

**Step 3:** Update signup to send verification code:
```javascript
// In routes/auth.js (signup route)
// Generate 6-digit code
const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
// Store in user record or separate table
// Send email with code
await sendVerificationEmail(user.email, user.name, verificationCode);
```

**Step 4:** Add UI in frontend:
```javascript
// In public/index.html
// After signup success, show verification modal
// User enters 6-digit code
// Call verify endpoint
```

---

### 2. 72-Hour Job Cleanup (Quick Implementation)

**Option A: Filter on listing (Easiest)**
```javascript
// In routes/jobs.js (GET /jobs endpoint)
const where = {
  status: 'OPEN',
  createdAt: {
    gte: new Date(Date.now() - 72 * 60 * 60 * 1000), // Only jobs from last 72 hours
  },
  // ... other filters
};
```

**Option B: Scheduled cleanup (Recommended)**
```javascript
// Create scripts/cleanup-old-jobs.js
const prisma = require('../db');

async function cleanupOldJobs() {
  const cutoffDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
  
  const oldJobs = await prisma.job.findMany({
    where: {
      status: 'OPEN',
      createdAt: { lt: cutoffDate },
      offers: {
        none: { status: 'ACCEPTED' }
      }
    }
  });

  // Hide or cancel them
  for (const job of oldJobs) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'CANCELLED' } // Or add isHidden: true
    });
  }
  
  console.log(`Cleaned up ${oldJobs.length} old jobs`);
}

cleanupOldJobs();
```

**Then run daily via:**
- Railway cron job
- GitHub Actions (daily workflow)
- External service (cron-job.org)

---

### 3. Stripe Live Mode (Step-by-Step)

**Step 1:** Get live keys from Stripe:
1. Go to https://dashboard.stripe.com
2. Click "Live mode" toggle (top right)
3. Go to Developers → API keys
4. Copy:
   - Secret key: `sk_live_...`
   - Publishable key: `pk_live_...`

**Step 2:** Update Railway variables:
1. Railway Dashboard → Your Project → Variables
2. Update:
   - `STRIPE_SECRET_KEY` → `sk_live_...`
   - `STRIPE_PUBLISHABLE_KEY` → `pk_live_...` (if used)
3. **Remove:**
   - `SKIP_STRIPE_CHECK` (delete this variable entirely)

**Step 3:** Remove test mode flags from code:
1. Search for `forceTestMode` in all files
2. Remove or set to `false`
3. Search for `SKIP_STRIPE_CHECK` checks
4. Remove test mode bypasses

**Step 4:** Test with small amount:
1. Create test accounts (customer + hustler)
2. Complete Stripe Connect onboarding (live mode)
3. Post a $1-5 job
4. Complete full flow
5. Verify payment captured
6. Verify payout sent

---

## ✅ Final Pre-Launch Checklist

### Code
- [ ] Email verification implemented and tested
- [ ] 72-hour job cleanup implemented
- [ ] All test mode flags removed
- [ ] Stripe live keys configured
- [ ] All environment variables set in Railway

### Testing
- [ ] Signup flow works (with email verification)
- [ ] Email verification code received and works
- [ ] Jobs auto-removed after 72 hours (tested)
- [ ] Payment flow works with live Stripe
- [ ] Payout flow works with live Stripe
- [ ] Email notifications received (check spam folder)
- [ ] UI is responsive and fast
- [ ] All features work on mobile (iPhone, Android)

### Business
- [ ] Domain connected (`hustljobs.com`)
- [ ] Email domain verified in Resend
- [ ] Stripe Connect onboarding tested
- [ ] Terms & Privacy pages reviewed
- [ ] Support email set up (`team@hustljobs.com` or similar)

### Monitoring
- [ ] Error logging set up (check Railway logs)
- [ ] Payment monitoring (watch Stripe dashboard)
- [ ] Email delivery monitoring (check Resend dashboard)
- [ ] Backup plan if something breaks

---

## 🚀 Launch Day Steps

1. **Final Code Push:**
   - Push all fixes to GitHub
   - Verify Railway auto-deploys
   - Check Railway logs for errors

2. **Final Testing:**
   - Test signup flow (with email verification)
   - Test job posting
   - Test payment flow (small amount)
   - Test email notifications

3. **Go Live:**
   - Announce to initial users
   - Monitor closely for first 24 hours
   - Be ready to fix issues quickly

4. **Post-Launch:**
   - Watch Stripe dashboard for payments
   - Check Railway logs for errors
   - Monitor user feedback
   - Fix critical issues immediately

---

## 📞 Support & Resources

**Stripe Support:**
- https://support.stripe.com
- Live chat available in dashboard

**Railway Support:**
- https://docs.railway.app
- Discord: https://discord.gg/railway

**Resend Support:**
- https://resend.com/docs
- Email: support@resend.com

---

## 💡 Pro Tips

1. **Start Small:**
   - Launch with a few test users first
   - Gradually expand
   - Fix issues before scaling

2. **Monitor Closely:**
   - Watch Stripe dashboard daily
   - Check Railway logs regularly
   - Set up alerts if possible

3. **Have Backup Plan:**
   - Know how to quickly switch back to test mode if needed
   - Have support email ready
   - Be ready to pause if critical issues arise

4. **Test Everything:**
   - Don't skip testing
   - Test with real accounts (not just test accounts)
   - Test on real devices

---

## 🎯 Summary

**Critical (Do Before Launch):**
1. Email verification (6-digit code or link)
2. 72-hour job auto-cleanup
3. Stripe live mode (remove test flags, use live keys)

**Important (Do Soon):**
4. Email domain verification
5. Admin panel (owner view is enough for now)

**Nice to Have (Can Add Later):**
6. Performance optimization
7. Full admin panel
8. Analytics

**You're close!** Just need to implement the 3 critical items above, then you're ready to launch! 🚀

---

**Estimated Time to Production Ready:**
- Email verification: 2-3 hours
- 72-hour cleanup: 1-2 hours
- Stripe live mode: 1 hour
- Testing: 2-3 hours
- **Total: ~6-9 hours of work**

