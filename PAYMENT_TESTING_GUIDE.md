# Payment System Testing Guide

## ✅ What's Working
- Payment amount is now correct ($100 + 6.5% fee = $106.50)
- Payment modal shows correct breakdown
- Stripe payment intent is created with correct amount

## 🧪 Testing Checklist

### 1. **Payment Authorization (Accept Offer)**
**What to test:**
- [ ] Accept an offer with proposed price ($100)
- [ ] Verify payment modal shows: $100 + $6.50 fee = $106.50
- [ ] Complete payment with test card: `4242 4242 4242 4242`
- [ ] Verify offer is accepted and job moves to "Scheduled" status
- [ ] Check Stripe dashboard: PaymentIntent should be `requires_capture` (authorized, not charged yet)

**Expected result:** Payment is authorized but NOT charged. Customer can still get full refund.

---

### 2. **Refund Before Start Code (Full Refund Test)**
**What to test:**
- [ ] After accepting offer, cancel/unassign the job BEFORE hustler enters start code
- [ ] Verify full refund is processed ($106.50)
- [ ] Check Stripe dashboard: PaymentIntent should be cancelled/refunded
- [ ] Verify job status changes appropriately

**Expected result:** Customer gets 100% refund because work hasn't started.

---

### 3. **Start Code Entry (Payment Locked)**
**What to test:**
- [ ] Hustler enters start code
- [ ] Job moves to "IN_PROGRESS" status
- [ ] Timer starts
- [ ] Check Stripe dashboard: PaymentIntent should still be `requires_capture` (not charged yet, but locked)

**Expected result:** Payment is now locked. Customer cannot get automatic refund (would need manual refund via support).

---

### 4. **Job Completion (Payment Capture)**
**What to test:**
- [ ] Hustler completes work and enters completion code
- [ ] Customer confirms completion
- [ ] Check Stripe dashboard: PaymentIntent should be `succeeded` (charged)
- [ ] Verify hustler receives payout (job amount - 12% platform fee)
- [ ] Verify platform receives: 6.5% customer fee + 12% platform fee

**Expected result:** 
- Customer charged: $106.50
- Hustler receives: $88.00 ($100 - 12%)
- Platform receives: $18.50 ($6.50 + $12.00)

---

### 5. **Hourly Job Testing**
**What to test:**
- [ ] Create hourly job ($50/hr, max 3 hours)
- [ ] Accept offer - should authorize: $150 + 6.5% = $159.75
- [ ] Start job, work for 2 hours
- [ ] Complete job early
- [ ] Verify only 2 hours are charged: $100 + 6.5% = $106.50
- [ ] Check Stripe: Unused authorization ($50) should be automatically released

**Expected result:** Customer only pays for actual hours worked.

---

### 6. **Hourly Job Max Hours Enforcement**
**What to test:**
- [ ] Create hourly job ($50/hr, max 2 hours)
- [ ] Start job, let timer reach 2 hours
- [ ] Verify job hard-stops (cannot continue without extension)
- [ ] Customer extends by 1 hour
- [ ] Verify new authorization is created for 1 hour: $50 + 6.5% = $53.25
- [ ] Complete job after extension

**Expected result:** Job stops at max hours, requires explicit extension.

---

### 7. **Tip Testing (Post-Completion)**
**What to test:**
- [ ] Complete a job
- [ ] Add a tip ($10) after completion
- [ ] Verify tip is charged separately
- [ ] Verify 100% of tip goes to hustler (no platform fee on tip)
- [ ] Check Stripe: Separate PaymentIntent for tip

**Expected result:** Tip is separate charge, 100% to hustler.

---

## 🔍 What to Check in Stripe Dashboard

### Payment Intent States:
1. **`requires_capture`** = Authorized, not charged yet (can be refunded)
2. **`succeeded`** = Charged (payment captured)
3. **`canceled`** = Cancelled/refunded

### What to Verify:
- [ ] PaymentIntent amount matches UI ($106.50 for $100 job)
- [ ] Customer fee (6.5%) is included in total
- [ ] Platform fee (12%) is deducted from hustler payout
- [ ] Tips are separate charges (100% to hustler)
- [ ] Refunds work correctly before start code
- [ ] Hourly jobs capture only actual hours worked

---

## 🚨 Edge Cases to Test

1. **Job Deletion Before Start Code:**
   - Should refund full amount
   - PaymentIntent should be cancelled

2. **Job Unassignment Before Start Code:**
   - Should refund full amount
   - Job should go back to OPEN status

3. **Hourly Job Over Max Hours:**
   - Should hard-stop at max hours
   - Should require extension to continue
   - Should NOT automatically charge overage

4. **Price Change Before Start Code:**
   - Should update PaymentIntent amount
   - Should charge/refund difference

---

## 📊 Test Data Summary

**Test Card:** `4242 4242 4242 4242`
- Expiry: Any future date (12/34)
- CVC: Any 3 digits (123)
- ZIP: Any 5 digits (12345)

**Test Accounts:**
- Customer: Your customer account
- Hustler: Your hustler account (with Stripe Connect connected)

---

## ✅ Priority Tests (Do These First)

1. **Accept offer → Verify correct price** ✅ (Already working!)
2. **Cancel job before start code → Verify full refund**
3. **Enter start code → Verify payment is locked**
4. **Complete job → Verify payment is captured**
5. **Check Stripe dashboard → Verify amounts match**

Start with #2 (refund test) - that's the most critical to verify the escrow system works correctly!

