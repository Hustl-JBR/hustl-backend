# Add Gender and Bio Fields Migration

## Run this migration to add gender and bio fields to your database

Since you're on Railway, you need to run this migration manually or through Prisma.

### Option 1: Using Prisma Migrate (Recommended)

1. **Create the migration:**
   ```bash
   npx prisma migrate dev --name add_gender_bio
   ```

2. **Apply to production (Railway):**
   ```bash
   npx prisma migrate deploy
   ```

### Option 2: Manual SQL (If Prisma migrate doesn't work)

Run this SQL in your Railway database:

```sql
-- Add bio column
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add gender column
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
```

### Option 3: Railway Database Console

1. Go to Railway dashboard
2. Click on your database service
3. Click "Connect" or "Query"
4. Run the SQL above

## After Migration

Once the migration is complete:
- Gender field will appear in profile
- Bio field will work
- Profile updates will save correctly

## Test Mode for Stripe

If `SKIP_STRIPE_CHECK=true` is set in Railway:
- Stripe accounts are **FAKE** (for testing)
- No real Stripe API calls
- You can test the full flow without real Stripe accounts

To use real Stripe:
- Remove `SKIP_STRIPE_CHECK` from Railway variables
- Or set it to `false`
- You'll need real Stripe API keys

