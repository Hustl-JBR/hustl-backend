# Payment Timing Solution

## Current Problem

**Issue:** Stripe is holding funds as "pending" for new accounts, which means:
- Customer pays → Money goes to platform account
- Platform tries to transfer to hustler → Fails because funds are pending
- Hustler doesn't receive payment immediately
- This creates bad UX and trust issues

**Current Flow:**
1. Customer pays → Platform account (authorized)
2. Job completes → Payment captured → Platform account (but funds pending)
3. Platform tries to transfer → Fails (insufficient available balance)
4. Hustler waits days for funds to become available

## Solution Options

### Option 1: Destination Charges (RECOMMENDED - Best UX)

**How it works:**
- Customer pays **directly** to hustler's connected account
- Platform fee is automatically deducted
- Hustler receives funds immediately (no pending hold)
- Platform gets fee portion immediately

**Benefits:**
- ✅ Hustlers get paid immediately
- ✅ No transfer failures
- ✅ Better user experience
- ✅ Works even with new Stripe accounts

**Implementation:**
- Change payment intent creation to use `on_behalf_of` or `transfer_data`
- Platform fee is set via `application_fee_amount`
- Money goes directly to hustler, fee to platform

### Option 2: Auto-Retry Transfers (Short-term fix)

**How it works:**
- Keep current flow (capture → transfer)
- Add automatic retry when funds become available
- Show clear messaging to hustlers about timing

**Benefits:**
- ✅ Minimal code changes
- ✅ Works with existing flow
- ⚠️ Still has delay (2-7 days for new accounts)

**Implementation:**
- Queue failed transfers
- Check balance periodically
- Retry when funds available
- Show "Payment pending - will transfer when funds available" message

## Recommendation

**For immediate fix:** Use Option 2 (auto-retry + messaging)
**For long-term:** Switch to Option 1 (destination charges)

## Next Steps

1. Add messaging to hustlers about payment timing
2. Implement auto-retry for failed transfers
3. Plan migration to destination charges for better UX

