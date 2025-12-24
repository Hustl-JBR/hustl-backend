# Job State Machine - Valid Transitions & Business Rules

**Purpose**: Define and document all valid job status transitions to ensure data consistency and prevent invalid state changes.

---

## Job Status States

### Primary States
- **OPEN** - Job posted, accepting offers
- **SCHEDULED** - Offer accepted, waiting for start code
- **IN_PROGRESS** - Start code verified, job in progress
- **PAID** - Completion code verified, payment captured and transferred
- **CANCELLED** - Job cancelled (before start or by admin)
- **EXPIRED** - Start code expired (78 hours passed without verification)

### Legacy/Deprecated States
- **REQUESTED** - (Legacy, treat as OPEN)
- **ASSIGNED** - (Legacy, use SCHEDULED instead)
- **COMPLETED_BY_HUSTLER** - (Legacy, not used)

---

## Valid State Transitions

### OPEN → SCHEDULED
**Trigger**: Customer accepts an offer  
**Requirements**:
- ✅ Job has at least one PENDING offer
- ✅ Customer accepts specific offer
- ✅ Payment intent created and authorized
- ✅ Start code and completion code generated

**Actions**:
- Update job status to SCHEDULED
- Assign hustler to job
- Generate verification codes
- Set start code expiration (78 hours)
- Update payment with hustler ID
- Decline other offers

**Prevented If**:
- ❌ Job already has assigned hustler
- ❌ Payment authorization fails
- ❌ No valid offers exist

---

### SCHEDULED → IN_PROGRESS
**Trigger**: Hustler verifies start code  
**Requirements**:
- ✅ Job status is SCHEDULED
- ✅ Hustler provides correct start code
- ✅ Start code has not expired (< 78 hours)
- ✅ Hustler is assigned to this job

**Actions**:
- Update job status to IN_PROGRESS
- Mark start code as verified
- Record start time

**Prevented If**:
- ❌ Start code incorrect
- ❌ Start code expired (job moves to EXPIRED, payment voided)
- ❌ Wrong hustler attempting verification
- ❌ Job not in SCHEDULED status

---

### IN_PROGRESS → PAID
**Trigger**: Hustler verifies completion code  
**Requirements**:
- ✅ Job status is IN_PROGRESS
- ✅ Start code already verified
- ✅ Hustler provides correct completion code
- ✅ Payment intent exists and can be captured

**Actions**:
- Update job status to PAID
- Mark completion code as verified
- Capture payment from customer
- Transfer funds to hustler (minus platform fee)
- Update payment status to CAPTURED
- Record completion time

**Prevented If**:
- ❌ Completion code incorrect
- ❌ Start code not verified yet
- ❌ Payment capture fails
- ❌ Hustler transfer fails (job stays IN_PROGRESS, admin can retry)

---

### OPEN → CANCELLED
**Trigger**: Customer cancels job before acceptance  
**Requirements**:
- ✅ Job status is OPEN
- ✅ No payment authorization yet (or void if exists)

**Actions**:
- Update job status to CANCELLED
- Void payment intent (if exists)
- Update payment status to VOIDED
- Decline all pending offers

**Prevented If**:
- ❌ Job already accepted (use different cancellation flow)

---

### SCHEDULED → CANCELLED
**Trigger**: Customer or admin cancels after acceptance but before start  
**Requirements**:
- ✅ Job status is SCHEDULED
- ✅ Start code not verified yet
- ✅ Payment can be voided (pre-authorized, not captured)

**Actions**:
- Update job status to CANCELLED
- Void payment intent (full refund to customer)
- Update payment status to VOIDED
- Notify hustler of cancellation

**Prevented If**:
- ❌ Start code already verified (job is IN_PROGRESS)
- ❌ Payment already captured

---

### SCHEDULED → EXPIRED
**Trigger**: 78 hours pass without start code verification  
**Requirements**:
- ✅ Job status is SCHEDULED
- ✅ 78 hours have passed since startCodeExpiresAt
- ✅ Start code not verified

**Actions**:
- Update job status to EXPIRED
- Void payment intent (full refund to customer)
- Update payment status to REFUNDED
- Unassign hustler (job returns to OPEN or CANCELLED)

**Prevented If**:
- ❌ Start code was verified (job is IN_PROGRESS)

---

### IN_PROGRESS → CANCELLED
**Trigger**: Admin cancels job mid-work (rare, requires refund)  
**Requirements**:
- ✅ Admin permission required
- ✅ Job status is IN_PROGRESS
- ✅ Payment already captured

**Actions**:
- Update job status to CANCELLED
- Refund customer (full or partial)
- Potentially pay hustler for work done (admin decision)
- Create audit log entry with reason

**Prevented If**:
- ❌ Job already completed (PAID)
- ❌ Without admin approval

**Note**: This is an exceptional case, normally jobs in progress complete normally.

---

## Invalid State Transitions (BLOCKED)

### PAID → Any Other Status ❌
**Reason**: Completed jobs are terminal, cannot be reversed  
**Why**: Payment already captured and transferred, hustler already paid

### IN_PROGRESS → OPEN ❌
**Reason**: Cannot "unstart" a job  
**Why**: Work has begun, codes verified, cannot revert

### PAID → IN_PROGRESS ❌
**Reason**: Cannot restart completed job  
**Why**: Payment already processed, job is finished

### SCHEDULED → PAID ❌
**Reason**: Must go through IN_PROGRESS (start code verification)  
**Why**: Safety check to ensure work actually started

### OPEN → IN_PROGRESS ❌
**Reason**: Must go through SCHEDULED (offer acceptance)  
**Why**: Payment authorization required before work can start

### OPEN → PAID ❌
**Reason**: Cannot skip intermediate states  
**Why**: Multiple safety checks required (payment, codes)

---

## State Transition Guards

### Business Rules Enforced

1. **Payment State Consistency**
   - SCHEDULED requires PREAUTHORIZED payment
   - IN_PROGRESS requires PREAUTHORIZED payment
   - PAID requires CAPTURED payment
   - CANCELLED/EXPIRED requires VOIDED payment

2. **Code Verification Order**
   - Start code MUST be verified before completion code
   - Cannot verify completion without verifying start first
   - Codes expire after 78 hours (SCHEDULED only)

3. **Hustler Assignment**
   - Job must have assigned hustler for SCHEDULED, IN_PROGRESS, PAID
   - Job must NOT have hustler for OPEN
   - Cannot change hustler once start code verified

4. **Payment Authorization**
   - Job acceptance requires payment authorization
   - Cannot start job (IN_PROGRESS) without payment
   - Cannot complete job (PAID) without payment

5. **Cancellation Rules**
   - OPEN/SCHEDULED can be cancelled with void (no charge)
   - IN_PROGRESS cancellation requires refund (admin only)
   - PAID cannot be cancelled (terminal state)

---

## State Transition Flow Diagram

```
                    ┌─────────┐
                    │  OPEN   │
                    └────┬────┘
                         │
                 ┌───────┴───────┐
                 │               │
         Accept Offer    Cancel (no charge)
                 │               │
                 ▼               ▼
          ┌──────────┐    ┌───────────┐
          │SCHEDULED │    │ CANCELLED │
          └─────┬────┘    └───────────┘
                │              ▲
        ┌───────┼───────┐      │
        │       │       │      │
    Verify   Expire  Cancel    │
     Start    (78h)   (refund) │
        │       │       │      │
        ▼       ▼       │      │
   ┌─────────┐ ┌───────┴──┐   │
   │IN_PROGRESS│EXPIRED   │   │
   └─────┬────┘ └──────────┘   │
         │                      │
    Verify                  Cancel*
  Completion              (admin only)
         │                      │
         ▼                      │
      ┌──────┐                  │
      │ PAID │                  │
      └──────┘                  │
    (Terminal)◄─────────────────┘

* IN_PROGRESS → CANCELLED requires admin permission
```

---

## Error Messages for Invalid Transitions

### Attempting PAID → Any Other Status
```
Error: Cannot modify completed job
Message: This job has been completed and payment has been processed. Completed jobs cannot be modified.
```

### Attempting IN_PROGRESS → OPEN
```
Error: Invalid state transition
Message: Cannot revert job to OPEN after work has started. Job must be cancelled if needed.
```

### Attempting to Skip States
```
Error: Invalid state transition
Message: Job must progress through required states (OPEN → SCHEDULED → IN_PROGRESS → PAID).
```

### Verification Code Required
```
Error: Verification required
Message: Start code must be verified before job can progress to IN_PROGRESS.
```

---

## Implementation Notes

### Where State Transitions Happen

1. **OPEN → SCHEDULED**
   - File: `routes/offers.js`
   - Endpoint: `POST /offers/:id/accept`
   - Guards: Payment authorization, offer validation

2. **SCHEDULED → IN_PROGRESS**
   - File: `routes/verification.js`
   - Endpoint: `POST /verification/job/:jobId/verify-start`
   - Guards: Start code validation, expiration check

3. **IN_PROGRESS → PAID**
   - File: `routes/verification.js`
   - Endpoint: `POST /verification/job/:jobId/verify-completion`
   - Guards: Completion code validation, payment capture

4. **Any → CANCELLED**
   - File: `routes/jobs.js`
   - Endpoint: `POST /jobs/:id/cancel`
   - Guards: Status-specific cancellation logic

5. **SCHEDULED → EXPIRED**
   - File: `routes/verification.js`
   - Automatic: Checked during start code verification
   - Guards: Expiration time check (78 hours)

---

## Testing State Transitions

### Test Cases

1. **Valid: Complete Flow**
   - OPEN → SCHEDULED → IN_PROGRESS → PAID
   - Should succeed at each step

2. **Valid: Early Cancellation**
   - OPEN → CANCELLED (before acceptance)
   - SCHEDULED → CANCELLED (after acceptance, before start)

3. **Valid: Expiration**
   - SCHEDULED → EXPIRED (78 hours pass)

4. **Invalid: Skip States**
   - OPEN → IN_PROGRESS (should fail)
   - OPEN → PAID (should fail)
   - SCHEDULED → PAID (should fail)

5. **Invalid: Reverse**
   - IN_PROGRESS → OPEN (should fail)
   - PAID → IN_PROGRESS (should fail)

6. **Invalid: Terminal State Modification**
   - PAID → CANCELLED (should fail)
   - PAID → IN_PROGRESS (should fail)

---

## Future Enhancements (Phase 2)

### State Machine Enforcement (Optional)
- Add middleware to validate state transitions
- Reject invalid transitions at API level
- Log attempted invalid transitions for monitoring

### State History Tracking (Optional)
- Record all state changes with timestamps
- Track who initiated each transition
- Useful for audit trail and debugging

### Automated State Recovery (Optional)
- Detect stuck jobs (IN_PROGRESS for > 24 hours)
- Auto-expire jobs past deadline
- Alert admin of unusual state patterns

---

## Summary

**Valid Transitions**:
- OPEN → SCHEDULED ✅
- SCHEDULED → IN_PROGRESS ✅
- IN_PROGRESS → PAID ✅
- OPEN → CANCELLED ✅
- SCHEDULED → CANCELLED ✅
- SCHEDULED → EXPIRED ✅
- IN_PROGRESS → CANCELLED (admin only) ✅

**Blocked Transitions**:
- PAID → * (terminal) ❌
- IN_PROGRESS → OPEN ❌
- Any state skip ❌

**Terminal States**:
- PAID (normal completion)
- CANCELLED (customer/admin cancelled)
- EXPIRED (start code expired)

**Key Safety Checks**:
- Payment authorization before SCHEDULED
- Start code verification before IN_PROGRESS
- Completion code verification before PAID
- Expiration check (78 hours)

---

**Document Version**: 1.0  
**Last Updated**: December 23, 2025  
**Status**: Phase 1 Complete
