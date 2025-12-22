# Stripe Payment Flow Explanation

## How Payments Work

### 1. Customer Payment (Initial Payment)
- **Customer pays** → **Your Platform's Stripe Account**
- When customer accepts an offer, a `PaymentIntent` is created using your `STRIPE_SECRET_KEY`
- The payment goes directly to **your Stripe account** (the account associated with your secret key)
- Payment is **pre-authorized** (held in escrow) until job completion

### 2. Job Completion & Transfer
- When job is completed, payment is **captured** from the customer
- Money is now in **your platform's Stripe account**
- Platform calculates: `hustlerPayout = jobAmount - 12% platform fee`
- Platform uses `stripe.transfers.create()` to transfer money from **your account** → **hustler's connected Stripe account**

### 3. Tips
- Customer pays tip → **Hustler's connected account directly** (via `transfer_data` in checkout)
- Tips bypass your account entirely (100% goes to hustler)

## Account Structure

```
┌─────────────────────────────────────┐
│   Your Platform Stripe Account     │
│   (STRIPE_SECRET_KEY)              │
│                                     │
│   Customer pays here                │
│   ↓                                 │
│   Money held in escrow              │
│   ↓                                 │
│   On completion:                   │
│   - Capture payment                │
│   - Keep 12% + 6.5% fees          │
│   - Transfer rest to hustler       │
└─────────────────────────────────────┘
              ↓ Transfer
┌─────────────────────────────────────┐
│   Hustler's Connected Account      │
│   (stripeAccountId)                │
│                                     │
│   Receives: jobAmount - 12%        │
│   Also receives: 100% of tips      │
└─────────────────────────────────────┘
```

## Example Flow: $100 Job

1. **Customer pays $106.50** → Your Stripe account
   - $100 job amount
   - $6.50 service fee (6.5%)

2. **Job completes**
   - Payment captured: $106.50 in your account
   - Platform keeps: $12 (12% platform fee) + $6.50 (service fee) = $18.50
   - Transfer to hustler: $88.00 (from your account to hustler's account)

3. **Result**
   - Your account: +$18.50 (fees)
   - Hustler's account: +$88.00 (payout)

## Stripe Connect Transfer

The `transferToHustler()` function uses:
```javascript
stripe.transfers.create({
  amount: Math.round(amount * 100), // Convert to cents
  currency: 'usd',
  destination: connectedAccountId, // Hustler's Stripe Connect account ID
  metadata: {
    jobId: jobId,
    description: description,
  },
});
```

This transfers money **from your platform account** **to the hustler's connected account**.

## Important Notes

1. ✅ Customer pays to **your platform's Stripe account**
2. ✅ Money is held in escrow until job completion
3. ✅ On completion, you **transfer** from your account to hustler's account
4. ✅ Platform fees (12% + 6.5%) stay in **your account**
5. ✅ Tips go directly to hustler (bypass your account)

This is the standard **Stripe Connect** marketplace model.

