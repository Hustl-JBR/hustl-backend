# Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Accounts for:
  - Neon (Postgres database)
  - Stripe (payments)
  - Mapbox (geocoding)
  - Cloudflare R2 (file storage)
  - Resend (emails)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in all values in `.env`:
   - Get Neon database URL from neon.tech
   - Get Stripe keys from stripe.com dashboard
   - Get Mapbox token from mapbox.com
   - Get R2 credentials from Cloudflare
   - Get Resend API key from resend.com
   - Generate JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Step 3: Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed with test data
npm run db:seed
```

## Step 4: Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:8080`

## Step 5: Test

1. Open `http://localhost:8080` in browser
2. Try signing up
3. Try posting a job
4. Check `/health` endpoint

## Troubleshooting

- **Database connection error**: Check `DATABASE_URL` in `.env`
- **Port already in use**: Change `PORT` in `.env` or kill process using port 8080
- **Module not found**: Run `npm install` again
- **Prisma errors**: Run `npm run db:generate`

## Next Steps

- See `DEPLOYMENT.md` for Railway setup
- See `API.md` for API documentation
- See `BACKUP_GUIDE.md` for backup options
