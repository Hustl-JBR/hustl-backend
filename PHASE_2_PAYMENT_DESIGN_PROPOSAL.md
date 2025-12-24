# Phase 2 Design Proposal: Payment Model Simplification

**Status**: PROPOSAL (Not Implemented)  
**Date**: December 23, 2025  
**Purpose**: Eliminate fragile delta payment logic, establish single source of truth

---

## Problem Statement

### Current Issue: Flow B (Post-Acceptance Price Changes)

**Scenario**:
1. Job accepted at $100 → PaymentIntent `pi_original` created for $106.50 (incl. fees)
2. Hustler proposes new price $120
3. System calculates difference: $20 + fees = $21.30
4. Creates **delta PaymentIntent** `pi_delta` for $21.30
5. Stores `pi_delta` in `requirements.differencePaymentIntentId`

**Problems**:
- ❌ **Two PaymentIntents per job** - Which is source of truth?
- ❌ **Delta remains uncaptured** - Lost in requirements JSON field
- ❌ **Unclear platform fees** - Calculated on which amount?
- ❌ **Reconciliation breaks** - Script checks single `payment.providerId`
- ❌ **Hustler payout unclear** - Based on original or new amount?
- ❌ **Refund confusion** - Which PaymentIntent to refund?
- ❌ **Audit trail fragmented** - Payment history split across intents

**Root Cause**: Attempting to preserve original authorization while adding incremental charges creates split state.

---

## Design Goals

### Core Principles

1. **Single PaymentIntent Per Job**
   - One authoritative payment intent ID in `payment.providerId`
   - All payment operations reference this single intent
   - Clear source of truth for Stripe and database

2. **Atomic Payment State**
   - Payment amount matches job amount at any given time
   - No partial/delta intents stored separately
   - Status transitions are clean (PREAUTHORIZED → CAPTURED → TRANSFERRED)

3. **Simple Fee Calculation**
   - Platform fee (12%) calculated on final captured amount
   - Customer fee (6.5%) calculated on final job amount
   - No fee adjustments or deltas

4. **Reconciliation-Friendly**
   - Single payment intent to check in Stripe
   - Payment status directly maps to job status
   - No orphaned payment intents

5. **Audit Trail Clarity**
   - All payment changes recorded in `payment` table
   - Amount history tracked if needed
   - No hidden state in JSON fields

---

## Proposed Solutions

### Option A: Prohibit Post-Acceptance Price Changes (Simplest)

**Design**: Remove Flow B entirely. Price negotiation only during offer phase (Flow A).

#### How It Works

**Job Posting**:
- Customer posts job with amount $100
- Job status: OPEN

**Offer Phase** (Flow A - Keep This):
- Hustler A offers at $100
- Hustler B proposes $120
- Customer reviews offers, compares prices
- Customer accepts Hustler B's $120 offer

**After Acceptance**:
- Job locked at $120
- PaymentIntent created for $127.80 (incl. 6.5% fee)
- Status: SCHEDULED
- **No further price changes allowed**

#### Implementation

**Remove Endpoints**:
- `POST /jobs/:id/propose-price-change` ❌ Delete
- `POST /jobs/:id/accept-price-change` ❌ Delete
- `POST /jobs/:id/finalize-price-change` ❌ Delete

**UI Changes**:
- Remove "Propose New Price" button after acceptance
- Show message: "Price is locked after acceptance"
- Emphasize negotiation during offer phase

**Database**:
- Remove `requirements.proposedPriceChange` field (or leave unused)
- Remove `requirements.differencePaymentIntentId` field

#### Pros
✅ **Simplest solution** - Remove fragile code, no replacement needed  
✅ **Clear mental model** - Negotiate before commitment  
✅ **No payment complexity** - Single PaymentIntent lifecycle  
✅ **Standard marketplace pattern** - Most platforms work this way  
✅ **Reconciliation works** - Single payment intent to track  
✅ **Zero edge cases** - Can't have payment state issues  

#### Cons
⚠️ **Less flexible for hustlers** - Can't adjust price mid-job if scope changes  
⚠️ **Customer friction** - Must cancel and restart if price needs adjustment  
⚠️ **Dispute resolution harder** - No formal process for scope changes  

#### When This Works Best
- Jobs with clear upfront scope
- Fixed-price work (lawn mowing, cleaning, moving)
- When negotiation typically happens before commitment

#### Workaround for Edge Cases
If job scope changes significantly after acceptance:
1. **Option 1**: Customer cancels job (refund), hustler creates new offer
2. **Option 2**: Admin manually adjusts (requires admin intervention)
3. **Option 3**: Use messaging to agree, process adjustment separately

---

### Option B: Void-and-Replace (Clean Renegotiation)

**Design**: Allow price changes, but void original PaymentIntent and create new one at full amount.

#### How It Works

**Initial Acceptance**:
- Job accepted at $100
- PaymentIntent `pi_001` created for $106.50
- Status: PREAUTHORIZED

**Price Change Request**:
- Hustler proposes new price $120
- Customer sees comparison:
  - Original: $100 + $6.50 fee = $106.50
  - New: $120 + $7.80 fee = $127.80
  - Difference: +$21.30

**Price Change Approval**:
1. **Void original PaymentIntent** `pi_001` (customer not charged)
2. **Create new PaymentIntent** `pi_002` for $127.80 (full new amount)
3. **Customer authorizes new payment** (requires customer action)
4. **Update payment record**:
   ```javascript
   await prisma.payment.update({
     where: { id: payment.id },
     data: {
       amount: 120,
       feeCustomer: 7.80,
       total: 127.80,
       providerId: 'pi_002', // NEW single payment intent
       status: 'PREAUTHORIZED'
     }
   });
   ```

#### Implementation

**Endpoint Flow**:
```javascript
POST /jobs/:id/propose-price-change
→ Store proposal in job.requirements.proposedPriceChange

POST /jobs/:id/customer-approve-price-change
→ 1. Void old payment intent
→ 2. Create new payment intent (full amount)
→ 3. Return payment intent for customer authorization
→ 4. Update payment.providerId to new intent
→ 5. Clear proposal from requirements
```

**Key Code Change**:
```javascript
// OLD (fragile - difference only)
const difference = newAmount - oldAmount;
const deltaIntent = await stripe.paymentIntents.create({
  amount: difference * 100, // PROBLEM: separate intent
  ...
});

// NEW (clean - void and replace)
await stripe.paymentIntents.cancel(oldPaymentIntentId); // Void old

const newIntent = await stripe.paymentIntents.create({
  amount: newTotal * 100, // Full new amount
  customer: customerId,
  capture_method: 'manual'
});

await prisma.payment.update({
  where: { id: payment.id },
  data: {
    amount: newAmount,
    total: newTotal,
    providerId: newIntent.id // Single source of truth
  }
});
```

#### Pros
✅ **Single PaymentIntent** - One source of truth always  
✅ **Clean state** - No orphaned delta intents  
✅ **Reconciliation works** - Single intent to check  
✅ **Flexibility retained** - Can still adjust price if needed  
✅ **Clear audit trail** - Payment record shows amount changes  
✅ **Stripe-native** - Standard void/authorize pattern  

#### Cons
⚠️ **Requires customer action** - Must re-authorize payment (friction)  
⚠️ **Payment method failure risk** - Card could fail on re-authorization  
⚠️ **More complex UX** - Customer sees void + new charge flow  
⚠️ **Network dependency** - Two Stripe calls (void + create)  

#### When This Works Best
- Infrequent price changes (not every job)
- Significant price adjustments (not small tweaks)
- When customer approval is required anyway

---

### Option C: Update Existing PaymentIntent Amount

**Design**: Stripe allows updating payment intent amount before capture (if `requires_capture` status).

#### How It Works

**Initial Acceptance**:
- Job accepted at $100
- PaymentIntent `pi_001` created for $106.50
- Status: PREAUTHORIZED (`requires_capture` in Stripe)

**Price Change Request**:
- Hustler proposes new price $120
- Customer approves

**Price Change Implementation**:
```javascript
// Update existing payment intent amount (Stripe allows this)
await stripe.paymentIntents.update('pi_001', {
  amount: 12780, // New total in cents
  metadata: {
    originalAmount: '100',
    newAmount: '120',
    adjustmentReason: 'Scope increase'
  }
});

// Update database to match
await prisma.payment.update({
  where: { id: payment.id },
  data: {
    amount: 120,
    feeCustomer: 7.80,
    total: 127.80
    // providerId stays 'pi_001' - same intent
  }
});
```

#### Stripe Payment Intent Update Rules

**Can Update Amount When**:
- ✅ Status is `requires_capture` (authorized, not captured)
- ✅ Status is `requires_payment_method` (not yet authorized)
- ❌ **CANNOT update after capture** (`succeeded` status)

**Important**: Customer's card is NOT charged again for the increase. The authorization amount adjusts.

#### Pros
✅ **Single PaymentIntent** - Same intent ID throughout  
✅ **No customer action** - Card already authorized, just adjust amount  
✅ **Simple implementation** - One Stripe API call  
✅ **Reconciliation works** - Single intent to track  
✅ **Least friction** - Customer doesn't see void/reauth flow  

#### Cons
⚠️ **Stripe limits** - Can only increase up to certain amount (varies by card)  
⚠️ **Bank authorization limits** - Some banks may decline large increases  
⚠️ **Less transparent** - Customer doesn't explicitly see new charge  
⚠️ **Risk of insufficient funds** - Increased amount might exceed available balance  
⚠️ **Cannot decrease easily** - Lowering amount is trickier (need to capture less)  

#### When This Works Best
- Small price adjustments (10-20% increase)
- When customer has already agreed to scope change
- Quick adjustments without re-authorization UX

---

## Hourly Jobs: Separate Problem, Clean Solution

### Current Hourly Job Flow (Working, But Complex)

**Initial Authorization**:
- Job posted: $25/hr × 4 hours estimated = $100
- Customer authorizes: $106.50 (incl. 6.5% fee)
- PaymentIntent `pi_001` for $106.50 (PREAUTHORIZED)

**Extensions** (Current Implementation):
- Customer adds 2 more hours → $50 additional
- Creates **extension PaymentIntent** `pi_ext_001` for $53.25
- Stored in `requirements.extensionPaymentIntents[]`

**Completion** (Current Implementation):
- Actual hours worked: 5 hours = $125
- Capture logic:
  ```javascript
  // Complex: Capture from original + extensions
  const originalAmount = 100;
  const extensionAmount = 50;
  
  // Try to capture from original (up to authorized)
  await capture(pi_001, Math.min(actualTotal, originalAmount));
  
  // Capture remaining from extension
  await capture(pi_ext_001, actualTotal - originalAmount);
  ```

### Problem with Current Hourly Extensions

- ❌ Multiple PaymentIntents (original + N extensions)
- ❌ Complex capture logic across intents
- ❌ Edge cases: What if extension not authorized when job completes?
- ❌ Reconciliation hard: Which intents to check?
- ❌ Refund complexity: Partial refunds across multiple intents

---

### Proposed Solution: Single Pre-Authorization with Partial Capture

**Design**: Authorize maximum upfront, capture only actual amount, automatically release unused.

#### How It Works

**Job Posting**:
- Customer posts: $25/hr, estimated 4 hours
- Customer sees: "We'll authorize $125 (5 hours max), but you'll only be charged for actual time worked"
- **Authorize for buffer**: 4 hours × 1.25 = 5 hours max

**Authorization**:
- Create PaymentIntent for: $25 × 5 hours = $125 + 6.5% fee = $133.13
- Status: PREAUTHORIZED (holds funds)
- Customer sees pending charge: $133.13

**Job Completion**:
- Actual hours worked: 3.5 hours
- Actual charge: $25 × 3.5 = $87.50 + 6.5% fee = $93.19

**Capture**:
```javascript
// Capture only actual amount
await stripe.paymentIntents.capture('pi_001', {
  amount_to_capture: 9319 // $93.19 in cents
});

// Stripe automatically releases unused: $133.13 - $93.19 = $39.94
```

**Result**:
- Customer charged: $93.19 (actual)
- Unused authorization released: $39.94 (automatically)
- Hustler paid: $87.50 - 12% = $76.65
- Platform fee: $10.50

#### Implementation

**No Extension PaymentIntents**:
- ❌ Remove `requirements.extensionPaymentIntents` array
- ❌ Remove extension payment creation endpoints
- ✅ Single PaymentIntent for maximum anticipated hours

**Authorization Buffer**:
```javascript
const estimatedHours = 4;
const bufferMultiplier = 1.25; // 25% buffer
const maxHours = estimatedHours * bufferMultiplier; // 5 hours

const maxAmount = hourlyRate * maxHours; // $125
const maxTotal = maxAmount + (maxAmount * 0.065); // $133.13

const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(maxTotal * 100),
  capture_method: 'manual'
});
```

**Completion Capture**:
```javascript
const actualHours = 3.5;
const actualAmount = hourlyRate * actualHours; // $87.50
const actualTotal = actualAmount + (actualAmount * 0.065); // $93.19

await stripe.paymentIntents.capture(paymentIntent.id, {
  amount_to_capture: Math.round(actualTotal * 100)
});

// Stripe automatically releases: $133.13 - $93.19 = $39.94
```

#### Pros
✅ **Single PaymentIntent** - One source of truth  
✅ **Automatic refund** - Stripe releases unused authorization  
✅ **No extension intents** - Simpler code, no edge cases  
✅ **Standard pattern** - Hotels/car rentals use this model  
✅ **Clear customer UX** - Pending hold, charged actual, refund automatic  
✅ **Reconciliation simple** - One intent to check  

#### Cons
⚠️ **Higher initial hold** - Customer sees larger pending charge  
⚠️ **Buffer management** - Need to set reasonable max (1.25x? 1.5x?)  
⚠️ **Job exceeds buffer** - What if 6 hours worked but only 5 authorized?  

#### Handling Buffer Exceeded

**If Actual Hours > Authorized Hours**:

**Option 1: Refuse completion**
```
Error: Job exceeded authorized hours (5 hours max).
Action: Customer must add more hours before completion.
```

**Option 2: Capture maximum, request additional payment**
```
Captured: $125 (5 hours)
Additional needed: $25 (1 hour)
Action: Create new PaymentIntent for $26.63 (1 hour + fee)
```

**Recommendation**: Option 1 - Require customer approval for extensions beyond buffer.

---

## Unified Payment Model: Consistency Across Job Types

### Core Principle: Single PaymentIntent Per Job

**Flat-Rate Jobs**:
- One PaymentIntent created at acceptance
- Amount = job amount + customer fee
- No price changes after acceptance (Option A)
- OR Void + Replace for price changes (Option B)

**Hourly Jobs**:
- One PaymentIntent created at acceptance
- Amount = (hourly rate × max hours) + customer fee
- Partial capture on completion
- Automatic release of unused authorization

### Payment State Transitions (Both Job Types)

```
Job Acceptance
    ↓
Create PaymentIntent (full or max amount)
    ↓
Status: PREAUTHORIZED
    ↓
Job Completion
    ↓
Capture Payment (full for flat, actual for hourly)
    ↓
Status: CAPTURED
    ↓
Transfer to Hustler
    ↓
Status: TRANSFERRED (implicit, no new status)
```

### Database Schema Consistency

**payment Table** (Same for both):
```javascript
{
  id: uuid,
  jobId: uuid,
  providerId: string, // Single Stripe PaymentIntent ID
  amount: decimal,    // Job amount (final)
  feeCustomer: decimal,
  feeHustler: decimal,
  total: decimal,     // What customer pays
  status: enum,       // PREAUTHORIZED, CAPTURED, VOIDED
  capturedAt: timestamp,
  createdAt: timestamp
}
```

**No Special Fields Needed**:
- ❌ `requirements.differencePaymentIntentId`
- ❌ `requirements.extensionPaymentIntents[]`
- ✅ Single `payment.providerId` is source of truth

---

## Recommended Approach

### Phase 2A: Flat-Rate Jobs (Choose One)

**Recommendation: Option A (Prohibit Post-Acceptance Changes)**

**Why**:
- ✅ Simplest to implement (remove code)
- ✅ Zero payment complexity
- ✅ Standard marketplace pattern
- ✅ Forces clear negotiation upfront
- ✅ No edge cases to handle

**Migration**:
1. Remove price change endpoints
2. Update UI to remove "Propose New Price" after acceptance
3. Add messaging: "Price locked after acceptance"
4. Document workaround: Cancel and restart for scope changes

**Fallback**: If flexibility absolutely required, implement Option B (Void + Replace).

---

### Phase 2B: Hourly Jobs

**Recommendation: Single Pre-Authorization with Buffer**

**Why**:
- ✅ Eliminates extension PaymentIntent complexity
- ✅ Standard industry pattern (hotels, car rentals)
- ✅ Automatic refund of unused funds
- ✅ Single source of truth

**Implementation**:
1. Set buffer multiplier (recommend 1.25x = 25% buffer)
2. Authorize max amount at acceptance
3. Partial capture on completion
4. Remove extension payment intent logic

**Buffer Size Options**:
- Conservative: 1.25x (25% buffer)
- Moderate: 1.5x (50% buffer)
- Generous: 2x (100% buffer)

**Recommendation**: Start with 1.5x (50% buffer) for flexibility.

---

## Migration Plan

### Step 1: Analyze Current Usage

**Data to Collect**:
- How many jobs use post-acceptance price changes? (Flow B usage)
- Average price change amount (delta size)
- How many hourly jobs have extensions?
- Average buffer needed (actual hours / estimated hours ratio)

**Query Examples**:
```sql
-- Jobs with price changes
SELECT COUNT(*) FROM jobs 
WHERE requirements->>'proposedPriceChange' IS NOT NULL;

-- Hourly jobs with extensions
SELECT COUNT(*) FROM jobs 
WHERE requirements->>'extensionPaymentIntents' IS NOT NULL;
```

### Step 2: Implement Flat-Rate Solution

**Option A (Recommended)**:
1. Remove endpoints: `propose-price-change`, `accept-price-change`, `finalize-price-change`
2. Update UI to disable price changes post-acceptance
3. Test cancellation flow
4. Deploy

**Option B (If flexibility needed)**:
1. Implement void + replace logic
2. Add customer re-authorization flow
3. Test payment state transitions
4. Deploy

### Step 3: Implement Hourly Solution

1. Add buffer multiplier to job creation
2. Update authorization logic (max hours instead of estimated)
3. Remove extension payment intent creation
4. Update completion capture logic (partial capture)
5. Test buffer overflow handling
6. Deploy

### Step 4: Clean Up

1. Mark old fields as deprecated:
   - `requirements.differencePaymentIntentId`
   - `requirements.extensionPaymentIntents`
   - `requirements.proposedPriceChange`

2. Add database migration (optional):
   - Remove deprecated fields after confirming no active usage

---

## Trade-Off Analysis

### Option A: Prohibit Post-Acceptance Changes

| Factor | Score | Notes |
|--------|-------|-------|
| **Simplicity** | ⭐⭐⭐⭐⭐ | Remove code, no replacement |
| **Payment Clarity** | ⭐⭐⭐⭐⭐ | Single PaymentIntent always |
| **Reconciliation** | ⭐⭐⭐⭐⭐ | Perfect |
| **Flexibility** | ⭐⭐ | Must cancel and restart |
| **Customer UX** | ⭐⭐⭐⭐ | Clear expectations |
| **Implementation Cost** | ⭐⭐⭐⭐⭐ | Very low (remove code) |

### Option B: Void + Replace

| Factor | Score | Notes |
|--------|-------|-------|
| **Simplicity** | ⭐⭐⭐ | Moderate complexity |
| **Payment Clarity** | ⭐⭐⭐⭐ | Single PaymentIntent maintained |
| **Reconciliation** | ⭐⭐⭐⭐ | Clean |
| **Flexibility** | ⭐⭐⭐⭐ | Can adjust price if needed |
| **Customer UX** | ⭐⭐⭐ | Re-authorization friction |
| **Implementation Cost** | ⭐⭐⭐ | Moderate |

### Option C: Update Amount

| Factor | Score | Notes |
|--------|-------|-------|
| **Simplicity** | ⭐⭐⭐⭐ | Simple API call |
| **Payment Clarity** | ⭐⭐⭐⭐ | Same PaymentIntent |
| **Reconciliation** | ⭐⭐⭐⭐ | Clean |
| **Flexibility** | ⭐⭐⭐⭐ | Can adjust easily |
| **Customer UX** | ⭐⭐⭐⭐⭐ | No friction |
| **Implementation Cost** | ⭐⭐⭐⭐ | Low |
| **Risk** | ⭐⭐⭐ | Bank authorization limits |

### Hourly: Single Pre-Authorization

| Factor | Score | Notes |
|--------|-------|-------|
| **Simplicity** | ⭐⭐⭐⭐⭐ | Remove extension logic |
| **Payment Clarity** | ⭐⭐⭐⭐⭐ | Single PaymentIntent |
| **Reconciliation** | ⭐⭐⭐⭐⭐ | Perfect |
| **Flexibility** | ⭐⭐⭐⭐ | Buffer handles most cases |
| **Customer UX** | ⭐⭐⭐⭐ | Higher initial hold |
| **Implementation Cost** | ⭐⭐⭐⭐ | Low (remove extensions) |

---

## Questions for Decision

1. **Flat-Rate Price Changes**:
   - How often do jobs need price adjustments after acceptance?
   - Is negotiation before commitment acceptable?
   - Are customers willing to cancel/restart for scope changes?

2. **Hourly Job Buffer**:
   - What buffer multiplier is acceptable? (1.25x, 1.5x, 2x?)
   - How often do jobs exceed estimated hours significantly?
   - Is higher initial authorization acceptable for customers?

3. **Implementation Priority**:
   - Should we fix flat-rate first, then hourly?
   - Or tackle both together?

4. **Migration**:
   - Any active jobs using Flow B that need special handling?
   - Timeline for deprecating old fields?

---

## Next Steps (Awaiting Your Decision)

**Please Review and Decide**:

1. **Flat-Rate Approach**:
   - [ ] Option A: Prohibit post-acceptance changes (recommended)
   - [ ] Option B: Void + replace
   - [ ] Option C: Update amount
   - [ ] Other approach

2. **Hourly Approach**:
   - [ ] Single pre-authorization with buffer (recommended)
   - [ ] Buffer multiplier: 1.25x / 1.5x / 2x / custom
   - [ ] Keep extensions (not recommended)

3. **Implementation Order**:
   - [ ] Flat-rate first, then hourly
   - [ ] Hourly first, then flat-rate
   - [ ] Both together

**After Decision**: I will create detailed implementation plan with step-by-step changes, test cases, and migration strategy.

---

**Document Version**: 1.0 (Proposal)  
**Status**: Awaiting Business Decision  
**Next**: Implementation Plan (after approval)
