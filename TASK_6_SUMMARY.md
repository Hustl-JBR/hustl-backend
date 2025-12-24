# TASK 6 COMPLETED: Payment Reconciliation Script (Read-Only)

**Status**: ✅ COMPLETED  
**Date**: December 23, 2025  
**Type**: Phase 1 - Detection & Reporting Only

---

## What Was Created

**Script**: `/app/scripts/reconcile-payments.js`

A lightweight, read-only script that detects payment status drift between Stripe and Database.

---

## Features

✅ **Read-Only** - Zero modifications to database or Stripe  
✅ **Drift Detection** - Compares DB status with Stripe payment intent status  
✅ **Clear Reporting** - Formatted output showing discrepancies  
✅ **Error Handling** - Handles missing payment intents gracefully  
✅ **Summary Statistics** - Groups discrepancies by type  

---

## How to Run

```bash
# Navigate to app directory
cd /app

# Run reconciliation script
node scripts/reconcile-payments.js
```

**Requirements**:
- `STRIPE_SECRET_KEY` environment variable must be set
- Prisma client must be configured
- Database connection available

---

## Sample Output

### When Everything is Synchronized:
```
🔍 Payment Reconciliation Report
================================

Mode: TEST
Time: 2025-12-23T22:45:00.000Z

📊 Checking 47 payments...

Checked 47 payments

✅ SUCCESS: All payment statuses are synchronized!
No discrepancies found between Stripe and Database.

ℹ️  This is a READ-ONLY report. No data has been modified.
ℹ️  To fix discrepancies, use admin tools or manual intervention.

✅ Reconciliation complete
```

### When Discrepancies Found:
```
🔍 Payment Reconciliation Report
================================

Mode: TEST
Time: 2025-12-23T22:45:00.000Z

📊 Checking 47 payments...

Checked 47 payments

⚠️  DISCREPANCIES FOUND: 3

┌─────────────────────────────────────────────────────────────────────────────────┐
│ Payment Status Discrepancies (Stripe ↔ Database)                               │
└─────────────────────────────────────────────────────────────────────────────────┘

1. Payment ID: pay_abc123
   Job: Lawn Mowing (PAID)
   Customer: John Doe
   Hustler: Jane Smith
   Amount: $100.00
   Database Status: PREAUTHORIZED
   Stripe Status: CAPTURED (raw: succeeded)
   Stripe Payment Intent: pi_abc123def
   Created: 2025-12-23T10:30:00.000Z

2. Payment ID: pay_def456
   Job: House Cleaning (CANCELLED)
   Customer: Bob Johnson
   Hustler: Alice Williams
   Amount: $150.00
   Database Status: PREAUTHORIZED
   Stripe Status: VOIDED (raw: canceled)
   Stripe Payment Intent: pi_def456ghi
   Created: 2025-12-22T14:20:00.000Z

─────────────────────────────────────────────────────────────────────────────────
Total Discrepancies: 2
─────────────────────────────────────────────────────────────────────────────────

Discrepancy Types:
  PREAUTHORIZED → CAPTURED: 1
  PREAUTHORIZED → VOIDED: 1

ℹ️  This is a READ-ONLY report. No data has been modified.
ℹ️  To fix discrepancies, use admin tools or manual intervention.

✅ Reconciliation complete
```

---

## Status Mapping

The script maps Stripe payment intent statuses to database statuses:

| Stripe Status | Database Status | Description |
|--------------|----------------|-------------|
| `requires_payment_method` | PREAUTHORIZED | Waiting for payment method |
| `requires_confirmation` | PREAUTHORIZED | Waiting for confirmation |
| `requires_action` | PREAUTHORIZED | Requires customer action |
| `processing` | PREAUTHORIZED | Being processed |
| `requires_capture` | PREAUTHORIZED | Authorized, not captured |
| `succeeded` | CAPTURED | Payment captured |
| `canceled` | VOIDED | Payment voided/canceled |

---

## What Gets Checked

1. **Fetches payments** with `providerId` (Stripe payment intent ID)
2. **Queries Stripe** for each payment intent
3. **Compares status** between database and Stripe
4. **Reports mismatches** with full context

**Limits**: Checks most recent 100 payments to avoid timeouts

---

## Common Discrepancies

### 1. PREAUTHORIZED → CAPTURED
**Cause**: Payment was captured in Stripe but database wasn't updated  
**Resolution**: Webhook should sync this, or admin can manually update

### 2. PREAUTHORIZED → VOIDED
**Cause**: Payment was canceled in Stripe but database wasn't updated  
**Resolution**: Webhook should sync this, or admin can manually update

### 3. Database has status, Stripe shows NOT_FOUND
**Cause**: Payment intent was deleted or never existed  
**Resolution**: Investigate why payment intent is missing

---

## Usage Scenarios

### Manual Check (Ad-Hoc)
```bash
node scripts/reconcile-payments.js
```
Run whenever you suspect drift or want to verify consistency.

### Scheduled Check (Cron - Optional)
```bash
# Add to crontab (not implemented yet, just documented)
# Run daily at 2 AM
0 2 * * * cd /app && node scripts/reconcile-payments.js >> /var/log/reconciliation.log 2>&1
```

### After Webhook Issues
If webhooks were down or failing, run reconciliation to detect any missed status updates.

### Before Important Operations
Run before financial reports or payouts to ensure data accuracy.

---

## Files Created

**scripts/reconcile-payments.js** (~200 lines)
- Read-only reconciliation script
- Stripe API integration
- Formatted reporting
- Error handling

**TASK_6_SUMMARY.md** (this file)
- Documentation and usage instructions

---

## Production Safety

✅ **Read-only** - Cannot modify database or Stripe  
✅ **Lightweight** - Checks 100 most recent payments  
✅ **Safe to run anytime** - No side effects  
✅ **Clear output** - Easy to understand results  
✅ **Error tolerant** - Continues on individual payment errors  
✅ **No schema changes**  
✅ **No dependencies added**  

---

## What's NOT Included

❌ Automatic fixes (by design)  
❌ Email notifications (can be added later)  
❌ Scheduled execution (can be added via cron)  
❌ Historical tracking (reports current state only)  
❌ Web UI (command-line only)  

---

## Next Steps (Optional Enhancements)

**Phase 1 Remaining** (if approved):
- Task 7: Job State Machine Documentation

**Phase 2 Potential** (later):
- Add automatic reconciliation (with approval)
- Add email alerts for discrepancies
- Track reconciliation history
- Add web UI for viewing reports

**For Now**: Manual execution only, read-only detection

---

## Testing the Script

### Test in Development
```bash
# Set test Stripe key
export STRIPE_SECRET_KEY=sk_test_...

# Run script
node scripts/reconcile-payments.js
```

### Test in Production (Railway)
```bash
# SSH into Railway container (if available)
railway run node scripts/reconcile-payments.js

# Or run via Railway CLI
railway run bash -c "cd /app && node scripts/reconcile-payments.js"
```

---

## Alignment Confirmed

✅ **Read-only only** - No automatic fixes  
✅ **Detection + reporting** - Clear discrepancy output  
✅ **No schema changes** - Pure detection logic  
✅ **Lightweight** - Single script, minimal overhead  
✅ **Phase 1 scope** - Stability & detection only  

**Task 6 complete. Ready for deployment approval.**
