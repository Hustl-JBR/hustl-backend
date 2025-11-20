# End-to-End Verification Guide

This guide ensures the app runs like a normal app with all features working correctly and data flowing properly.

## ✅ Pre-Flight Checklist

### 1. Environment Variables (Railway)

**Required Variables:**
```env
# Database
DATABASE_URL=postgresql://...

# JWT Auth
JWT_SECRET=your-secret-key

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SKIP_STRIPE_CHECK=true  # Set to false when switching to live

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET=hustl-uploads
R2_PUBLIC_BASE=https://uploads.hustljobs.com  # OR https://pub-xxxxx.r2.dev

# Email (Resend)
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@hustljobs.com

# Mapbox
MAPBOX_TOKEN=pk.eyJ...

# App URLs
APP_BASE_URL=https://hustljobs.com
FRONTEND_BASE_URL=https://hustljobs.com

# Cleanup
JOB_CLEANUP_HOURS=48

# Email Verification (optional for now)
REQUIRE_EMAIL_VERIFICATION=false
```

### 2. Database Schema

**Verify these fields exist:**
- `users.emailVerified` (optional, can add later)
- `jobs.requirements` (JSON field for archive status)
- `jobs.status` (JobStatus enum)

**Run migrations if needed:**
```sql
-- Check if emailVerified exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'emailVerified';

-- If missing, add it (optional):
ALTER TABLE users ADD COLUMN "emailVerified" BOOLEAN DEFAULT false;
```

## 🧪 End-to-End Test Flow

### Test 1: Signup & Email Verification

1. **Go to website:** `https://hustljobs.com`
2. **Click "Sign Up"**
3. **Fill form:**
   - Name: Test User
   - Email: test@example.com
   - Username: testuser
   - Password: Test123!
   - Location: 37011 (Nashville, TN)
4. **Click "Sign Up"**
5. **Verify:**
   - ✅ Success message appears
   - ✅ User is logged in automatically
   - ✅ Email verification code is sent (check logs/resend dashboard)

### Test 2: Post a Job

1. **Switch to Customer mode** (if not already)
2. **Click "Create Job"**
3. **Fill job form:**
   - Title: "Test Moving Job"
   - Category: Moving
   - Description: "Need help moving furniture"
   - Location: Enter address + zip (37011)
   - Date: Tomorrow
   - Time: 10:00 AM - 2:00 PM
   - Payment: Flat rate $100
   - Upload a photo (optional)
4. **Click "Post Job"**
5. **Verify:**
   - ✅ Job appears in "My Jobs" tab
   - ✅ Job appears in main job feed
   - ✅ Photo uploads to R2 and displays correctly
   - ✅ Job has correct status (OPEN)

### Test 3: Apply as Hustler

1. **Switch to Hustler mode**
2. **Find the test job in feed**
3. **Click "View Job"**
4. **Click "Apply as Hustler"**
5. **Fill application:**
   - Message: "I have experience with moving"
   - (Optional) Propose different amount
6. **Click "Apply"**
7. **Verify:**
   - ✅ Application submitted
   - ✅ Job shows "1 applicant" badge
   - ✅ Customer receives notification

### Test 4: Accept Hustler

1. **Switch back to Customer mode**
2. **Go to job details**
3. **View applications**
4. **Click "Pay & Accept" for a hustler**
5. **Complete Stripe payment** (test mode)
6. **Verify:**
   - ✅ Payment succeeds
   - ✅ Job status changes to ASSIGNED
   - ✅ Hustler receives "YOU'RE HIRED!" notification
   - ✅ Email sent to hustler
   - ✅ Start code generated for customer

### Test 5: Complete Job Flow

1. **As Hustler:**
   - View assigned job
   - Click "Start Job" (enter 4-digit code from customer)
   - Work on job
   - Click "Mark Job as Complete"
   - ✅ Verification code appears (6-digit)
   - ✅ Code modal displays

2. **As Customer:**
   - View job details
   - See "Job marked as complete"
   - Enter 6-digit verification code
   - ✅ Green check animation appears
   - ✅ Payment automatically released to hustler
   - ✅ Review modal appears automatically

3. **Verify:**
   - ✅ Job status = COMPLETED
   - ✅ Payment captured from customer
   - ✅ Payout sent to hustler's Stripe account
   - ✅ Emails sent (job complete, payment released)

### Test 6: Messaging

1. **As Customer or Hustler:**
   - Go to Messages
   - Click on a conversation
   - Send a message
2. **Verify:**
   - ✅ Message appears instantly
   - ✅ Profile photos show in bubbles
   - ✅ Timestamps display correctly
   - ✅ Other user receives notification

### Test 7: Profile Photo Upload

1. **Go to Profile**
2. **Click camera icon on avatar**
3. **Select image file**
4. **Verify:**
   - ✅ Loading spinner appears
   - ✅ Upload progress shows
   - ✅ Photo displays immediately after upload
   - ✅ Photo appears in:
     - Profile page
     - Job cards
     - Message bubbles
     - Job details

### Test 8: Job Filtering & Location

1. **As Hustler:**
   - Enter zip code: 37011
   - Set radius: 10 miles
   - Apply filters (Near Me, Newest, etc.)
2. **Verify:**
   - ✅ Jobs sorted by distance/date/pay correctly
   - ✅ Only Tennessee jobs shown
   - ✅ Jobs outside radius filtered out
   - ✅ "Filters Applied" label updates

### Test 9: Job Archive & Delete

1. **Go to Profile → "Jobs you posted"**
2. **Click "Archive" on an OPEN job**
3. **Verify:**
   - ✅ Job disappears from feed
   - ✅ Job still accessible in profile (with unarchive option)
   - ✅ Job doesn't show in public feed

4. **For OPEN jobs only:**
   - Click "Delete"
   - Confirm deletion
   - ✅ Job permanently deleted

### Test 10: Mobile Experience

1. **Open on iPhone/Samsung**
2. **Test bottom navigation:**
   - ✅ All tabs accessible
   - ✅ No overlap with footer
   - ✅ Active state highlights correctly

3. **Test location popup:**
   - ✅ "Use My Location" works
   - ✅ ZIP input accepts 5 digits
   - ✅ Radius slider updates smoothly

4. **Test job cards:**
   - ✅ Cards are large enough to tap
   - ✅ "View Job" button works
   - ✅ Swipe gestures work (if implemented)

5. **Test job details:**
   - ✅ One-scroll layout
   - ✅ Back button works
   - ✅ Map preview loads
   - ✅ Photo carousel scrolls horizontally
   - ✅ "Get Directions" opens Maps app

## 🔍 Data Flow Verification

### R2 File Storage

**Test Upload:**
```bash
# Check if R2 upload endpoint works
curl -X POST https://hustljobs.com/r2/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg"
```

**Verify:**
- ✅ Response includes `publicUrl`
- ✅ URL is accessible (returns image)
- ✅ URL uses `R2_PUBLIC_BASE` domain
- ✅ Image displays correctly in app

**Check R2 Dashboard:**
- Go to Cloudflare Dashboard → R2
- Verify `hustl-uploads` bucket exists
- Check files are being uploaded to `uploads/` folder
- Monitor storage usage and requests

### Database Queries

**Check job cleanup:**
```sql
-- Check for old OPEN jobs (should be CANCELLED by cleanup)
SELECT id, title, status, "createdAt" 
FROM jobs 
WHERE status = 'OPEN' 
AND "createdAt" < NOW() - INTERVAL '48 hours'
LIMIT 10;

-- Check for archived jobs
SELECT id, title, requirements->>'archived' as archived
FROM jobs
WHERE requirements->>'archived' = 'true'
LIMIT 10;
```

**Check user jobs:**
```sql
-- Verify /my-jobs endpoint would return correct data
SELECT id, title, "customerId", "hustlerId", status
FROM jobs
WHERE "customerId" = 'USER_ID' OR "hustlerId" = 'USER_ID'
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Email Delivery

**Check Resend Dashboard:**
- Go to https://resend.com/dashboard
- Verify emails are being sent:
  - ✅ Signup confirmation
  - ✅ Email verification codes
  - ✅ Job assigned notifications
  - ✅ Payment released notifications

**Test Email Domain:**
- Check `FROM_EMAIL` is verified in Resend
- Verify domain authentication (DKIM/SPF) is set up

### Stripe Integration

**Check Stripe Dashboard:**
- Go to https://dashboard.stripe.com/test/payments
- Verify payments are being created
- Check webhooks are being received

**Test Payment Flow:**
1. Accept a hustler for a job
2. Complete payment
3. Verify in Stripe Dashboard:
   - ✅ Payment intent created
   - ✅ Payment captured
   - ✅ Transfer created to hustler's account

## 🚨 Common Issues & Fixes

### Issue: "Failed to upload file" error

**Fix:**
1. Check R2 credentials in Railway env vars
2. Verify bucket exists and is public
3. Check `R2_PUBLIC_BASE` is correct URL
4. Test R2 upload endpoint directly

### Issue: Images not loading after upload

**Fix:**
1. Check `R2_PUBLIC_BASE` includes `https://`
2. Verify public access is enabled on bucket
3. Check CORS settings in R2
4. Verify DNS has propagated (if using custom domain)

### Issue: Jobs not appearing in feed

**Fix:**
1. Check job status is OPEN (not CANCELLED)
2. Verify job is not archived (`requirements.archived !== true`)
3. Check job date is in the future (or flexible)
4. Verify location filters aren't too strict

### Issue: "Too many requests" error

**Fix:**
1. Check rate limit settings in `server.js`
2. Verify requests aren't being duplicated
3. Check for infinite loops in polling
4. Consider increasing rate limits if needed

### Issue: Profile photo doesn't update

**Fix:**
1. Check R2 upload succeeded
2. Verify `photoUrl` is saved to database
3. Check cache-busting query parameter
4. Hard refresh browser (Ctrl+Shift+R)

## 📊 Performance Checks

### Database Performance

**Check slow queries:**
```sql
-- Check for missing indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('jobs', 'users', 'offers');

-- Check query performance
EXPLAIN ANALYZE 
SELECT * FROM jobs 
WHERE status = 'OPEN' 
AND "createdAt" > NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC 
LIMIT 20;
```

### API Performance

**Check response times:**
- `/jobs` endpoint should return in < 500ms
- `/jobs/my-jobs` should return in < 200ms
- `/offers/user/me` should return in < 200ms
- `/r2/upload` should complete in < 2s for small images

### Frontend Performance

**Check loading speeds:**
- Initial page load: < 2s
- Job feed renders: < 1s
- Profile page loads: < 1s
- Image lazy loading works correctly

## 🎯 Production Readiness Checklist

### Before Going Live:

- [ ] All environment variables set in Railway
- [ ] R2 bucket created and configured
- [ ] Stripe account verified and connected
- [ ] Resend email domain verified
- [ ] Database migrations run
- [ ] Test data cleaned up
- [ ] Rate limits tested and adjusted
- [ ] Error handling tested
- [ ] Mobile experience tested
- [ ] End-to-end flow tested (signup → post → apply → accept → complete → pay)
- [ ] Email delivery verified
- [ ] File uploads working
- [ ] Location filtering working
- [ ] Job cleanup scheduled
- [ ] Monitoring/logging set up

### Switch to Live Mode:

1. **Update Stripe keys:**
   - Change `STRIPE_SECRET_KEY` to live key
   - Change `STRIPE_PUBLISHABLE_KEY` to live key
   - Update `SKIP_STRIPE_CHECK` to `false`
   - Set webhook secret for live mode

2. **Update app URLs:**
   - Set `APP_BASE_URL` to `https://hustljobs.com`
   - Set `FRONTEND_BASE_URL` to `https://hustljobs.com`

3. **Test with real payment:**
   - Post a job with real customer account
   - Accept hustler
   - Complete payment (small amount)
   - Verify payout to hustler

4. **Monitor:**
   - Check Railway logs for errors
   - Monitor Stripe dashboard
   - Check Resend dashboard for email delivery
   - Monitor R2 usage

## 🔄 Daily Operations

### Automated Tasks:

1. **Job Cleanup** (runs every 2 hours):
   - Cancels OPEN jobs older than 48h with no accepted offers
   - Deletes all jobs older than 2 weeks

2. **Email Notifications** (real-time):
   - Signup confirmations
   - Job assigned
   - Payment released
   - Verification codes

3. **Payment Processing** (real-time):
   - Payment capture on job completion
   - Automatic payout to hustler

### Manual Tasks:

- Monitor for spam/junk jobs
- Handle customer support requests
- Review flagged messages
- Process refunds if needed (via admin panel)

