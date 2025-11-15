# Test Mode - Skip Stripe Requirements

For testing with multiple users without creating real Stripe accounts, you can enable test mode.

## How to Enable Test Mode

Add this to your `.env` file:

```
SKIP_STRIPE_CHECK=true
```

## What This Does

When `SKIP_STRIPE_CHECK=true`:
- ✅ Hustlers can be accepted for jobs **without** connecting Stripe
- ✅ Customers can pay for jobs **without** hustlers having Stripe accounts
- ⚠️ **Real payments won't work** - this is for testing only
- ⚠️ **Hustlers won't actually get paid** - this bypasses the payment system

## Important Notes

- **This is for testing only** - Don't use in production!
- Stripe Connect features will be disabled
- Payment processing will be skipped
- You'll see `[TEST MODE]` messages in the server logs

## To Disable Test Mode

Remove `SKIP_STRIPE_CHECK=true` from your `.env` file, or set it to `false`:

```
SKIP_STRIPE_CHECK=false
```

Then restart your server.

