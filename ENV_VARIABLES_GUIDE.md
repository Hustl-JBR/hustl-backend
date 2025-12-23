# Environment Variables Guide

## Where to Edit Environment Variables

### For Production (Railway Deployment)

**Environment variables are managed in Railway Dashboard, NOT in local .env files for production.**

1. **Go to Railway Dashboard**: https://railway.app/
2. **Select your project** (hustl-backend)
3. **Click on "Variables" tab** (or go to Settings → Variables)
4. **Add/Edit variables** there

Railway will automatically use these variables when deploying. **Never commit .env files to git** - they're in .gitignore for security.

---

### For Local Development

You can create a local `.env` file in the project root for local development:

1. **Create `.env` file** in the root directory (same level as `package.json`)
2. **Add your variables** (see list below)
3. **Never commit it** - it's already in `.gitignore`

Example `.env` file:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/hustl
JWT_SECRET=your-secret-key-here
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MAPBOX_TOKEN=your-mapbox-token
RESEND_API_KEY=your-resend-key
PORT=8080
APP_BASE_URL=http://localhost:8080
FRONTEND_BASE_URL=http://localhost:8080
```

---

## Required Environment Variables

### Critical (Required)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string | Railway → Database → Connect → Connection String |
| `JWT_SECRET` | Secret for signing JWT tokens | Generate: `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Stripe Dashboard → Developers → API keys |

### Important (Highly Recommended)

| Variable | Description | Where to Get It |
|----------|-------------|-----------------|
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Dashboard → Developers → Webhooks → Signing secret |
| `RESEND_API_KEY` | Email service API key | Resend Dashboard → API Keys |
| `MAPBOX_TOKEN` | Mapbox access token | Mapbox Account → Access Tokens |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `APP_BASE_URL` | Base URL for email links | `http://localhost:8080` |
| `FRONTEND_BASE_URL` | Frontend URL for CORS | `http://localhost:8080` |
| `NODE_ENV` | Environment (production/development) | `development` |

### Stripe Connect & R2 (Optional)

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_BUCKET_NAME` | Cloudflare R2 bucket name |
| `R2_PUBLIC_URL` | Cloudflare R2 public URL |

### Test Mode

| Variable | Description | Default |
|----------|-------------|---------|
| `SKIP_STRIPE_CHECK` | Skip Stripe validation (test mode) | `false` |

**⚠️ WARNING**: Never set `SKIP_STRIPE_CHECK=true` in production. Only use for local testing.

---

## How to Edit in Railway

### Step-by-Step:

1. **Login to Railway**: https://railway.app/
2. **Select Project**: Click on "hustl-backend" (or your project name)
3. **Go to Variables Tab**: 
   - Click on your service (the backend service)
   - Click on "Variables" tab at the top
   - OR go to Settings → Variables
4. **Add/Edit Variable**:
   - Click "+ New Variable"
   - Enter variable name (e.g., `STRIPE_SECRET_KEY`)
   - Enter variable value (e.g., `sk_live_...`)
   - Click "Add"
5. **Deploy**: Railway will automatically redeploy when you save variables

### Bulk Edit:

You can also use Railway CLI:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Set variable
railway variables set STRIPE_SECRET_KEY=sk_live_...
```

---

## Environment Variables Used in Code

### Database
- `DATABASE_URL` - Used by Prisma to connect to PostgreSQL

### Authentication
- `JWT_SECRET` - Used to sign and verify JWT tokens

### Stripe
- `STRIPE_SECRET_KEY` - Server-side Stripe operations
- `STRIPE_PUBLISHABLE_KEY` - Client-side Stripe operations (sent to frontend)
- `STRIPE_WEBHOOK_SECRET` - Verify webhook signatures

### Email
- `RESEND_API_KEY` - Send emails via Resend

### Maps
- `MAPBOX_TOKEN` - Load maps and geocoding

### File Storage
- `R2_*` variables - Cloudflare R2 storage (for profile photos, job photos)

### URLs
- `APP_BASE_URL` - Base URL for email links (e.g., `https://hustljobs.com`)
- `FRONTEND_BASE_URL` - Frontend URL for CORS configuration

---

## Checking if Variables are Set

The server validates environment variables on startup. Check your Railway logs to see:

- ✅ `All required environment variables are set` - Good!
- ❌ `Missing required environment variables:` - Add missing variables

---

## Security Best Practices

1. **Never commit .env files** - They're in `.gitignore`
2. **Use different keys for development and production**
3. **Rotate secrets regularly**
4. **Use Railway's environment variables for production** (not local .env files)
5. **Don't share secrets** in chat, email, or documentation

---

## Troubleshooting

### Variables not working?

1. **Check Railway dashboard** - Make sure variables are set correctly
2. **Check variable names** - They're case-sensitive!
3. **Redeploy** - Railway should auto-redeploy, but you can manually trigger a deploy
4. **Check logs** - Railway logs will show validation errors

### Local development not working?

1. **Create `.env` file** in project root
2. **Copy variables from Railway** (use test keys, not production)
3. **Restart server** - Environment variables are loaded on startup

---

**Last Updated**: 2025-01-22

