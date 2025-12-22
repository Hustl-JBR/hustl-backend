# Payment Flow Verification

## Example: $100 Job

### Customer Side:
- **Job Amount**: $100.00
- **Service Fee (6.5%)**: $6.50
- **Total Customer Pays**: $106.50 ✅

### Platform Side:
- **Platform Fee (12%)**: $12.00 → STAYS IN PLATFORM ACCOUNT
- **Customer Service Fee (6.5%)**: $6.50 → STAYS IN PLATFORM ACCOUNT
- **Total Platform Keeps**: $18.50

### Hustler Side:
- **Job Amount**: $100.00
- **Platform Fee (12%)**: -$12.00
- **Hustler Receives**: $88.00 ✅

## Calculation Logic

```javascript
// For ALL job types (flat, hourly, negotiated):
actualJobAmount = // Actual amount charged (negotiated price for flat jobs, actual hours × rate for hourly)
platformFee = actualJobAmount * 0.12  // 12% platform fee
hustlerPayout = actualJobAmount - platformFee  // What hustler receives
customerServiceFee = actualJobAmount * 0.065  // 6.5% service fee (stays with platform)
customerTotalCharged = actualJobAmount + customerServiceFee  // What customer pays
```

## Job Type Verification

### ✅ Flat Jobs
- Uses `payment.amount` (negotiated price if negotiated, otherwise `job.amount`)
- Platform fee: 12% of job amount
- Hustler receives: job amount - 12%

### ✅ Hourly Jobs
- Calculates `actualJobAmount = actualHours × hourlyRate`
- Platform fee: 12% of actual amount
- Hustler receives: actual amount - 12%
- Customer refund: unused portion automatically released by Stripe

### ✅ Negotiated Prices
- When hustler proposes price: `job.amount` updated to negotiated price
- `payment.amount` set to negotiated price
- All calculations use negotiated price
- Platform fee: 12% of negotiated price
- Hustler receives: negotiated price - 12%

### ✅ Tips
- 100% goes to hustler (no platform fee)
- Transferred directly via Stripe `transfer_data`
- Hustler receives email + in-app notification

## Verification Points

1. ✅ Hustler receives job amount WITHOUT the 6.5% service fee
2. ✅ 6.5% service fee stays in platform account
3. ✅ 12% platform fee stays in platform account
4. ✅ All job types (flat, hourly, negotiated) use same calculation
5. ✅ Tips go 100% to hustler
6. ✅ Payment transferred to hustler's Stripe Connect account

