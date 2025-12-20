# Exact Testing Steps - Payment Flow

## 🎯 Goal
Test a $100 flat job and verify:
- Customer pays: $106.50
- Hustler receives: $88.00
- Platform receives: $18.50

---

## 📋 Setup (Do This First)

### Account 1: Customer Account
- **Tab 1:** Logged in as customer
- **No Stripe Connect needed** (customers just pay)

### Account 2: Hustler Account  
- **Tab 2:** Logged in as hustler
- **Must connect Stripe Connect** (to receive payouts)

---

## ✅ Step 1: Connect Hustler Stripe Account

### In Tab 2 (Hustler Account):

1. **Go to:** Profile → Payment Setup
2. **Click:** "Connect Stripe & Start Earning"
3. **Should redirect to:** Stripe onboarding page (not just profile)

### Stripe Onboarding Form - Use This Test Data:

**Business Type:**
- Select: **Individual**

**Personal Info:**
- First Name: `John`
- Last Name: `Doe`
- Email: [Your hustler account email]
- Phone: `555-555-5555`
- Date of Birth: `01/01/1990`
- SSN: `123-45-6789` (any format works in test mode)

**Address:**
- Street: `123 Test Street`
- City: `Nashville`
- State: `Tennessee`
- ZIP: `37203`

**Bank Account (for payouts):**
- Account Type: **Checking**
- Account Number: `000123456789` (any numbers)
- Routing Number: `110000000` (Stripe test routing)
- Account Holder: `John Doe`

4. **Submit form**
5. **Should redirect back to:** Profile page with success

### Verify It Worked:
- Profile should show "Stripe Connected" or similar
- Or check: `GET /stripe-connect/status` should return `{ connected: true }`

**✅ Once connected, move to Step 2**

---

## ✅ Step 2: Post a Job (Customer)

### In Tab 1 (Customer Account):

1. **Click:** "Post a Job"
2. **Fill out:**
   - Title: `Test Payment Job`
   - Category: Any (e.g., "Handyman")
   - Description: `Testing payment flow`
   - Location: Set on map (anywhere in Tennessee)
   - Payment Type: **Flat amount**
   - Amount: **$100**
3. **Click:** "Post Job"
4. **Job created** - Status: `OPEN`

**✅ Job posted, move to Step 3**

---

## ✅ Step 3: Apply to Job (Hustler)

### In Tab 2 (Hustler Account):

1. **Find the job** you just posted
2. **Click:** "Apply" or "Make Offer"
3. **Offer created** - Status: `PENDING`

**✅ Offer created, move to Step 4**

---

## ✅ Step 4: Accept Offer & Pay (Customer)

### In Tab 1 (Customer Account):

1. **Go to:** Your posted job
2. **Click:** "Accept Offer" (or similar)
3. **PAYMENT POPUP SHOULD APPEAR** ← Critical!

### Payment Popup - Use This Test Card:

**Card Number:** `4242 4242 4242 4242`
**Expiry:** `12/25` (any future date)
**CVC:** `123` (any 3 digits)
**ZIP:** `12345` (any 5 digits)

4. **Enter card details**
5. **Click:** "Pay" or "Authorize Payment"

### Expected Result:
- ✅ Payment popup appears
- ✅ Payment succeeds
- ✅ Offer accepted
- ✅ Job status: `SCHEDULED`
- ✅ Start code generated

### Verify in Stripe Dashboard:
- Go to: https://dashboard.stripe.com/test/payments
- Find PaymentIntent
- **Amount:** $106.50 ($100 + $6.50 fee)
- **Status:** `requires_capture`

**✅ Payment authorized, move to Step 5**

---

## ✅ Step 5: Start Job (Hustler)

### In Tab 2 (Hustler Account):

1. **Get start code** from customer (or check job details)
2. **Enter start code**
3. **Job starts** - Status: `IN_PROGRESS`

### Expected:
- Job status: `IN_PROGRESS`
- Timer starts (if hourly)
- **NO payment change** - still PREAUTHORIZED

**✅ Job started, move to Step 6**

---

## ✅ Step 6: Complete Job (Hustler)

### In Tab 2 (Hustler Account):

1. **Get completion code** from customer (or check job details)
2. **Enter completion code**
3. **Job completes**

### Expected Result:
- ✅ Job status: `PAID`
- ✅ Payment captured
- ✅ Hustler receives payout
- ✅ Rating prompt appears

### Verify in Stripe Dashboard:

**1. PaymentIntent:**
- Go to: https://dashboard.stripe.com/test/payments
- Find your PaymentIntent
- **Status:** `succeeded`
- **Amount captured:** $106.50

**2. Transfer to Hustler:**
- Go to: https://dashboard.stripe.com/test/connect/transfers
- Find transfer to hustler's account
- **Amount:** $88.00 ($100 - 12%)

**3. Platform Balance:**
- Go to: https://dashboard.stripe.com/test/balance
- **You should see:** $18.50 added to your balance
  - $6.50 (customer fee)
  - $12.00 (platform fee)

**✅ Job completed, move to Step 7 (Optional Tip)**

---

## ✅ Step 7: Add Tip (Customer - Optional)

### In Tab 1 (Customer Account):

1. **After job completion**, rating prompt appears
2. **Look for:** "Add Tip" button or option
3. **Click:** "Add Tip"
4. **TIP POPUP SHOULD APPEAR** ← Separate popup

### Tip Popup:
- Enter tip amount: `$10.00` (or use percentage)
- **Use same test card:** `4242 4242 4242 4242`
- Submit

### Expected Result:
- ✅ Tip popup appears
- ✅ Tip charged separately
- ✅ Hustler receives $10.00 (100% of tip)
- ✅ Platform gets $0 from tip

### Verify in Stripe Dashboard:
- **New PaymentIntent** created for tip
- **Amount:** $10.00
- **Transfer to hustler:** $10.00 (100%)

**✅ Tip added (optional step)**

---

## 📊 What You Should See

### In Your Platform Stripe Account:

**Balance:**
- Customer fee: $6.50
- Platform fee: $12.00
- **Total: $18.50** ✅

### In Hustler's Stripe Account:

**Balance:**
- Job payout: $88.00
- Tip (if added): $10.00
- **Total: $98.00** (if tip added)

### In Customer's View:

**Charged:**
- Job: $106.50 ($100 + $6.50 fee)
- Tip (if added): $10.00
- **Total: $116.50** (if tip added)

---

## 🔍 Verification Checklist

After completing the job:

- [ ] PaymentIntent shows $106.50 captured
- [ ] Transfer to hustler shows $88.00
- [ ] Platform balance increased by $18.50
- [ ] Tip (if added) shows separate PaymentIntent
- [ ] Tip transfer shows $10.00 to hustler
- [ ] All amounts match calculations

---

## 🚨 If Something Doesn't Work

### Payment popup doesn't appear:
- Check browser console for errors
- Check Network tab - is `/payments/create-intent/offer/:offerId` called?
- Verify frontend payment integration

### Payment fails:
- Using test card `4242 4242 4242 4242`?
- Check Stripe Dashboard for error
- Check backend logs

### Wrong amounts:
- Check fee calculations (should be 6.5%)
- Check platform fee (should be 12% of job amount)
- Verify in Stripe Dashboard

### Transfer fails:
- Hustler has Stripe Connect connected?
- Check `stripeAccountId` in database
- Check backend logs

---

## 📝 Quick Reference

**Test Card:** `4242 4242 4242 4242`
- Expiry: `12/25`
- CVC: `123`
- ZIP: `12345`

**Stripe Dashboard:**
- Payments: https://dashboard.stripe.com/test/payments
- Transfers: https://dashboard.stripe.com/test/connect/transfers
- Balance: https://dashboard.stripe.com/test/balance

**Expected Amounts ($100 job):**
- Customer pays: $106.50
- Hustler gets: $88.00
- Platform gets: $18.50

---

**Follow these steps exactly. Start with Step 1 (Connect Stripe) and work through each step. Let me know what happens at each step!**

