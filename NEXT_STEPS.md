# Next Steps: Finishing the Web App

## 🎯 First Priority: Verify Stripe Connect Onboarding Works

### Step 1: Test Stripe Connect Setup

**What to do:**
1. Log in as hustler account (one of your test accounts)
2. Go to Profile → Payment Setup
3. Click "Connect Stripe & Start Earning"

**What should happen:**
- ✅ Redirects to Stripe's onboarding page (not just profile page)
- ✅ Shows Stripe's form (even in test mode)
- ✅ Can complete with test data
- ✅ Redirects back to profile with success

**If it doesn't work:**
- Check Railway: `SKIP_STRIPE_CHECK` should NOT be set to `'true'`
- Check Railway: `STRIPE_SECRET_KEY` should be `sk_test_...` (test key)
- Check backend logs for errors

---

## 🎯 Second Priority: Test Payment Flow End-to-End

### Step 2: Test Flat Job Payment

**Setup:**
1. Customer account: Log in
2. Hustler account: Make sure Stripe is connected

**Test Flow:**
1. **Post a job** - $100 flat job
2. **Hustler applies** - Creates offer
3. **Customer accepts** - Payment popup should appear
4. **Enter test card** - `4242 4242 4242 4242`
5. **Payment authorized** - Status: PREAUTHORIZED
6. **Hustler starts job** - Enter start code
7. **Hustler completes** - Enter completion code
8. **Payment captured** - Customer charged, hustler paid

**Verify:**
- ✅ Payment popup appears when accepting offer
- ✅ PaymentIntent created in Stripe Dashboard
- ✅ Payment captured on completion
- ✅ Transfer to hustler appears
- ✅ Amounts match calculations

---

## 🎯 Third Priority: Test Hourly Job Flow

### Step 3: Test Hourly Job with Extensions

**Test Flow:**
1. **Post hourly job** - $50/hr × 3 hours
2. **Accept offer** - Authorizes $150 + fees
3. **Start job** - Timer begins
4. **Reach max hours** - Job should stop
5. **Extend hours** - Add 1 hour, new authorization
6. **Complete early** - Capture only actual hours

**Verify:**
- ✅ Max hours enforcement works
- ✅ Extension creates new PaymentIntent
- ✅ Partial capture works
- ✅ Unused authorization released

---

## 🎯 Fourth Priority: Fix Any Issues Found

### Step 4: Address Problems

**Common issues to check:**
- Payment popups not appearing
- Wrong amounts calculated
- Stripe errors
- Transfer failures
- Refund issues

---

## 📋 Quick Action Checklist

**Right Now:**
- [ ] Test Stripe Connect onboarding (hustler account)
- [ ] Verify it goes to Stripe's page (not just redirect)
- [ ] Complete onboarding with test data
- [ ] Verify account is connected

**Next:**
- [ ] Test flat job payment flow
- [ ] Verify payment popup appears
- [ ] Test with test card `4242 4242 4242 4242`
- [ ] Verify payment captured on completion
- [ ] Check Stripe Dashboard for PaymentIntent and Transfer

**Then:**
- [ ] Test hourly job flow
- [ ] Test max hours enforcement
- [ ] Test extensions
- [ ] Test partial capture

---

## 🔍 What to Check in Stripe Dashboard

**After each test:**
1. **Payments:** https://dashboard.stripe.com/test/payments
   - PaymentIntent created?
   - Status correct?
   - Amount matches?

2. **Connect Accounts:** https://dashboard.stripe.com/test/connect/accounts
   - Hustler account exists?
   - Onboarding complete?

3. **Transfers:** https://dashboard.stripe.com/test/connect/transfers
   - Transfer created after completion?
   - Amount correct?

---

## 🚨 If Something Doesn't Work

**Check:**
1. Backend logs (Railway logs)
2. Stripe Dashboard (test mode)
3. Browser console (frontend errors)
4. Network tab (API calls)

**Common fixes:**
- Stripe key wrong → Check Railway env vars
- Account not connected → Complete onboarding
- Payment fails → Use test card `4242 4242 4242 4242`
- Amounts wrong → Check fee calculations

---

## ✅ Success Criteria

**You're ready when:**
- ✅ Stripe Connect onboarding works
- ✅ Payment popups appear at right times
- ✅ Payments authorize correctly
- ✅ Payments capture on completion
- ✅ Transfers to hustlers work
- ✅ Hourly jobs work (partial capture)
- ✅ Extensions work
- ✅ Max hours enforcement works
- ✅ All amounts match Stripe Dashboard

---

**Start with Step 1: Test Stripe Connect onboarding. That's the foundation for everything else.**

