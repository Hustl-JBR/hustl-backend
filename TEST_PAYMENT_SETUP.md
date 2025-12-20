# Testing Payment Flow - Quick Guide

## Who Needs What

### Customer (Posts Jobs)
- **No Stripe account needed** ✅
- Just uses test card: `4242 4242 4242 4242`
- Any expiration date, any CVC
- Pays when accepting offer

### Hustler (Does Work)
- **Needs Stripe Connect account** ✅
- This is the test account you just created
- Receives payouts after job completion

## Test Account Setup

You created a test Stripe Connect account: `acct_1SgY71HRWG8aWOgM`

### Option 1: Use the Account You Just Created

1. **Link it to your hustler user:**
   - Go to your database or use an admin endpoint
   - Update the hustler user's `stripeAccountId` to: `acct_1SgY71HRWG8aWOgM`
   - Or wait for the app to automatically link it (if you completed onboarding through the app)

2. **Check if it's linked:**
   - Go to Profile → Payment Setup
   - Should show "Account Connected" (if frontend is updated)
   - Or check `/stripe-connect/status` endpoint

### Option 2: Create New Account Through App

1. **Log in as hustler** in the Hustl app
2. **Go to Profile → Payment Setup**
3. **Click "Connect Stripe"**
4. **Complete Stripe onboarding** (use test data)
5. **Account will be automatically linked**

## Testing the Full Payment Flow

### Step 1: Post a Job (Customer Account)
- Log in as **customer**
- Post a job ($100 flat or $50/hr)
- **No Stripe account needed** - customer just pays with card

### Step 2: Apply to Job (Hustler Account)
- Log in as **hustler** (with Stripe connected)
- Apply to the job
- Send an offer

### Step 3: Accept Offer (Customer Account)
- Customer accepts offer
- **Payment popup should appear** (if frontend is implemented)
- Enter test card: `4242 4242 4242 4242`
- Payment authorized (not charged yet)

### Step 4: Start Job (Hustler Account)
- Hustler enters start code
- Job begins
- Timer starts (for hourly jobs)

### Step 5: Complete Job (Hustler Account)
- Hustler enters completion code
- Payment captured from customer
- **Transfer sent to hustler's Stripe account** (minus 12% fee)
- Hustler receives payout

## What to Check in Stripe Dashboard

1. **Payment Intents:**
   - Should see payment intent created when offer accepted
   - Status: `requires_capture` (authorized, not charged)
   - After completion: Status: `succeeded` (charged)

2. **Transfers:**
   - Should see transfer to hustler's connected account
   - Amount: Job amount minus 12% platform fee

3. **Connected Account:**
   - Go to Connected Accounts → Your test account
   - Should see balance increase after job completion
   - Payout will happen automatically (daily/weekly schedule)

## Quick Test Checklist

- [ ] Customer posts job
- [ ] Hustler applies (has Stripe connected)
- [ ] Customer accepts offer (payment authorized)
- [ ] Hustler starts job
- [ ] Hustler completes job
- [ ] Payment captured
- [ ] Transfer to hustler visible in Stripe
- [ ] Hustler receives email about payment

## Troubleshooting

**"Payment required" error:**
- Frontend needs to show payment form before accepting offer
- Payment intent must be created first

**"Account not connected":**
- Check `/stripe-connect/status` endpoint
- Verify `stripeAccountId` is set in database
- Make sure onboarding was completed

**No transfer happening:**
- Check job completion code was entered correctly
- Verify hustler has `stripeAccountId` set
- Check Stripe logs for errors

