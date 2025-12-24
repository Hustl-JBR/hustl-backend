# Test Result Tracker

## Current Testing Focus: Phase 2 Implementation

### Test Scenarios Required

#### Phase 2A: Flat-Rate Price Change Deprecation
1. **Deprecated Endpoint Test (propose-price-change)**
   - Call `POST /jobs/:id/propose-price-change` 
   - Expected: 410 Gone with deprecation message

2. **Deprecated Endpoint Test (accept-price-change)**
   - Call `POST /jobs/:id/accept-price-change`
   - Expected: 410 Gone with deprecation message

3. **Deprecated Endpoint Test (decline-price-change)**
   - Call `POST /jobs/:id/decline-price-change`
   - Expected: 410 Gone with deprecation message

4. **Deprecated Endpoint Test (finalize-price-change)**
   - Call `POST /jobs/:id/finalize-price-change`
   - Expected: 410 Gone with deprecation message

#### Phase 2B: Hourly Job Buffer
5. **Offer Acceptance - Buffer Calculation**
   - Create hourly job (e.g., 4 hrs @ $25/hr)
   - Accept offer
   - Verify: `maxHours = 6` (4 × 1.5) stored in job.requirements
   - Verify: Payment authorized for $150 (6 × $25)

6. **Completion - Under Buffer**
   - Complete job after working less than maxHours
   - Verify: Partial capture of actual hours worked
   - Verify: Unused authorization auto-released

7. **Completion - Exceeds Buffer**
   - Attempt to complete job after working more than maxHours
   - Expected: 400 error with code `BUFFER_EXCEEDED`

8. **Deprecated Endpoint Test (extend-hours)**
   - Call `POST /verification/job/:jobId/extend-hours`
   - Expected: 410 Gone with deprecation message

### Testing Protocol
- Backend tests should cover all deprecated endpoints
- Test both flat-rate and hourly job flows
- Verify backward compatibility with existing jobs

### Incorporate User Feedback
- None at this time

### Test Files
- `/app/tests/pricing.test.js` - Fee calculation tests
- `/app/tests/stripe-idempotency.test.js` - Stripe idempotency tests
- `/app/tests/phase2-deprecation.test.js` - Phase 2 deprecation tests (to be created)
