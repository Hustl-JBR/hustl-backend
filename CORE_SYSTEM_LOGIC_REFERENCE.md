# Hustl Backend - Core System Logic & Flow Reference

> **Purpose**: Comprehensive reference document for analyzing all core business logic, payment flows, and system operations.

---

## Table of Contents

1. [Payment Architecture](#payment-architecture)
2. [Job Lifecycle](#job-lifecycle)
3. [Price Negotiation Flow](#price-negotiation-flow)
4. [Tip Processing Flow](#tip-processing-flow)
5. [Refund & Void Flows](#refund--void-flows)
6. [Transfer Calculations](#transfer-calculations)
7. [Fee Structure](#fee-structure)
8. [Key API Endpoints](#key-api-endpoints)
9. [Database Models & Relationships](#database-models--relationships)

---

## Payment Architecture

### Overview

Hustl uses **Stripe Connect** for payment processing:
- Customer payments are pre-authorized to the **platform's Stripe account**
- Funds are held in escrow until job completion
- Upon completion, funds are transferred to hustler's connected Stripe account (minus platform fees)

### Payment States

1. **PREAUTHORIZED**: Payment intent created, customer card authorized, funds held in escrow
2. **CAPTURED**: Payment captured from customer (happens when completion code is verified)
3. **REFUNDED**: Full refund issued to customer
4. **VOIDED**: Authorization cancelled (funds never captured)

### Payment Record Fields

```javascript
{
  jobId: String,              // Links to Job
  customerId: String,         // Customer who paid
  hustlerId: String,          // Hustler who will receive payment
  amount: Decimal,            // Job amount (negotiated price for flat jobs)
  tip: Decimal,               // Tip amount (separate from job payment)
  feeCustomer: Decimal,       // 6.5% service fee charged to customer
  feeHustler: Decimal,        // 12% platform fee (deducted from hustler payout)
  total: Decimal,             // Total charged to customer (amount + feeCustomer + tip)
  status: String,             // PREAUTHORIZED | CAPTURED | REFUNDED | VOIDED
  providerId: String,         // Stripe PaymentIntent ID
  transferId: String,         // Stripe Transfer ID (to hustler)
  transferStatus: String,     // Status of transfer to hustler
  refundAmount: Decimal,      // Amount refunded (if applicable)
  refundReason: String        // Reason for refund/void
}
```

---

## Job Lifecycle

### States & Transitions

```
OPEN → ASSIGNED/SCHEDULED → IN_PROGRESS → COMPLETED_BY_HUSTLER → PAID
  ↓         ↓                    ↓
CANCELLED  OPEN (if hustler leaves)  [Various error states]
```

### Key Milestones

1. **Job Posted** (`OPEN`)
   - Customer creates job
   - Payment is NOT created yet (only created when offer is accepted)

2. **Offer Accepted** (`SCHEDULED`)
   - Customer accepts hustler's offer
   - PaymentIntent created and pre-authorized
   - Payment record created with status `PREAUTHORIZED`
   - Start code and completion code generated
   - Job status: `SCHEDULED` (waiting for start code)

3. **Start Code Verified** (`IN_PROGRESS`)
   - Hustler enters start code
   - Job status: `IN_PROGRESS`
   - Start time recorded (for hourly jobs)
   - Payment remains `PREAUTHORIZED` (not captured yet)

4. **Completion Code Verified** (`PAID`)
   - Hustler enters completion code
   - Payment captured from customer
   - Platform fees calculated
   - Transfer initiated to hustler
   - Payment status: `CAPTURED`
   - Job status: `PAID`

---

## Price Negotiation Flow

### When Hustler Proposes Different Price

**Scenario**: Customer posts job for $100, hustler proposes $120

1. **Hustler Creates Offer** (`POST /offers/job/:jobId`)
   - `proposedAmount: 120` stored in offer
   - Customer receives email notification

2. **Customer Accepts Offer** (`POST /offers/:id/accept`)
   - Backend detects price difference:
     - Original: $100 + 6.5% fee = $106.50
     - Proposed: $120 + 6.5% fee = $127.80
   
3. **Old Payment Voided** (if existing payment exists)
   ```javascript
   // Old PaymentIntent is cancelled/voided
   await stripe.paymentIntents.cancel(oldPaymentIntentId);
   // Old payment record marked as VOIDED
   await prisma.payment.update({
     where: { id: oldPaymentId },
     data: { status: 'VOIDED', refundReason: 'Price negotiation...' }
   });
   ```

4. **Customer Receives Refund Email**
   - Email sent with original amount ($106.50)
   - Explains original payment voided, new payment needed

5. **New Payment Created**
   - Frontend creates new PaymentIntent for $127.80
   - Customer authorizes new payment
   - New payment record created with status `PREAUTHORIZED`
   - `job.amount` updated to $120

6. **Job Amount Updated**
   ```javascript
   await prisma.job.update({
     where: { id: jobId },
     data: { amount: 120 }  // Updated to negotiated price
   });
   ```

**Result**: Clean separation - old payment voided, new payment authorized for negotiated amount.

---

## Tip Processing Flow

### Overview

Tips are processed **separately** from job payments:
- 100% of tip goes to hustler (no platform fees on tips)
- Tips use Stripe Connect direct charges (`transfer_data`)
- Tips are instant (not subject to 2-7 day hold)

### Tip Flow

1. **Customer Initiates Tip** (`POST /tips/create-intent/job/:jobId`)
   ```javascript
   // Create PaymentIntent with direct transfer to hustler
   const paymentIntent = await stripe.paymentIntents.create({
     amount: Math.round(tipAmount * 100),
     currency: 'usd',
     transfer_data: {
       destination: hustler.stripeAccountId  // Direct transfer
     },
     confirmation_method: 'automatic',
     capture_method: 'automatic'
   });
   ```

2. **Frontend Confirms Payment**
   - Uses Stripe Elements (Payment Element)
   - Calls `stripe.confirmPayment()` with client secret
   - Payment confirmed in frontend

3. **Backend Confirms Tip** (`POST /tips/job/:jobId`)
   ```javascript
   // Retrieve payment intent to verify
   const tipPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
   
   // Update payment record with tip amount
   await prisma.payment.update({
     where: { jobId: jobId },
     data: {
       tip: tipAmount,
       tipPaymentIntentId: paymentIntentId
     }
   });
   ```

4. **Transfer Happens Automatically**
   - With `transfer_data`, Stripe automatically transfers tip to hustler
   - No manual `stripe.transfers.create()` needed
   - Transfer is instant

5. **Hustler Notified**
   - Email sent: "You received a tip!"
   - In-app notification created

---

## Refund & Void Flows

### When Refunds/Voids Happen

1. **Job Deleted by Customer** (before start code)
2. **Hustler Leaves Job** (before start code)
3. **Hustler Unassigned** (before start code)
4. **Price Negotiation** (old payment voided, new one created)

### Void Flow (PREAUTHORIZED Payments)

```javascript
async function voidPaymentIntent(paymentIntentId) {
  // Cancel the payment intent (releases authorization)
  await stripe.paymentIntents.cancel(paymentIntentId);
  
  // Update payment record
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'VOIDED',
      refundReason: reason
    }
  });
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      actionType: 'VOID',
      resourceType: 'PAYMENT',
      // ... details
    }
  });
}
```

**Result**: Customer's authorization is released, card is never charged.

### Refund Flow (CAPTURED Payments)

```javascript
async function refundPayment(paymentIntentId, amount) {
  // Create refund in Stripe
  await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(amount * 100)
  });
  
  // Update payment record
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'REFUNDED',
      refundAmount: amount,
      refundReason: reason
    }
  });
  
  // Send refund email to customer
  await sendRefundEmail(customer.email, ...);
}
```

**Result**: Customer receives refund (5-10 business days to appear in account).

---

## Transfer Calculations

### Job Payment Transfer

When job is completed (`POST /verification/job/:jobId/verify-completion`):

1. **Determine Actual Amount Charged**
   ```javascript
   // For hourly jobs:
   actualJobAmount = actualHours × hourlyRate;
   
   // For flat jobs:
   actualJobAmount = job.payment.amount;  // Uses negotiated price if price was negotiated
   ```

2. **Calculate Platform Fee**
   ```javascript
   platformFee = actualJobAmount × 0.12;  // 12% platform fee
   ```

3. **Calculate Hustler Payout**
   ```javascript
   hustlerPayout = actualJobAmount - platformFee;
   ```

4. **Capture Payment**
   ```javascript
   // For hourly: partial capture (only actual amount worked)
   await stripe.paymentIntents.capture(paymentIntentId, {
     amount_to_capture: Math.round(actualJobAmount * 100)
   });
   
   // Stripe automatically releases unused authorization (for hourly jobs)
   ```

5. **Transfer to Hustler**
   ```javascript
   try {
     const transfer = await stripe.transfers.create({
       amount: Math.round(hustlerPayout * 100),
       currency: 'usd',
       destination: hustler.stripeAccountId
     });
   } catch (error) {
     // If balance_insufficient (pending funds), create Payout record for retry
     if (error.code === 'balance_insufficient') {
       await prisma.payout.create({
         data: {
           hustlerId: hustlerId,
           jobId: jobId,
           amount: actualJobAmount,
           platformFee: platformFee,
           netAmount: hustlerPayout,
           status: 'PENDING'
         }
       });
     }
   }
   ```

### Tip Transfer

Tips use direct charges (`transfer_data`), so no manual transfer needed:
- PaymentIntent includes `transfer_data.destination = hustler.stripeAccountId`
- Stripe automatically transfers 100% of tip to hustler when payment succeeds
- Instant transfer (not subject to pending funds hold)

---

## Fee Structure

### Customer Fees

- **Service Fee**: 6.5% of job amount
- **Total Charged**: `jobAmount + (jobAmount × 0.065)`
- Example: $100 job → $106.50 total

### Platform Fees (from Hustler Payout)

- **Platform Fee**: 12% of job amount
- **Hustler Receives**: `jobAmount - (jobAmount × 0.12)`
- Example: $100 job → Hustler receives $88.00

### Tip Fees

- **Platform Fee on Tips**: 0% (100% goes to hustler)
- Example: $20 tip → Hustler receives $20.00

### Example Calculation (Complete Flow)

**Job**: $100 flat rate job
- Customer pays: $100 + $6.50 = **$106.50**
- Platform receives: $6.50 (service fee) + $12.00 (platform fee) = **$18.50**
- Hustler receives: $100 - $12.00 = **$88.00**

**Tip**: $20
- Customer pays: **$20.00**
- Platform receives: **$0.00**
- Hustler receives: **$20.00**

---

## Key API Endpoints

### Job Posting & Assignment

**POST `/jobs`** - Create job
- No payment created yet
- Payment only created when offer is accepted

**POST `/offers/job/:jobId`** - Hustler creates offer
- Can include `proposedAmount` for price negotiation
- Email sent to customer

**POST `/offers/:id/accept`** - Customer accepts offer
- Creates PaymentIntent (pre-authorization)
- Creates payment record (`PREAUTHORIZED`)
- If price negotiated: voids old payment, creates new one
- Updates `job.amount` if price negotiated
- Generates start code and completion code

### Job Execution

**POST `/verification/job/:jobId/verify-start`** - Hustler enters start code
- Records start time (for hourly jobs)
- Updates job status to `IN_PROGRESS`
- Payment remains `PREAUTHORIZED`

**POST `/verification/job/:jobId/verify-completion`** - Hustler enters completion code
- Calculates actual amount (hourly: actual hours × rate; flat: payment.amount)
- Captures payment from customer
- Calculates platform fee (12%)
- Transfers to hustler (or creates PENDING payout if insufficient balance)
- Updates payment status to `CAPTURED`
- Updates job status to `PAID`

### Tips

**POST `/tips/create-intent/job/:jobId`** - Create tip payment intent
- Validates hustler has Stripe account connected
- Creates PaymentIntent with `transfer_data` for direct transfer
- Returns `clientSecret` for frontend

**POST `/tips/job/:jobId`** - Confirm tip payment
- Verifies PaymentIntent status
- Updates payment record with tip amount
- Sends notification to hustler
- Transfer happens automatically (via `transfer_data`)

### Refunds & Voids

**DELETE `/jobs/:id`** - Customer deletes job
- Calls `processRefundIfNeeded()`
- Voids `PREAUTHORIZED` or refunds `CAPTURED` payments
- Marks job as `CANCELLED` if payment was refunded/voided (preserves audit trail)

**POST `/jobs/:id/leave`** - Hustler leaves job
- Calls `processRefundIfNeeded()`
- Sends refund email to customer with amount and next steps
- Sets job status back to `OPEN`

**POST `/jobs/:id/unassign`** - Customer unassigns hustler
- Calls `processRefundIfNeeded()`
- Sets job status back to `OPEN`

### Admin Endpoints

**POST `/admin/jobs/:jobId/capture-and-transfer`** - Manual capture & transfer
- Retrieves Stripe PaymentIntent to check actual status
- If already succeeded, skips capture
- If `requires_capture`, captures payment
- Transfers to hustler
- Updates payment and job status

**POST `/admin/jobs/:jobId/retry-transfer`** - Retry failed transfer
- Checks platform's available balance
- Attempts transfer to hustler
- Updates payment record with transfer details

---

## Database Models & Relationships

### Core Models

**Job**
```prisma
model Job {
  id                  String
  customerId          String
  hustlerId           String?          // Null until offer accepted
  amount              Decimal          // Updated if price negotiated
  hourlyRate          Decimal?         // For hourly jobs
  estHours            Int?             // For hourly jobs
  status              JobStatus        // OPEN | SCHEDULED | IN_PROGRESS | PAID | etc.
  startCode           String?
  startCodeVerified   Boolean
  completionCode      String?
  completionCodeVerified Boolean
  
  // Relations
  payment             Payment?         @relation(...)
  payout              Payout?          @relation(...)
  offers              Offer[]
}
```

**Payment**
```prisma
model Payment {
  id                  String
  jobId               String           @unique
  customerId          String
  hustlerId           String
  amount              Decimal          // Job amount (negotiated price)
  tip                 Decimal          // Tip amount
  feeCustomer         Decimal          // 6.5% service fee
  feeHustler          Decimal          // 12% platform fee
  total               Decimal          // Total charged (amount + feeCustomer + tip)
  status              PaymentStatus    // PREAUTHORIZED | CAPTURED | REFUNDED | VOIDED
  providerId          String           // Stripe PaymentIntent ID
  transferId          String?          // Stripe Transfer ID
  transferStatus      String?
  refundAmount        Decimal?
  refundReason        String?
  
  // Relations
  job                 Job              @relation(...)
  customer            User             @relation(...)
  hustler             User             @relation(...)
}
```

**Payout**
```prisma
model Payout {
  id                  String
  hustlerId           String
  jobId               String           @unique
  amount              Decimal          // Gross amount before fees
  platformFee         Decimal          // 12% platform fee
  netAmount           Decimal          // Amount after platform fee
  status              PayoutStatus     // PENDING | PROCESSING | COMPLETED | FAILED
  payoutProviderId    String?          // Stripe Transfer ID
  payoutMethod        String           // STRIPE_TRANSFER
  
  // Relations
  hustler             User             @relation(...)
  job                 Job              @relation(...)
}
```

**Offer**
```prisma
model Offer {
  id                  String
  jobId               String
  hustlerId           String
  proposedAmount      Decimal?         // Negotiated price (if different from job.amount)
  status              OfferStatus      // PENDING | ACCEPTED | DECLINED
}
```

---

## Critical Business Rules

### 1. Price Locking
- Price can only change **before** start code is entered
- Once `startCodeVerified = true`, price is locked
- Price negotiation voids old payment and creates new one

### 2. Payment Timing
- **Job Payments**: 2-7 business days (Stripe's pending funds hold for new accounts)
- **Tips**: Instant (via `transfer_data` direct charges)

### 3. Hourly Job Calculations
- Authorize: `hourlyRate × estHours` (maximum possible)
- Capture: `actualHours × hourlyRate` (only what was worked)
- Unused authorization automatically released by Stripe (no manual refund needed)

### 4. Transfer Failures
- If transfer fails due to `balance_insufficient`:
  - `Payout` record created with status `PENDING`
  - Admin can retry transfer when funds become available
  - Job status still set to `PAID` (payment captured)

### 5. Refund Timing
- Before start code: **VOID** (authorization released, no charge)
- After start code: **REFUND** (full refund of captured amount)
- Refunds take 5-10 business days to appear in customer's account

---

## Error Handling Patterns

### Stripe Errors

1. **balance_insufficient**
   - Create `Payout` record with `PENDING` status
   - Log error with available vs. needed amounts
   - Allow admin retry via `/admin/jobs/:jobId/retry-transfer`

2. **PaymentIntent not found**
   - Check if already succeeded
   - If `requires_capture`, proceed with capture
   - Otherwise, return error with current status

3. **Transfer failures**
   - Log detailed error (type, code, message)
   - Update payment record with `transferStatus: 'FAILED'`
   - Create `Payout` record for retry if appropriate

### Database Consistency

1. **Payment Status Updates**
   - Always update payment status to `CAPTURED` before attempting transfer
   - This allows manual retry even if transfer fails

2. **Job Status Updates**
   - Only set job to `PAID` after payment is captured
   - If transfer fails, job is still `PAID` (payment was captured)

3. **Audit Logging**
   - All refunds/voids create `AuditLog` entries
   - Includes actor, reason, amounts, timestamps

---

## Testing Scenarios

### Scenario 1: Standard Flat Job
1. Customer posts $100 job
2. Hustler accepts at $100
3. PaymentIntent created: $106.50 (pre-authorized)
4. Start code entered → job `IN_PROGRESS`
5. Completion code entered → payment captured, $88 transferred to hustler

### Scenario 2: Price Negotiation
1. Customer posts $100 job
2. Hustler proposes $120
3. Customer accepts → old $106.50 voided, new $127.80 authorized
4. Completion → $105.60 transferred to hustler (88% of $120)

### Scenario 3: Hourly Job
1. Customer posts $20/hr for 2 hours ($40 max)
2. PaymentIntent created: $42.60 (pre-authorized)
3. Job completed in 0.25 hours → $5.00 captured, $4.40 transferred
4. $37.60 unused authorization automatically released by Stripe

### Scenario 4: Tip Added
1. Job completed, $88 transferred to hustler
2. Customer tips $20
3. PaymentIntent created with `transfer_data` → $20 instantly transferred
4. No platform fee on tip

### Scenario 5: Hustler Leaves
1. Hustler accepts job, payment pre-authorized
2. Hustler leaves before start code
3. Payment voided (authorization released)
4. Customer receives email: "Full refund processed, $X.XX"
5. Job status: `OPEN` (available for new applications)

---

## Key Files Reference

- **Payment Processing**: `routes/verification.js` (completion code verification)
- **Offer Acceptance**: `routes/offers.js` (price negotiation, payment creation)
- **Tip Processing**: `routes/tips.js` (tip intents, confirmations)
- **Refunds/Voids**: `routes/jobs.js` (job deletion, hustler leave/unassign)
- **Stripe Services**: `services/stripe.js` (capture, transfer, void, refund)
- **Email Notifications**: `services/email.js` (all email templates)
- **Admin Tools**: `routes/admin.js` (manual capture, retry transfers)

---

**Last Updated**: 2025-01-22
**Version**: 1.0

