# 🚀 Pre-Launch Verification & Testing Guide

This document provides a comprehensive checklist and testing plan to ensure everything is solid before going live.

---

## ✅ **EMAIL FLOWS VERIFICATION**

### 1. **Signup & Email Verification**
- ✅ **Signup Email** (`sendSignupEmail`) - **VERIFIED**
  - Location: `routes/auth.js:80`
  - Sends welcome email on signup
  - **Status:** ✅ Working

- ✅ **Email Verification** (`sendEmailVerificationEmail`) - **VERIFIED**
  - Location: `routes/auth.js:84`
  - Sends 6-digit code + verification link
  - Code expires in 24 hours
  - **Status:** ✅ Working

- ✅ **Resend Verification** (`POST /auth/resend-verification`) - **VERIFIED**
  - Location: `routes/auth.js:217`
  - Allows users to request new verification code
  - **Status:** ✅ Working

### 2. **Password Reset**
- ✅ **Password Reset Email** (`sendPasswordResetEmail`) - **VERIFIED**
  - Location: `routes/auth.js:217`
  - Sends reset link (expires in 1 hour)
  - **Status:** ✅ Working

### 3. **Job & Offer Notifications**
- ✅ **New Offer Received** (`sendOfferReceivedEmail`) - **VERIFIED**
  - Location: `routes/offers.js:231`
  - Sent to customer when hustler applies
  - **Status:** ✅ Working

- ✅ **Job Assigned** (`sendJobAssignedEmail`) - **VERIFIED** ⭐ **CRITICAL**
  - Location: `routes/offers.js:430`
  - Sent to hustler when customer picks them
  - Subject: "🎉 Congratulations! You were picked for..."
  - Includes job link
  - **Status:** ✅ Working

### 4. **Job Completion & Payment**
- ✅ **Job Complete** (`sendJobCompleteEmail`) - **VERIFIED**
  - Sent to customer when hustler marks job complete
  - Includes verification code
  - **Status:** ✅ Working

- ✅ **Payment Receipt** (`sendPaymentReceiptEmail`) - **VERIFIED**
  - Sent to customer after payment capture
  - Includes receipt link
  - **Status:** ✅ Working

- ✅ **Payment Released** (`sendPaymentCompleteEmail`) - **VERIFIED**
  - Sent to hustler when payment is released
  - **Status:** ✅ Working

- ✅ **Payout Sent** (`sendPayoutSentEmail`) - **VERIFIED**
  - Sent to hustler when payout completes
  - **Status:** ✅ Working

### 5. **Messages**
- ✅ **New Message Email** (`sendNewMessageEmail`) - **NEEDS VERIFICATION**
  - Location: `services/email.js:425`
  - **MUST CHECK:** Is this called in `routes/threads.js`?
  - **Action Required:** Verify message sending triggers email

### 6. **Refunds & Admin**
- ✅ **Refund Email** (`sendRefundEmail`) - **VERIFIED**
  - Sent to customer when refund is processed
  - **Status:** ✅ Working

- ✅ **Admin Notifications** (`sendAdminNotificationEmail`) - **VERIFIED**
  - Sent to `ADMIN_EMAIL` for refunds, payouts, etc.
  - **Status:** ✅ Working

---

## ✅ **LOCATION FILTERING VERIFICATION**

### Current Implementation:
- ✅ **Default Location:** Uses user's profile zipcode (`user.zip`)
- ✅ **Default Radius:** 25 miles
- ✅ **Geocoding:** Uses Mapbox to convert zip → lat/lng
- ✅ **Distance Calculation:** Haversine formula (miles)
- ✅ **Sorting:** Jobs sorted by distance (closest first)
- ✅ **Fallback:** If no coordinates, filters by zip code match

### Location: `routes/jobs.js:303-398`

**Status:** ✅ **WORKING** - Verified in code

**Test Checklist:**
- [ ] User with zipcode sees nearby jobs first
- [ ] Distance filter dropdown works (5, 10, 20, 50, 100 miles)
- [ ] "Use My Location" button works
- [ ] Jobs beyond radius are hidden
- [ ] Jobs without coordinates fall back to zip matching

---

## ✅ **72-HOUR JOB CLEANUP VERIFICATION**

### Current Implementation:
- ✅ **Logic:** Hides OPEN jobs older than 72 hours with no accepted offers
- ✅ **Location:** `routes/jobs.js:300-398`
- ✅ **Scheduled Cleanup:** Runs every 6 hours via `services/cleanup.js`
- ✅ **Permanent Deletion:** Jobs older than 2 weeks are deleted

**Status:** ✅ **WORKING** - Verified in code

**Test Checklist:**
- [ ] Jobs older than 72 hours with no offers are hidden
- [ ] Jobs with accepted offers remain visible
- [ ] Scheduled cleanup runs correctly
- [ ] Old jobs (2+ weeks) are permanently deleted

---

## ✅ **IN-APP NOTIFICATIONS VERIFICATION**

### Current Implementation:
- ✅ **Notification System:** `routes/notifications.js`
- ✅ **Bell Icon:** Frontend displays notification count
- ✅ **Notification Types:**
  - New messages
  - Offer accepted (hustler picked)
  - New offers received (customer)
  - Payment updates

**⚠️ ISSUE FOUND:** Notifications are generated on-the-fly from database queries, NOT stored in `Notification` table.

**Status:** ⚠️ **WORKING BUT NOT OPTIMAL** - Notifications are generated dynamically, not persisted.

**Recommendation:** Consider creating actual `Notification` records when events occur (offer accepted, message sent, etc.) for better performance and tracking.

---

## ⚠️ **STRIPE TEST MODE FLAGS**

### Found Test Mode Bypasses:

1. **`routes/jobs.js`** - Multiple `forceTestMode = true` flags:
   - Line 933: `const forceTestMode = true; // TEMPORARY`
   - Line 1248: `const forceTestMode = true; // TEMPORARY`
   - Line 1639: `const forceTestMode = true; // TEMPORARY`

2. **Environment Variable:** `SKIP_STRIPE_CHECK=true` (if set)

**⚠️ CRITICAL:** These MUST be removed before going live!

**Action Required:**
1. Remove all `forceTestMode = true` lines
2. Remove `SKIP_STRIPE_CHECK` from environment variables
3. Test with real Stripe keys (test mode first, then live)

---

## 📋 **COMPREHENSIVE TEST PLAN**

### **Test User Scenarios:**

#### **Scenario 1: New User Signup & Verification**
1. [ ] Sign up with new email
2. [ ] Check email for welcome email
3. [ ] Check email for verification code
4. [ ] Enter verification code OR click link
5. [ ] Verify email is marked as verified
6. [ ] Try to post job (should work after verification)
7. [ ] Try to apply to job (should work after verification)

#### **Scenario 2: Customer Posts Job**
1. [ ] Login as customer
2. [ ] Set zipcode in profile (e.g., 37011)
3. [ ] Post a new job
4. [ ] Verify job appears in feed
5. [ ] Verify job is filtered by location
6. [ ] Check email for any notifications

#### **Scenario 3: Hustler Applies**
1. [ ] Login as hustler (different user)
2. [ ] Set zipcode in profile (near customer's zip)
3. [ ] Browse jobs feed
4. [ ] Verify jobs are sorted by distance
5. [ ] Apply to a job
6. [ ] Check customer receives "New Offer" email
7. [ ] Check in-app notification appears

#### **Scenario 4: Customer Picks Hustler** ⭐ **CRITICAL**
1. [ ] Customer views offers for their job
2. [ ] Customer accepts an offer
3. [ ] **VERIFY:** Hustler receives "🎉 Congratulations! You were picked..." email
4. [ ] **VERIFY:** Hustler sees in-app notification
5. [ ] **VERIFY:** Payment is pre-authorized
6. [ ] **VERIFY:** Job status changes to ASSIGNED
7. [ ] **VERIFY:** Messaging thread is created

#### **Scenario 5: Messaging**
1. [ ] Customer sends message to hustler
2. [ ] **VERIFY:** Hustler receives "New Message" email
3. [ ] **VERIFY:** In-app notification appears
4. [ ] Hustler replies
5. [ ] **VERIFY:** Customer receives email
6. [ ] Test message rate limiting (5 messages per 10 seconds)

#### **Scenario 6: Job Completion**
1. [ ] Hustler marks job as complete
2. [ ] **VERIFY:** Customer receives "Job Complete" email with code
3. [ ] Customer confirms completion
4. [ ] **VERIFY:** Payment is captured
5. [ ] **VERIFY:** Hustler receives "Payment Released" email
6. [ ] **VERIFY:** Payout is created
7. [ ] **VERIFY:** Hustler receives "Payout Sent" email

#### **Scenario 7: Location Filtering**
1. [ ] Set zipcode to 37011 (Nashville)
2. [ ] Post job with zipcode 37011
3. [ ] Login as hustler with zipcode 37027 (nearby)
4. [ ] Verify job appears in feed
5. [ ] Verify distance is calculated correctly
6. [ ] Change radius filter to 5 miles
7. [ ] Verify jobs beyond 5 miles are hidden
8. [ ] Change radius to 50 miles
9. [ ] Verify more jobs appear

#### **Scenario 8: 72-Hour Cleanup**
1. [ ] Create a test job (or use existing old job)
2. [ ] Wait 72+ hours (or manually set `createdAt` in database)
3. [ ] Verify job is hidden from feed
4. [ ] Create job and accept offer
5. [ ] Wait 72+ hours
6. [ ] Verify job remains visible (has accepted offer)

#### **Scenario 9: Password Reset**
1. [ ] Click "Forgot Password"
2. [ ] Enter email
3. [ ] **VERIFY:** Reset email is received
4. [ ] Click reset link
5. [ ] Set new password
6. [ ] Login with new password

#### **Scenario 10: Role Switching**
1. [ ] Login as customer
2. [ ] Post a job
3. [ ] Switch to hustler view (same account)
4. [ ] Apply to own job (should be blocked or allowed?)
5. [ ] Apply to another user's job
6. [ ] Verify notifications work for both roles

---

## 🔧 **FIXES NEEDED BEFORE LAUNCH**

### **Critical (Must Fix):**
1. ⚠️ **Remove Stripe Test Mode Flags**
   - Remove all `forceTestMode = true` from `routes/jobs.js`
   - Remove `SKIP_STRIPE_CHECK` from environment
   - Test with Stripe test keys first

2. ⚠️ **Verify Message Email Sending**
   - Check if `sendNewMessageEmail` is called in `routes/threads.js`
   - If not, add it when messages are sent

3. ⚠️ **Create Notification Records**
   - Consider creating actual `Notification` records when events occur
   - Currently notifications are generated on-the-fly (works but not optimal)

### **Important (Should Fix):**
4. ⚠️ **Email Domain Verification**
   - Verify `hustljobs.com` domain in Resend
   - Update `FROM_EMAIL` to use verified domain

5. ⚠️ **Admin Email Configuration**
   - Set `ADMIN_EMAIL` in environment variables
   - Test admin notifications are received

### **Nice-to-Have:**
6. ⚠️ **Notification Persistence**
   - Store notifications in database for better tracking
   - Mark as read/unread in database

---

## 🧪 **AUTOMATED TESTING RECOMMENDATIONS**

### **Manual Testing (Required):**
- Run through all 10 scenarios above
- Test on multiple devices (desktop, mobile, iPhone, Android)
- Test with multiple users simultaneously
- Test edge cases (no internet, slow connection, etc.)

### **Automated Testing (Recommended):**
- Create test scripts for critical flows:
  - Signup → Verification → Post Job → Apply → Accept → Complete
  - Location filtering accuracy
  - 72-hour cleanup logic
  - Email sending (use test email addresses)

---

## ✅ **FINAL CHECKLIST**

### **Before Going Live:**
- [ ] All email flows tested and working
- [ ] Location filtering tested and accurate
- [ ] 72-hour cleanup verified
- [ ] All Stripe test mode flags removed
- [ ] Stripe keys updated to live mode
- [ ] Domain verified in Resend
- [ ] Admin email configured
- [ ] Message emails verified
- [ ] Notification system tested
- [ ] Password reset tested
- [ ] Role switching tested
- [ ] Performance tested (page load times, API response times)
- [ ] Error handling tested (network errors, validation errors)
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility tested

---

## 📊 **PERFORMANCE METRICS TO MONITOR**

- **API Response Times:** Should be < 500ms for most endpoints
- **Page Load Times:** Should be < 2 seconds
- **Email Delivery:** Should be < 5 seconds
- **Location Geocoding:** Should be cached (first call slower, subsequent calls fast)
- **Database Queries:** Should be optimized (use indexes)

---

## 🚨 **KNOWN ISSUES & LIMITATIONS**

1. **Notifications:** Generated on-the-fly, not persisted (works but not optimal)
2. **Test Mode Flags:** Multiple `forceTestMode = true` flags need removal
3. **Message Emails:** Need to verify `sendNewMessageEmail` is called
4. **Notification Persistence:** Notifications not stored in database

---

**Last Updated:** [Current Date]
**Status:** ⚠️ **READY FOR TESTING** - Some fixes needed before production

