# Payment Testing Checklist

## ✅ Current Status
- [x] SKIP_STRIPE_CHECK removed
- [x] Two accounts logged in (Customer + Hustler)
- [x] Everything working except payments
- [ ] Ready to test payments

---

## 🎯 Step 1: Setup Hustler Stripe Account

### Action:
1. In **Hustler tab**, go to Profile → Payment Setup
2. Click "Connect Stripe & Start Earning"

### Expected:
- Redirects to Stripe onboarding page
- Complete with test data (no real SSN/bank needed in test mode)
- Returns to profile with success

### Verify:
```bash
GET /stripe-connect/status
# Should return: { connected: true, accountId: "acct_test_xxx" }
```

**If this works → Move to Step 2**  
**If this fails → Check backend logs, verify STRIPE_SECRET_KEY is sk_test_...**

---

## 🎯 Step 2: Test Flat Job Payment Flow

### Setup:
- **Customer tab**: Ready to post job
- **Hustler tab**: Stripe connected

### Test Flow:

#### 2a. Post Job (Customer)
1. Post a **flat job** - $100
2. Job should appear in job list

#### 2b. Apply (Hustler)
1. Hustler applies to job
2. Offer created

#### 2c. Accept Offer (Customer)
1. Customer clicks "Accept Offer"
2. **PAYMENT POPUP SHOULD APPEAR** ← Critical step
3. Enter test card: `4242 4242 4242 4242`
   - Expiry: 12/25 (any future date)
   - CVC: 123 (any 3 digits)
   - ZIP: 12345 (any 5 digits)
4. Submit payment

### Expected Results:

**In UI:**
- ✅ Payment popup appears
- ✅ Payment succeeds
- ✅ Offer accepted
- ✅ Job status: SCHEDULED
- ✅ Start code generated

**In Stripe Dashboard:**
- Go to: https://dashboard.stripe.com/test/payments
- Find PaymentIntent
- Status: `requires_capture`
- Amount: $113.00 ($100 + $3 fee + $10 tip)

**In Backend:**
- Payment status: `PREAUTHORIZED`
- PaymentIntent created

### If Payment Popup Doesn't Appear:
- Check browser console for errors
- Check Network tab for API calls
- Verify frontend is calling `/payments/create-intent/offer/:offerId`

---

## 🎯 Step 3: Start Job (Hustler)

### Action:
1. Hustler enters **start code** (from customer)
2. Job begins

### Expected:
- Job status: `IN_PROGRESS`
- Timer starts (if hourly)
- **NO payment change** - still PREAUTHORIZED

### Verify:
- Payment status still: `PREAUTHORIZED`
- Stripe: PaymentIntent still `requires_capture`

---

## 🎯 Step 4: Complete Job (Hustler)

### Action:
1. Hustler enters **completion code** (from customer)
2. Job marked complete

### Expected Results:

**In UI:**
- ✅ Job status: PAID
- ✅ Payment processed message
- ✅ Rating prompt appears

**In Stripe Dashboard:**
1. **PaymentIntent:**
   - Status: `succeeded`
   - Amount captured: $113.00

2. **Transfer to Hustler:**
   - Go to: https://dashboard.stripe.com/test/connect/transfers
   - Find transfer to hustler's account
   - Amount: $88.00 ($100 - 12% platform fee)

**In Backend:**
- Payment status: `CAPTURED`
- Transfer created

---

## 🎯 Step 5: Test Hourly Job

### Setup:
- Post hourly job: $50/hr × 3 hours max

### Test Flow:

#### 5a. Accept Offer
- Authorizes: $154.50 ($150 + $3 fee + $1.50 tip)
- Status: PREAUTHORIZED

#### 5b. Start Job
- Timer begins
- Status: IN_PROGRESS

#### 5c. Test Max Hours
- Let timer reach 3.00 hours
- **Job should STOP automatically**
- Customer must extend or complete

#### 5d. Complete Early (2.5 hours)
- Hustler enters completion code
- Captures: $125.00 (2.5 × $50)
- Unused: $29.50 automatically released

### Verify:
- ✅ Partial capture works
- ✅ Unused authorization released
- ✅ Transfer amount: $110.00 ($125 - 12%)

---

## 🎯 Step 6: Test Extension

### Action:
1. Start hourly job
2. Reach near max hours (2.5 hours)
3. Customer extends by 1 hour
4. **New payment popup appears**
5. Enter test card again
6. Hours extended

### Expected:
- New PaymentIntent created
- Max hours updated (3 → 4)
- Timer can continue

---

## 🔍 Verification Checklist

After each test, verify:

### Stripe Dashboard:
- [ ] PaymentIntent created
- [ ] Status matches (requires_capture → succeeded)
- [ ] Amounts match UI
- [ ] Transfer created (after completion)
- [ ] Transfer amount correct

### Backend:
- [ ] Payment record created
- [ ] Status updates correctly
- [ ] Amounts match calculations
- [ ] Transfer succeeds

### UI:
- [ ] Payment popup appears
- [ ] Amounts displayed correctly
- [ ] Success/error messages clear
- [ ] Job status updates

---

## 🚨 Common Issues & Fixes

### Issue: Payment popup doesn't appear
**Check:**
- Frontend calling `/payments/create-intent/offer/:offerId`?
- Browser console errors?
- Network tab shows API call?

**Fix:**
- Verify frontend payment integration
- Check API endpoint returns `clientSecret`

### Issue: Payment fails
**Check:**
- Using test card `4242 4242 4242 4242`?
- Stripe key is `sk_test_...`?
- Backend logs show error?

**Fix:**
- Use correct test card
- Verify Stripe key in Railway

### Issue: Transfer fails
**Check:**
- Hustler has Stripe account connected?
- Account ID in database?
- Backend logs show error?

**Fix:**
- Complete Stripe Connect onboarding
- Verify `stripeAccountId` in user record

### Issue: Amounts don't match
**Check:**
- Fee calculations correct?
- Tips included?
- Platform fee 12%?

**Fix:**
- Verify payment calculation logic
- Check Stripe metadata

---

## 📊 Expected Amounts (Current System)

### Flat Job: $100
- **Authorized:** $113.00 ($100 + $3 fee + $10 tip)
- **Captured:** $113.00
- **Hustler gets:** $88.00 ($100 - 12%)
- **Platform keeps:** $12.00

### Hourly Job: $50/hr × 3h
- **Authorized:** $154.50 ($150 + $3 fee + $1.50 tip)
- **If worked 2.5h:**
  - **Captured:** $125.00
  - **Released:** $29.50
  - **Hustler gets:** $110.00 ($125 - 12%)
  - **Platform keeps:** $15.00

---

## ✅ Success Criteria

**You're done when:**
- ✅ Stripe Connect onboarding works
- ✅ Payment popup appears when accepting offer
- ✅ Payment authorizes correctly
- ✅ Payment captures on completion
- ✅ Transfer to hustler works
- ✅ Hourly jobs work (partial capture)
- ✅ Extensions work
- ✅ All amounts match Stripe Dashboard

---

**Start with Step 1: Setup Hustler Stripe Account. Then move through each step systematically.**

