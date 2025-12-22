# Hourly Job Refunds - How It Works

## The Process

### 1. Initial Authorization (When Customer Accepts Offer)
- Customer authorizes the **maximum amount**: `hourlyRate × maxHours`
- Example: $40/hr × 3 hours = **$120 authorized**
- This is a **pre-authorization** (hold on customer's card), NOT a charge yet
- Money is **held in escrow** but not captured

### 2. Job Completion
- System calculates **actual hours worked**
- Example: Job completed in 1.5 hours
- Actual amount: $40/hr × 1.5 hrs = **$60**

### 3. Partial Capture
- System captures **ONLY the actual amount worked** ($60)
- Uses Stripe's `capturePaymentIntent` with `amount_to_capture` parameter
- This is a **partial capture**, not a full capture

### 4. Automatic Release (Stripe Handles This)
- **Stripe automatically releases** the unused portion back to customer's card
- Unused amount: $120 - $60 = **$60 automatically released**
- This is **NOT a refund** - it's releasing an authorization hold
- Customer never actually paid the $60, so it's just released from the hold

## Example Flow

```
Hourly Job: $40/hr, 3 hours max

1. Customer accepts offer:
   - Authorizes: $120 (max possible)
   - Status: PREAUTHORIZED (held, not charged)

2. Job completes in 1.5 hours:
   - Actual work: 1.5 hrs × $40 = $60
   - Capture: $60 (partial capture)
   - Release: $60 automatically released by Stripe

3. Result:
   - Customer charged: $60 + $3.90 service fee = $63.90
   - Customer gets back: $60 (automatic release)
   - Hustler receives: $60 - $7.20 (12% fee) = $52.80
```

## Key Points

✅ **You don't manually refund** - Stripe automatically releases unused authorization  
✅ **No refund API call needed** - Partial capture handles it  
✅ **Customer never paid the unused amount** - It was just held  
✅ **Works for extensions too** - If customer adds more hours, additional payment intents are created

## Code Implementation

```javascript
// Partial capture - only capture actual amount worked
await capturePaymentIntent(paymentIntentId, actualJobAmount);

// Stripe automatically releases: authorizedAmount - actualJobAmount
// No manual refund needed!
```

## Why This Works

When you do a **partial capture** on a pre-authorized payment:
- Stripe captures only the specified amount
- The remaining authorized amount is **automatically released**
- This is built into Stripe's payment intent system
- It's faster and cleaner than doing a full capture + refund

## Customer Experience

1. Customer sees: "$120 authorized" (hold on card)
2. Job completes: "$60 charged, $60 released"
3. Customer's card: Only $60 is actually charged
4. Customer gets: Automatic release of unused $60 (no refund needed)

This is the standard way to handle variable-amount payments in Stripe!

