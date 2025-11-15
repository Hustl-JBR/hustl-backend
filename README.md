# Hustl Backend API

Express.js backend that serves the `/public` demo and provides the live API.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Fill in all required values
   ```

3. **Set up database:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

Server runs on `http://localhost:8080` and serves:
- Static files from `/public` at `/`
- API endpoints at `/auth`, `/users`, `/jobs`, `/offers`, `/threads`, `/payments`, `/webhooks`, `/r2`

## Environment Variables

See `.env.example` for all required variables:
- `DATABASE_URL` - Neon Postgres connection string
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `MAPBOX_TOKEN` - Mapbox API token
- `R2_*` - Cloudflare R2 credentials
- `RESEND_API_KEY` - Resend API key
- `JWT_SECRET` - JWT signing secret
- `PORT` - Server port (default: 8080)
- `APP_BASE_URL` - Base URL for email links

## API Endpoints

### Auth
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login
- `POST /auth/reset` - Request password reset

### Users
- `GET /users/me` - Get current user
- `PATCH /users/me` - Update current user

### Jobs
- `POST /jobs` - Create job (Customer)
- `GET /jobs` - List jobs with filters
- `GET /jobs/:id` - Get job details
- `POST /jobs/:id/cancel` - Cancel job (Customer)

### Offers
- `POST /offers/jobs/:jobId/offers` - Create offer (Hustler)
- `POST /offers/:id/accept` - Accept offer (Customer)
- `POST /offers/:id/decline` - Decline offer (Customer)

### Threads/Messages
- `GET /threads` - List user's threads
- `GET /threads/:id/messages` - Get thread messages
- `POST /threads/:id/messages` - Send message

### Payments
- `POST /payments/jobs/:jobId/confirm` - Capture payment (Customer)
- `GET /payments/receipts` - List receipts

### R2 Uploads
- `POST /r2/presign` - Get presigned upload URL

### Webhooks
- `POST /webhooks/stripe` - Stripe webhook handler

## Database

Uses Prisma with Neon Postgres. Run migrations with:
```bash
npm run db:migrate
```

View database with:
```bash
npm run db:studio
```

