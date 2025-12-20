# Stripe Test Mode - End-to-End Testing Guide

## 🎯 Overview

This guide walks you through testing the complete payment system using Stripe test mode with fake users. All payments, transfers, and refunds are **100% fake** - no real money moves.

---

## 1️⃣ Stripe Test Mode Setup

### Verify Test Mode is Active

**Check Backend:**
- Look for log: `[STRIPE] Running in TEST MODE - All payments are fake`
- Verify `STRIPE_SECRET_KEY` starts with `sk_test_` in Railway

**Check Stripe Dashboard:**
- Go to: https://dashboard.stripe.com/test
- Toggle should show "Test mode" (not "Live mode")
- All test data appears here

**Test Cards Available:**
- ✅ Success: `4242 4242 4242 4242`
- ❌ Declined: `4000 0000 0000 0002`
- ❌ Insufficient funds: `4000 0000 0000 9995`
- Any future expiry (12/25), any CVC (123), any ZIP (12345)

---

## 2️⃣ Fake Users Setup

### Fake Customer Account

**Requirements:**
- Regular user account (no special setup needed)
- Will use test card: `4242 4242 4242 4242`

**Setup:**
1. Log in as customer account
2. No Stripe Connect needed (customers don't need it)
3. Ready to post jobs and pay

### Fake Hustler Account

**Requirements:**
- Separate user account
- Must connect Stripe Connect test account
- Must complete onboarding (test mode = instant)

**Setup Steps:**

1. **Log in as hustler account**

2. **Connect Stripe Account:**
   ```
   POST /stripe-connect/create-account
   Headers: { Authorization: "Bearer <hustler_token>" }
   ```

3. **Complete Onboarding:**
   ```
   GET /stripe-connect/onboarding-link
   Headers: { Authorization: "Bearer <hustler_token>" }
   ```
   - In test mode, this returns a fake success URL
   - Account is instantly ready (no real SSN/bank needed)

4. **Verify Connection:**
   ```
   GET /stripe-connect/status
   ```
   - Should return: `{ connected: true, accountId: "acct_test_xxx" }`

**Expected Result:**
- Hustler has `stripeAccountId` in database
- Can receive test payouts
- Shows as connected in UI

---

## 3️⃣ Flat Job Test Flow

### Step 1: Post Job

**Action:**
- Customer posts a flat job
- Amount: $100

**What Happens:**
- Job created with status: `OPEN`
- No payment yet

**Verify:**
- Job appears in job list
- Status: `OPEN`

---

### Step 2: Accept Offer

**Action:**
- Customer accepts hustler's offer
- Payment popup appears
- Enter test card: `4242 4242 4242 4242`

**What Happens:**
- Stripe PaymentIntent created
- Status: `PREAUTHORIZED` (not charged yet)
- Job status: `SCHEDULED`

**UI Popup Should Show:**
```
✅ Payment authorized
You will only be charged once the job is completed.
```

**Stripe Dashboard Check:**
- Go to: https://dashboard.stripe.com/test/payments
- Find PaymentIntent
- Status: `requires_capture`
- Amount: $113.00 ($100 + $3 customer fee + $10 tip if applicable)

**Verify in Database:**
```sql
SELECT status, amount FROM Payment WHERE jobId = '<job_id>';
-- Should show: status = 'PREAUTHORIZED', amount = 100
```

---

### Step 3: Start Job

**Action:**
- Hustler enters start code
- Job begins

**What Happens:**
- Job status: `IN_PROGRESS`
- Timer starts (if hourly)
- **NO payment change** - still PREAUTHORIZED

**Verify:**
- Job status: `IN_PROGRESS`
- Payment status: Still `PREAUTHORIZED`
- Stripe: PaymentIntent still `requires_capture`

**Important:**
- Customer can NO LONGER cancel/refund
- Job must be completed

---

### Step 4: Complete Job

**Action:**
- Hustler enters completion code
- Job marked complete

**What Happens:**
1. PaymentIntent is **CAPTURED** (customer charged)
2. Stripe transfer created for hustler
3. Payment status: `CAPTURED`
4. Job status: `PAID`

**UI Popup Should Show:**
```
✅ Job completed
Payment processed.
```

**Stripe Dashboard Check:**

1. **PaymentIntent:**
   - Status: `succeeded`
   - Amount captured: $113.00

2. **Transfer to Hustler:**
   - Go to: https://dashboard.stripe.com/test/connect/transfers
   - Find transfer to hustler's account
   - Amount: $88.00 ($100 - 12% platform fee)

**Verify in Database:**
```sql
SELECT status, amount, feeHustler FROM Payment WHERE jobId = '<job_id>';
-- Should show: status = 'CAPTURED', amount = 100, feeHustler = 12
```

**Post-Completion:**
- Rating prompt appears
- Optional tip (separate charge, 100% to hustler)

---

## 4️⃣ Hourly Job Test Flow

### Step 1: Post Hourly Job

**Action:**
- Customer posts hourly job
- Rate: $50/hr
- Max hours: 3

**What Happens:**
- Job created
- No payment yet

---

### Step 2: Accept Offer

**Action:**
- Customer accepts offer
- Payment popup appears
- Enter test card

**What Happens:**
- Stripe authorizes: $150 (max) + fees
- Status: `PREAUTHORIZED`
- Job status: `SCHEDULED`

**UI Popup Should Show:**
```
✅ Payment authorized for up to 3 hours
You'll only be charged for actual time worked.
```

**Stripe Dashboard Check:**
- PaymentIntent created
- Status: `requires_capture`
- Amount: $159.75 ($150 + 6.5% customer fee = $9.75)

**Note:** If using old system (3% fee), amount would be $154.50 ($150 + $3 + $1.50 tip)

---

### Step 3: Start Job

**Action:**
- Hustler enters start code
- Timer begins

**What Happens:**
- Job status: `IN_PROGRESS`
- Timer starts counting
- Payment still `PREAUTHORIZED`

---

### Step 4: Test Max Hours Enforcement

**Action:**
- Let timer run to exactly 3 hours
- Job should hard-stop

**What Happens:**
- Timer stops at 3.00 hours
- Job enters "Max Hours Reached" state
- Customer must choose: Extend or Complete

**UI Popup Should Show:**
```
⛔ Max hours reached
Extend job or complete.
```

**Verify:**
- Timer stops at 3.00 hours
- Cannot continue without customer action
- Job status: Still `IN_PROGRESS` (but time stopped)

---

## 5️⃣ Hourly Extension Test

### Extend Hours

**Action:**
- Customer clicks "Extend Hours"
- Adds 1-2 hours
- Payment popup appears

**What Happens:**
- New Stripe PaymentIntent created
- Authorizes additional amount
- Max hours updated

**UI Popup Should Show:**
```
✅ Hours extended
Payment authorization updated.
```

**Stripe Dashboard Check:**
- New PaymentIntent created
- Amount: $53.25 (1 hour) or $106.50 (2 hours)
- Status: `requires_capture`

**Verify:**
- Job `estHours` updated (3 → 4 or 5)
- Timer can continue
- Multiple PaymentIntents exist (original + extension)

---

## 6️⃣ Completion & Partial Charge Test

### Complete Job Early

**Action:**
- Complete job at 2.5 hours (before max)

**What Happens:**
1. PaymentIntent captures: $125.00 (2.5 × $50)
2. Unused authorization automatically released
3. Transfer to hustler: $110.00 ($125 - 12%)

**Stripe Dashboard Check:**

1. **Original PaymentIntent:**
   - Status: `succeeded`
   - Amount captured: $125.00 (partial)
   - Unused amount: $25.00 automatically released

2. **Transfer:**
   - Amount: $110.00
   - To: Hustler's test Connect account

**Verify in Database:**
```sql
SELECT amount, status FROM Payment WHERE jobId = '<job_id>';
-- Should show: amount = 125, status = 'CAPTURED'
```

**UI Should Show:**
```
✅ Job completed
Worked: 2.5 hours
Charged: $125.00
```

---

## 7️⃣ What to Verify in Stripe Dashboard

### PaymentIntents Tab
**URL:** https://dashboard.stripe.com/test/payments

**Check:**
- ✅ PaymentIntent created at offer acceptance
- ✅ Status: `requires_capture` → `succeeded`
- ✅ Amount matches UI (job amount + fees)
- ✅ Metadata shows jobId, customerId, hustlerId

### Transfers Tab
**URL:** https://dashboard.stripe.com/test/connect/transfers

**Check:**
- ✅ Transfer created after completion
- ✅ Amount: job amount - 12% platform fee
- ✅ Destination: Hustler's test Connect account
- ✅ Status: `paid` (in test mode, shows as paid but no real money)

### Connect Accounts Tab
**URL:** https://dashboard.stripe.com/test/connect/accounts

**Check:**
- ✅ Hustler test account exists
- ✅ Account type: Express
- ✅ Can view account balance (simulated)
- ✅ Can see payout history

### Refunds Tab
**URL:** https://dashboard.stripe.com/test/payments?status=refunded

**Check:**
- ✅ Unused authorization shows as released (for hourly jobs)
- ✅ Full refunds show if job cancelled before start

---

## 8️⃣ Failure Testing

### Test Declined Payment

**Action:**
- Try to accept offer with card: `4000 0000 0000 0002`

**Expected:**
- Payment fails
- UI shows error: "Your card was declined"
- Offer NOT accepted
- Job status: Still `OPEN`

**Verify:**
- No PaymentIntent created
- No payment record in database
- Customer can retry with different card

### Test Insufficient Funds

**Action:**
- Try with card: `4000 0000 0000 9995`

**Expected:**
- Payment fails
- Error: "Your card has insufficient funds"
- Offer NOT accepted

---

## 9️⃣ Testing Checklist

### Pre-Testing Setup
- [ ] Stripe test mode verified (sk_test_ key)
- [ ] Customer account ready
- [ ] Hustler account has Stripe Connect (test account)
- [ ] Both accounts logged in

### Flat Job Test
- [ ] Post $100 flat job
- [ ] Accept offer → PaymentIntent created (PREAUTHORIZED)
- [ ] Start job → No payment change
- [ ] Complete job → Payment captured, transfer created
- [ ] Verify amounts in Stripe match UI

### Hourly Job Test
- [ ] Post $50/hr × 3h job
- [ ] Accept offer → Authorizes $150 + fees
- [ ] Start job → Timer begins
- [ ] Reach max hours → Job stops
- [ ] Extend hours → New authorization created
- [ ] Complete early → Partial capture, unused released
- [ ] Verify amounts in Stripe match UI

### Failure Tests
- [ ] Declined card → Offer not accepted
- [ ] Insufficient funds → Error shown
- [ ] Can retry with good card

### Stripe Dashboard Verification
- [ ] All PaymentIntents visible
- [ ] All transfers visible
- [ ] All refunds/releases visible
- [ ] Amounts match database
- [ ] Metadata correct

---

## 🔟 Common Issues & Solutions

### Issue: "Payment not authorized"
**Solution:** Check PaymentIntent status in Stripe. Should be `requires_capture` before completion.

### Issue: "Transfer failed"
**Solution:** Verify hustler has connected Stripe account. Check `stripeAccountId` in database.

### Issue: "Amount mismatch"
**Solution:** Check fee calculations. Old system: 3% customer fee. New system: 6.5% customer fee.

### Issue: "Timer doesn't stop at max hours"
**Solution:** Check `GET /verification/job/:jobId/time-status` endpoint. Should return `timeStopped: true`.

---

## 📊 Expected Amounts (Old System - Commit 59b1449)

### Flat Job: $100
- **Authorized:** $113.00 ($100 + $3 fee + $10 tip)
- **Captured:** $113.00
- **Hustler gets:** $88.00 ($100 - 12%)
- **Platform keeps:** $12.00

### Hourly Job: $50/hr × 3h
- **Authorized:** $154.50 ($150 + $3 fee + $1.50 tip)
- **If worked 2.5h:**
  - **Captured:** $125.00
  - **Released:** $29.50 (unused)
  - **Hustler gets:** $110.00 ($125 - 12%)
  - **Platform keeps:** $15.00

---

## 🎯 Success Criteria

✅ All payments appear in Stripe Test Dashboard  
✅ All amounts match between UI and Stripe  
✅ Transfers appear in Connect accounts  
✅ Refunds/releases work correctly  
✅ Max hours enforcement works  
✅ Extensions create new authorizations  
✅ Failure cases handled gracefully  
✅ No real money moves (test mode only)

---

**Remember:** Everything in test mode is fake. Test thoroughly before switching to live mode!

