# Backend Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Fill in all required values (see below)
   ```

3. **Set up database:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start server:**
   ```bash
   npm run dev
   ```

Server will run on `http://localhost:8080`

## Environment Variables Required

### Database (Neon Postgres)
```
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

### Stripe
1. Create account at https://stripe.com
2. Get API keys from Dashboard → Developers → API keys
3. Set up webhook endpoint: `https://your-domain.com/webhooks/stripe`
4. Get webhook secret from webhook settings
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Mapbox
1. Create account at https://mapbox.com
2. Get token from Account → Access tokens
```
MAPBOX_TOKEN=pk.***
```

### Cloudflare R2
1. Create account at https://cloudflare.com
2. Create R2 bucket
3. Create API token with R2 permissions
4. Set up public domain (optional, for public URLs)
```
R2_ACCOUNT_ID=***
R2_ACCESS_KEY_ID=***
R2_SECRET_ACCESS_KEY=***
R2_BUCKET=hustl-uploads
R2_PUBLIC_BASE=https://your-r2-domain.com
```

### Resend
1. Create account at https://resend.com
2. Verify your domain (or use test domain)
3. Get API key
```
RESEND_API_KEY=re_***
```

### Server
```
PORT=8080
APP_BASE_URL=http://localhost:8080
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Migrations

After setting up `DATABASE_URL`, run:

```bash
# Generate Prisma client
npm run db:generate

# Create and run migrations
npm run db:migrate

# (Optional) Seed with test data
npm run db:seed
```

## Testing the API

### Health Check
```bash
curl http://localhost:8080/health
```

### Signup
```bash
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123",
    "name": "Test User",
    "username": "testuser",
    "city": "San Francisco",
    "zip": "94102",
    "role": "CUSTOMER"
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpassword123"
  }'
```

Use the returned `token` in subsequent requests:
```bash
curl http://localhost:8080/users/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Deployment to Railway

1. Connect your GitHub repo to Railway
2. Set all environment variables in Railway dashboard
3. Set build command: `cd backend && npm install`
4. Set start command: `cd backend && npm start`
5. Railway will automatically deploy on push

## Auto-Capture After 48h

This feature requires a background job. For MVP, you can:
1. Add a cron job (using node-cron or similar)
2. Or use Railway's cron jobs
3. Or call a manual endpoint to process pending captures

Example cron job:
```javascript
// Add to server.js or separate file
import cron from 'node-cron';

cron.schedule('0 * * * *', async () => {
  // Every hour, check for jobs completed 48h ago
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const jobs = await prisma.job.findMany({
    where: {
      status: 'COMPLETED_BY_HUSTLER',
      updatedAt: { lte: cutoff },
    },
    include: { payment: true },
  });
  
  for (const job of jobs) {
    if (job.payment?.status === 'PREAUTHORIZED') {
      // Auto-capture
      await capturePaymentIntent(job.payment.providerId);
      // Update job status, send emails, etc.
    }
  }
});
```

