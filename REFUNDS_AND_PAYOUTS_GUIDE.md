# 💰 Refunds & Payouts Tracking Guide

## Overview

This guide explains how refunds and payouts are tracked, when they happen, and what notifications you'll receive.

## 🔴 REFUNDS

### When Refunds Happen

Refunds occur in these situations:

1. **Customer cancels job before work starts** (AUTOMATIC)
   - Payment is **voided** if pre-authorized (not captured)
   - Payment is **refunded** if already captured
   - Happens automatically when customer cancels

2. **Customer requests refund after 24 hours** (AUTOMATIC)
   - Customer can request refund if hustler doesn't respond after 24 hours
   - Only works if job hasn't started (start code not used)
   - Happens automatically via `/jobs/:id/request-refund` endpoint

3. **Admin manually processes refund** (MANUAL)
   - You (admin) can manually refund any captured payment
   - Use `/admin/refunds/:paymentId` endpoint
   - Requires reason and optional amount (partial refund)

### Refund Tracking

**What gets tracked:**
- Refund amount
- Refund reason
- Who processed it (admin ID)
- When it happened (timestamps)
- Original payment details
- Job and customer/hustler info

**Where to view:**
- **API Endpoint:** `GET /admin/refunds`
- Filter by status, date range, etc.
- Includes full payment details and customer/hustler info

**Database Fields:**
- `payments.refundAmount` - Amount refunded
- `payments.refundReason` - Why refunded
- `payments.refundedByAdminId` - Admin who processed it
- `payments.status` - Set to `REFUNDED` or `VOIDED`

### Refund Notifications

**Customer gets:**
- Email notification when refund is processed
- Shows refund amount and timeframe (5-10 business days)

**You (Admin) get:**
- Email notification for EVERY refund
- Includes: amount, reason, payment details, customer/hustler info
- Sent to `ADMIN_EMAIL` environment variable (or `FROM_EMAIL`)

**Audit Log:**
- Every refund creates an audit log entry
- Includes actor, action type, amount, reason, timestamps

---

## 💵 PAYOUTS

### When Payouts Happen

Payouts occur automatically when:
- Customer confirms job completion
- Payment is captured and released to hustler
- Transfer is created via Stripe Connect

**Note:** Payouts are currently **DISABLED in test mode** (when `SKIP_STRIPE_CHECK=true`)

### Payout Flow

1. **Customer confirms job completion**
   - Payment is captured
   - Stripe transfer is created (84% of job amount, 16% platform fee)
   - Payout record created with status `PROCESSING`

2. **Stripe processes transfer** (via webhook)
   - When transfer completes: Status → `COMPLETED`
   - When transfer fails: Status → `FAILED`
   - Hustler receives email notification

### Payout Tracking

**What gets tracked:**
- Payout amount (gross)
- Platform fee (16%)
- Net amount (to hustler)
- Payout status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`)
- Stripe transfer ID
- When created and completed

**Where to view:**
- **API Endpoint:** `GET /admin/payouts`
- Filter by status, date range, etc.
- Includes hustler info and job details

**Database Fields:**
- `payouts.amount` - Gross payout amount
- `payouts.platformFee` - Platform fee (16%)
- `payouts.netAmount` - Amount hustler receives (84%)
- `payouts.status` - Current status
- `payouts.payoutProviderId` - Stripe transfer ID
- `payouts.completedAt` - When payout completed

### Payout Notifications

**Hustler gets:**
- Email notification when payout is completed
- Shows amount and timeframe (1-3 business days)

**You (Admin) get:**
- Email notification for EVERY payout status change:
  - When payout is **initiated** (PROCESSING)
  - When payout is **completed** (COMPLETED)
  - When payout **fails** (FAILED)
- Includes: amount, platform fee, net amount, hustler info, job details
- Sent to `ADMIN_EMAIL` environment variable (or `FROM_EMAIL`)

---

## 📊 ADMIN DASHBOARD ENDPOINTS

### View All Refunds
```
GET /admin/refunds
Query params:
  - page (default: 1)
  - limit (default: 50)
  - status (REFUNDED, VOIDED)
  - dateFrom, dateTo (ISO dates)
```

### View All Payouts
```
GET /admin/payouts
Query params:
  - page (default: 1)
  - limit (default: 50)
  - status (PENDING, PROCESSING, COMPLETED, FAILED)
  - dateFrom, dateTo (ISO dates)
```

### View All Payments
```
GET /admin/payments
Query params:
  - page (default: 1)
  - limit (default: 50)
  - status (PREAUTHORIZED, CAPTURED, REFUNDED, VOIDED)
```

### Get Financial Stats
```
GET /admin/stats
Returns:
  - Total revenue
  - Total refunds
  - Total payouts
  - Platform fees
  - Recent activity (last 7 days)
```

### Manually Process Refund
```
POST /admin/refunds/:paymentId
Body:
  - reason (required)
  - amount (optional, for partial refunds)
```

**Note:** Requires `ADMIN` role. Make sure your user has the `ADMIN` role in the database.

---

## 🔔 EMAIL NOTIFICATIONS

### Setup Admin Email

Set these environment variables in your `.env`:

```env
ADMIN_EMAIL=your-admin@email.com  # Your email for notifications
FROM_EMAIL=Hustl <noreply@hustljobs.com>  # Sender email
RESEND_API_KEY=your-resend-api-key  # For sending emails
```

If `ADMIN_EMAIL` is not set, notifications will try to use `FROM_EMAIL`.

### What You'll Get Emailed About

**Refunds:**
- Every refund that's processed (automatic or manual)
- Includes full payment details and reason

**Payouts:**
- When payout is initiated (PROCESSING)
- When payout is completed (COMPLETED)
- When payout fails (FAILED)

---

## 🔄 STRIPE WEBHOOKS

The system automatically handles these Stripe webhook events:

1. **`charge.refunded`** - Tracks refunds processed via Stripe
2. **`transfer.created`** - Payout initiated
3. **`transfer.paid`** - Payout completed
4. **`transfer.failed`** - Payout failed

**Important:** Make sure your webhook endpoint is configured in Stripe Dashboard:
- Endpoint: `https://yourdomain.com/webhooks/stripe`
- Events to listen for:
  - `charge.refunded`
  - `transfer.created`
  - `transfer.paid`
  - `transfer.failed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`
  - `checkout.session.completed`

---

## ✅ AUTOMATION vs MANUAL

### Fully Automated (No Action Required)

✅ **Refunds:**
- Customer cancels job → Automatic void/refund
- Customer requests refund after 24 hours → Automatic refund

✅ **Payouts:**
- Customer confirms job → Automatic payout to hustler
- Stripe processes transfer → Status updated automatically

### Requires Manual Action

⚠️ **Refunds:**
- Partial refunds (you decide amount)
- Dispute resolutions
- Special cases

⚠️ **Payouts:**
- If payout fails, you may need to manually retry
- Check failed payouts via `/admin/payouts?status=FAILED`

---

## 📝 AUDIT LOGS

Every refund and payout action is logged in the `audit_logs` table:

- **Actor** - Who performed the action (admin ID or system)
- **Action Type** - `REFUND`, `VOID`, `PAYOUT`
- **Resource** - Payment or payout ID
- **Details** - Full JSON details (amount, reason, etc.)
- **Timestamp** - When it happened
- **IP Address** - Where it came from

---

## 🚨 IMPORTANT NOTES

1. **Test Mode:** Refunds and payouts are currently disabled in test mode (`SKIP_STRIPE_CHECK=true`)

2. **Admin Role:** You need the `ADMIN` role in your user account to access admin endpoints

3. **Email Setup:** Make sure `RESEND_API_KEY` and `FROM_EMAIL` are configured for notifications

4. **Webhooks:** Stripe webhooks must be configured for automatic status updates

5. **Database:** Payouts are stored in the `payouts` table, refunds update the `payments` table

---

## 🔍 QUICK REFERENCE

**View all refunds today:**
```
GET /admin/refunds?dateFrom=2025-01-19T00:00:00Z&dateTo=2025-01-19T23:59:59Z
```

**View pending payouts:**
```
GET /admin/payouts?status=PENDING
```

**View financial overview:**
```
GET /admin/stats
```

**Manually refund a payment:**
```
POST /admin/refunds/payment_id_here
{
  "reason": "Customer dispute - partial refund",
  "amount": 50.00  // Optional for partial refunds
}
```

