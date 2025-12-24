# Phase 2 Implementation Plan: Payment Model Simplification

**Status**: PLAN (Not Implemented)  
**Date**: December 23, 2025  
**Decisions Confirmed**:
- Flat-rate: Prohibit post-acceptance price changes
- Hourly: Single pre-authorization with 1.5x buffer

---

## Implementation Overview

### Goals
1. Remove fragile delta payment logic (Flow B)
2. Establish single PaymentIntent per job as source of truth
3. Simplify hourly job authorization (no extensions)
4. Maintain backward compatibility for existing jobs
5. Zero data loss or payment disruption

### Phases
- **Phase 2A**: Flat-Rate Simplification (remove Flow B)
- **Phase 2B**: Hourly Job Simplification (buffer authorization)
- **Phase 2C**: Cleanup and Migration

---

## Phase 2A: Flat-Rate Simplification

### Step 1: Identify Affected Code

**Endpoints to Remove/Disable**:
1. `POST /jobs/:id/propose-price-change` - Hustler proposes new price
2. `POST /jobs/:id/accept-price-change` - Customer accepts proposal
3. `POST /jobs/:id/finalize-price-change` - Finalize after payment authorization

**Files to Modify**:
- `routes/jobs.js` - Remove price change endpoints
- Database: Mark fields as deprecated (don't delete yet)

**Frontend Changes Needed**:
- Remove "Propose New Price" button (post-acceptance)
- Add message: "Price is locked after acceptance. Negotiate during offer phase."
- Update offer acceptance flow to emphasize final price

---

### Step 2: Backend Logic Changes (Flat-Rate)

#### 2.1: Remove Price Change Endpoints

**Current Flow to Remove**:
```
Hustler clicks "Propose New Price" 
  → POST /jobs/:id/propose-price-change
  → Stores in job.requirements.proposedPriceChange
  → Calculates delta amount
  → Creates delta PaymentIntent
  → Stores in job.requirements.differencePaymentIntentId
  
Customer clicks "Accept"
  → POST /jobs/:id/accept-price-change
  → Returns payment intent for delta authorization
  
Customer authorizes delta payment
  → POST /jobs/:id/finalize-price-change
  → Updates job.amount to new price
```

**Action**:
- Disable these endpoints (return 410 Gone or 403 Forbidden)
- Add clear error message explaining policy change
- Log any attempts to use these endpoints (monitoring)

#### 2.2: Update Job Acceptance Logic

**Ensure Single PaymentIntent Creation**:
- ✅ Already creates single PaymentIntent in `routes/offers.js` (accept offer)
- ✅ Already stores in `payment.providerId`
- ✅ No changes needed here (already correct)

**Verify No Delta Creation**:
- Check offer acceptance flow doesn't create delta intents
- Confirm `payment.providerId` is always single intent

#### 2.3: Update Job Completion Logic

**Ensure Capture Uses Single PaymentIntent**:
- ✅ Already captures from `payment.providerId` in `routes/verification.js`
- ✅ No changes needed (already correct)

**Verify No Delta Capture Logic**:
- Remove any code that attempts to capture from `requirements.differencePaymentIntentId`
- If found, replace with capture from single `payment.providerId`

---

### Step 3: Handle Existing Jobs with Delta PaymentIntents

**Problem**: Some jobs in database may have:
- `requirements.proposedPriceChange` set
- `requirements.differencePaymentIntentId` set
- Delta PaymentIntent exists in Stripe but never captured

**Solution: Read-Only Deprecation**

**Jobs with Status OPEN or SCHEDULED**:
- If has delta intent: Void it (clean up)
- Remove from requirements JSON
- Use original payment intent only
- Log this action for audit

**Jobs with Status IN_PROGRESS or PAID**:
- Leave as-is (don't modify completed/active jobs)
- Historical record, no impact on future operations

**Migration Script** (will create later):
```
Script: scripts/migrate-delta-payments.js
Purpose: Find and void orphaned delta PaymentIntents
Action: Read-only detection first, then cleanup with approval
```

---

### Step 4: Stripe API Changes (Flat-Rate)

**No Changes to Stripe Calls**:
- ✅ Offer acceptance already creates single PaymentIntent
- ✅ Completion already captures single PaymentIntent
- ✅ Cancellation already voids single PaymentIntent

**Remove**:
- ❌ Creation of delta PaymentIntents (in propose-price-change endpoint)
- ❌ Authorization of delta PaymentIntents (in accept-price-change endpoint)

**Stripe Operations Remain**:
- ✅ `stripe.paymentIntents.create()` - On offer acceptance
- ✅ `stripe.paymentIntents.capture()` - On job completion
- ✅ `stripe.paymentIntents.cancel()` - On cancellation
- ✅ `stripe.transfers.create()` - Hustler payout

---

### Step 5: Frontend/UX Changes (Flat-Rate)

**Minimal Changes Required**:

**1. Remove UI Elements** (post-acceptance):
- "Propose New Price" button (after SCHEDULED status)
- Price change dialog/modal
- Price negotiation UI (after acceptance)

**2. Add Messaging**:
- During offer phase: "This is your final price if accepted"
- After acceptance: "Price is locked. Contact support for changes."
- Offer comparison: Emphasize comparing prices before accepting

**3. Enhance Offer Phase**:
- Make price negotiation more prominent during offers
- Show customer: "Review and negotiate prices before accepting"
- Hustler offer UI: Clearly show this is final price

**4. Cancellation Policy**:
- Update cancellation message: "To change price, cancel and repost job"
- Add friction for cancellation (confirmation dialog)

**No Major Redesign**:
- Existing offer flow stays the same
- Acceptance flow stays the same
- Completion flow stays the same

---

## Phase 2B: Hourly Job Simplification

### Step 1: Identify Affected Code (Hourly)

**Current Extension Logic to Remove**:
1. Extension payment intent creation
2. Extension payment intent storage in `requirements.extensionPaymentIntents[]`
3. Complex capture logic across multiple intents

**Files to Modify**:
- `routes/jobs.js` - Job creation (add buffer calculation)
- `routes/offers.js` - Offer acceptance (use buffered amount)
- `routes/verification.js` - Completion capture (partial capture only)

**Frontend Changes Needed**:
- Show buffered authorization amount clearly
- Display: "Authorizing up to [max hours] hours, charged for actual"
- Remove extension payment flows

---

### Step 2: Backend Logic Changes (Hourly)

#### 2.1: Update Job Creation Logic

**Current**:
- Customer posts: $25/hr × 4 hours = $100
- Estimated amount stored: $100

**New**:
- Customer posts: $25/hr × 4 hours estimated
- Calculate buffer: 4 hours × 1.5 = 6 hours max
- Store: `estHours: 4`, `maxHours: 6`
- Authorization amount: $25 × 6 = $150

**Changes in `routes/jobs.js`**:
```
POST /jobs (hourly type)
  → Receive: hourlyRate, estHours
  → Calculate: maxHours = estHours × 1.5
  → Store: { hourlyRate, estHours, maxHours }
  → Display to customer: "Authorization up to $[maxAmount]"
```

**Database Fields**:
- Add `job.maxHours` field (optional, or calculate on-the-fly)
- Store buffer multiplier in config (1.5x)

#### 2.2: Update Offer Acceptance Logic (Hourly)

**Current**:
- Creates PaymentIntent for estimated hours: $100 + fee

**New**:
- Creates PaymentIntent for max hours: $150 + fee
- `paymentIntent.amount = (hourlyRate × maxHours) + (amount × 0.065)`
- Customer sees larger authorization but understands it's maximum

**Changes in `routes/offers.js`**:
```
POST /offers/:id/accept (hourly job)
  → Calculate: maxAmount = hourlyRate × maxHours
  → Create PaymentIntent for: maxAmount + customerFee
  → Store single providerId in payment.providerId
  → Metadata: { estimatedHours, maxHours, hourlyRate }
```

#### 2.3: Remove Extension Payment Logic

**Current Extension Flow to Remove**:
```
Customer adds 2 hours
  → POST /jobs/:id/extend-hours
  → Creates extension PaymentIntent
  → Stores in requirements.extensionPaymentIntents[]
  → Customer authorizes extension
```

**New Approach**:
- No extensions needed (buffer handles it)
- If actual hours exceed max hours: Reject completion or request new payment

**Endpoint to Remove/Modify**:
- `POST /jobs/:id/extend-hours` - Disable or remove entirely

**Buffer Exceeded Handling**:
```
If actualHours > maxHours:
  → Option 1: Reject completion with message
  → Option 2: Allow completion, request additional payment (separate flow)
  → Recommendation: Option 1 (simpler, safer)
```

#### 2.4: Update Completion Capture Logic (Hourly)

**Current**:
- Complex: Loop through original + extension intents
- Capture proportionally from each

**New**:
- Simple: Partial capture from single PaymentIntent
- Capture only actual amount

**Changes in `routes/verification.js`**:
```
POST /verification/job/:jobId/verify-completion (hourly)
  → Calculate: actualAmount = hourlyRate × actualHours
  → Calculate: actualTotal = actualAmount + (actualAmount × 0.065)
  → Partial Capture: 
       stripe.paymentIntents.capture(paymentIntentId, {
         amount_to_capture: actualTotal
       })
  → Stripe auto-releases: maxTotal - actualTotal
  → Transfer to hustler: actualAmount - platformFee
```

**Automatic Refund**:
- Stripe automatically releases unused authorization
- Customer sees: Pending $150 → Charged $87.50 → Released $62.50
- No manual refund needed

---

### Step 3: Handle Existing Hourly Jobs with Extensions

**Problem**: Some active hourly jobs may have:
- `requirements.extensionPaymentIntents[]` populated
- Extension PaymentIntents in Stripe (authorized but not captured)

**Solution: Support Legacy Format**

**Jobs with Status OPEN or SCHEDULED**:
- New buffer logic applies
- No extensions created going forward
- Existing extensions: Void and remove (cleanup)

**Jobs with Status IN_PROGRESS**:
- **Critical**: Do NOT break active jobs
- Support old completion logic for these jobs only
- Once completed, no new jobs use extensions

**Migration Strategy**:
1. Add feature flag: `HOURLY_BUFFER_ENABLED` (default: true)
2. Check if job has extensions: Use old logic
3. If no extensions: Use new buffer logic
4. Gradual migration as jobs complete

**Code Structure**:
```
In verification.js (completion):
  if (job has extensionPaymentIntents) {
    // Use old capture logic (legacy support)
  } else {
    // Use new partial capture logic
  }
```

---

### Step 4: Stripe API Changes (Hourly)

**Offer Acceptance**:
- ✅ `stripe.paymentIntents.create()` - Same, but with higher amount
- Change: `amount: maxHours × rate` instead of `estHours × rate`

**Completion Capture**:
- ✅ `stripe.paymentIntents.capture()` - Same, but with `amount_to_capture`
- Change: Use partial capture parameter
- Automatic: Stripe releases unused authorization

**Remove**:
- ❌ Extension PaymentIntent creation
- ❌ Multiple intent capture loop

**Add Validation**:
- Check: `actualHours <= maxHours` before capture
- If exceeded: Error or additional payment flow

---

### Step 5: Frontend/UX Changes (Hourly)

**Minimal Changes Required**:

**1. Job Creation UI**:
- Display: "Authorizing up to [6 hours] (150% of estimate)"
- Show: "You'll only be charged for actual time worked"
- Clarify: "Unused amount automatically refunded"

**2. Offer Acceptance**:
- Customer sees: "Authorization: $150 (up to 6 hours)"
- Below: "Final charge based on actual hours worked"
- Payment method: Shows pending charge

**3. Job Progress**:
- Display max hours available
- Show when approaching buffer limit
- Alert if hours will exceed buffer

**4. Completion**:
- Show: "Worked 3.5 hours → Charging $87.50"
- Show: "Releasing unused $62.50"
- Clear breakdown of charges

**5. Remove Extension UI**:
- "Add More Hours" button (post-acceptance)
- Extension payment authorization flow
- Extension management interface

**No Major Redesign**:
- Core hourly job flow stays same
- Just different authorization amounts
- Completion remains verification code based

---

## Phase 2C: Cleanup and Migration

### Step 1: Database Cleanup

**Mark Fields as Deprecated** (don't delete immediately):
- `job.requirements.proposedPriceChange`
- `job.requirements.differencePaymentIntentId`
- `job.requirements.extensionPaymentIntents`

**Add New Fields** (if needed):
- `job.maxHours` - Store maximum authorized hours
- Or calculate on-the-fly from `estHours × 1.5`

**Migration Script**:
```
Script: scripts/cleanup-delta-intents.js
Actions:
  1. Find jobs with delta payment intents
  2. Check Stripe status of these intents
  3. Void uncaptured intents
  4. Clear from requirements JSON
  5. Generate cleanup report
```

---

### Step 2: Void Orphaned PaymentIntents

**Problem**: Orphaned delta/extension PaymentIntents in Stripe

**Solution**: Cleanup script

**Script Logic**:
```
1. Query jobs with:
   - requirements.differencePaymentIntentId IS NOT NULL
   - requirements.extensionPaymentIntents IS NOT NULL

2. For each PaymentIntent found:
   - Check Stripe status
   - If requires_capture: Void it
   - If canceled/succeeded: Leave as-is (historical)
   - Remove from requirements JSON

3. Generate report:
   - Total intents found
   - Total voided
   - Total left as-is
   - Any errors encountered
```

**Safety**:
- Read-only mode first (detect only)
- Show report to admin
- Admin approves cleanup
- Then execute void operations

---

### Step 3: Update Documentation

**Update Files**:
1. `JOB_STATE_MACHINE.md` - Remove price change transitions
2. `CORE_SYSTEM_LOGIC_REFERENCE.md` - Update payment flows
3. Create: `PAYMENT_MODEL_V2.md` - Document new payment model

**API Documentation**:
- Mark deprecated endpoints in docs
- Update examples to show new flow
- Add migration guide for integrations

---

### Step 4: Monitoring and Validation

**Add Logging**:
- Log attempts to use deprecated endpoints
- Track completion captures (partial vs full)
- Monitor buffer overflow scenarios
- Alert on unusual payment patterns

**Metrics to Track**:
- Jobs using old vs new payment model
- Buffer utilization (actual hours / max hours ratio)
- Completion success rate
- Payment failures due to buffer exceeded

**Reconciliation Updates**:
- Update reconciliation script to handle both models
- Flag any jobs still using legacy extensions
- Report on cleanup progress

---

## Implementation Order

### Phase 2A: Flat-Rate (Week 1)

**Day 1-2: Preparation**
- Run detection: Find jobs with delta intents
- Analyze impact: How many active jobs affected?
- Create cleanup script (read-only mode first)

**Day 3-4: Implementation**
- Disable price change endpoints (return 410 Gone)
- Add clear error messages
- Update frontend to remove UI elements
- Deploy to test mode

**Day 5: Validation**
- Test offer acceptance (verify single intent)
- Test completion (verify single capture)
- Run reconciliation (should be clean)
- Deploy to production

**Day 6-7: Cleanup**
- Run cleanup script (void orphaned intents)
- Monitor for any issues
- Generate cleanup report

---

### Phase 2B: Hourly (Week 2)

**Day 1-2: Preparation**
- Analyze hourly job data (average actual vs estimated)
- Determine optimal buffer multiplier (confirm 1.5x)
- Plan backward compatibility for in-progress jobs

**Day 3-5: Implementation**
- Update job creation (calculate max hours)
- Update offer acceptance (authorize max amount)
- Update completion capture (partial capture)
- Add buffer exceeded handling
- Deploy to test mode

**Day 6: Validation**
- Test hourly job creation (verify max authorization)
- Test completion under buffer (verify partial capture)
- Test completion over buffer (verify rejection)
- Verify unused refund (check Stripe)
- Deploy to production

**Day 7: Monitoring**
- Track buffer utilization
- Monitor for exceeded buffers
- Check customer feedback
- Adjust buffer if needed

---

### Phase 2C: Cleanup (Week 3)

**Day 1-2: Legacy Support**
- Ensure in-progress jobs complete successfully
- Remove extension payment endpoints
- Clean up old code paths

**Day 3-4: Documentation**
- Update all docs
- Create migration guide
- Update API documentation

**Day 5-7: Final Cleanup**
- Remove deprecated fields (after confirming zero usage)
- Archive old code (Git history)
- Performance optimization
- Final reconciliation check

---

## Testing Strategy

### Flat-Rate Testing

**Test Cases**:
1. Create flat job → Accept offer → Complete
   - Verify: Single PaymentIntent created
   - Verify: Capture from single intent
   - Verify: Correct fees calculated

2. Attempt price change after acceptance
   - Verify: Endpoint returns 410 Gone
   - Verify: Clear error message shown
   - Verify: No delta intent created

3. Cancel flat job
   - Verify: Single intent voided
   - Verify: Customer refunded
   - Verify: No orphaned intents

4. Reconciliation
   - Verify: Single payment intent matches DB
   - Verify: No drift detected
   - Verify: Clean audit trail

---

### Hourly Testing

**Test Cases**:
1. Create hourly job (4 hours) → Accept
   - Verify: PaymentIntent for 6 hours (1.5x buffer)
   - Verify: Single intent with correct amount
   - Verify: Customer sees max authorization

2. Complete under buffer (3.5 hours actual)
   - Verify: Partial capture for 3.5 hours
   - Verify: Unused 2.5 hours released
   - Verify: Correct hustler payout
   - Verify: Correct platform fee

3. Complete at buffer limit (6 hours actual)
   - Verify: Full capture for 6 hours
   - Verify: No refund (all used)
   - Verify: Correct payments

4. Attempt completion over buffer (7 hours)
   - Verify: Error message shown
   - Verify: Job not completed
   - Verify: Instruction to add more hours

5. Reconciliation
   - Verify: Single payment intent
   - Verify: Captured amount matches actual hours
   - Verify: Platform fees correct

---

### Migration Testing

**Test Cases**:
1. Existing job with delta intent
   - Verify: Cleanup script detects it
   - Verify: Intent voided successfully
   - Verify: Removed from requirements
   - Verify: Job can still complete

2. Existing hourly job with extensions
   - Verify: Old capture logic still works
   - Verify: Job completes successfully
   - Verify: Fees calculated correctly

3. Mixed scenario
   - Old jobs: Still work with legacy logic
   - New jobs: Use new simplified logic
   - Reconciliation: Both types tracked correctly

---

## Risk Mitigation

### Risk 1: Breaking Active Jobs

**Mitigation**:
- Feature flags for gradual rollout
- Backward compatibility for in-progress jobs
- Test extensively in test mode first
- Monitor error rates during deployment

### Risk 2: Payment Intent Void Failures

**Mitigation**:
- Check intent status before voiding
- Handle already-voided gracefully
- Log all void operations
- Manual review for any failures

### Risk 3: Buffer Too Small (Hourly)

**Mitigation**:
- Start with conservative 1.5x multiplier
- Monitor actual vs max hours ratio
- Adjust multiplier if needed
- Provide manual extension option (admin)

### Risk 4: Customer Confusion

**Mitigation**:
- Clear messaging during authorization
- Show "pending hold" vs "final charge"
- Email receipts explaining refunds
- Support documentation updated

### Risk 5: Reconciliation Issues

**Mitigation**:
- Update reconciliation script first
- Handle both old and new models
- Generate comparison reports
- Flag any anomalies

---

## Rollback Plan

### If Issues Arise

**Flat-Rate Rollback**:
1. Re-enable price change endpoints
2. Restore UI elements
3. Revert to old logic
4. Zero data loss (deprecation, not deletion)

**Hourly Rollback**:
1. Disable buffer authorization
2. Re-enable extension payments
3. Use old capture logic
4. Continue with existing flow

**Partial Rollback**:
- Can roll back flat-rate independently of hourly
- Can roll back hourly independently of flat-rate
- Feature flags allow per-job-type rollback

---

## Success Criteria

### Flat-Rate Success
- ✅ Zero jobs with multiple PaymentIntents
- ✅ Reconciliation shows 100% single-intent jobs
- ✅ No orphaned delta intents in Stripe
- ✅ Customer support tickets about price changes decrease
- ✅ Payment state always clear and consistent

### Hourly Success
- ✅ Zero jobs with extension PaymentIntents
- ✅ Partial capture working correctly
- ✅ Buffer overflow rate < 5% of jobs
- ✅ Automatic refunds processing correctly
- ✅ Reconciliation clean for hourly jobs

### Overall Success
- ✅ Single PaymentIntent per job (all types)
- ✅ Payment-to-job status mapping 1:1
- ✅ Reconciliation script reports zero drift
- ✅ Platform fees calculated consistently
- ✅ Audit trail clear and complete

---

## Post-Implementation

### Week 1 After Deployment
- Monitor error rates daily
- Check reconciliation reports
- Review customer feedback
- Fix any edge cases found

### Month 1 After Deployment
- Analyze buffer utilization (hourly)
- Review support tickets
- Adjust buffer multiplier if needed
- Remove deprecated code if clean

### Month 3 After Deployment
- Permanent cleanup of deprecated fields
- Archive old payment logic code
- Finalize documentation
- Declare Phase 2 complete

---

## Open Questions (For Discussion)

1. **Buffer Exceeded (Hourly)**:
   - Should we allow completion with additional payment?
   - Or strictly reject and require pre-approval?
   - **Recommendation**: Start with rejection (simpler)

2. **Feature Flags**:
   - Should we use feature flags for gradual rollout?
   - Or deploy all at once?
   - **Recommendation**: Use flags for safety

3. **Migration Timeline**:
   - How quickly to clean up deprecated fields?
   - Wait 30 days? 90 days? 6 months?
   - **Recommendation**: 90 days (safe window)

4. **Customer Communication**:
   - Email announcement of policy changes?
   - In-app notifications?
   - **Recommendation**: Both, plus updated help docs

5. **Admin Override**:
   - Should admins be able to manually adjust prices?
   - If yes, use void+replace pattern?
   - **Recommendation**: Yes, admin-only with audit log

---

## Next Steps

**After Plan Approval**:
1. ✅ Create detailed code implementation for Phase 2A (flat-rate)
2. ✅ Break down into PRs (small, incremental)
3. ✅ Implement with testing at each step
4. ✅ Deploy to test mode, validate
5. ✅ Deploy to production, monitor
6. ✅ Repeat for Phase 2B (hourly)

**Immediate Actions**:
1. Run detection script (find delta intents)
2. Analyze impact (how many jobs affected)
3. Get final approval on approach
4. Begin Phase 2A implementation

---

**Document Version**: 1.0 (Implementation Plan)  
**Status**: Awaiting Approval to Implement  
**Next**: Code Implementation (after approval)
