# Hustl — Local Help, Real Hustle

End-to-end platform for local odd jobs. Customers post jobs, Hustlers find work, payments processed securely in-app.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Fill in all required values (see .env.example)
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

Server runs on `http://localhost:8080`

## 📁 Project Structure

```
hustl-backend/
├── server.js              # Main Express server
├── routes/                # API route handlers
│   ├── auth.js           # Authentication
│   ├── users.js          # User management
│   ├── jobs.js           # Job CRUD
│   ├── offers.js         # Offer management
│   ├── threads.js        # Messaging
│   ├── payments.js       # Payment processing
│   ├── webhooks.js       # Stripe webhooks
│   └── r2.js             # File uploads
├── services/             # External service integrations
│   ├── stripe.js        # Stripe payments
│   ├── mapbox.js        # Geocoding
│   ├── r2.js            # Cloudflare R2
│   └── email.js         # Resend emails
├── middleware/           # Express middleware
│   └── auth.js          # JWT authentication
├── prisma/              # Database schema
│   └── schema.prisma    # Prisma schema
├── public/              # Frontend files
│   ├── index.html       # Main app
│   ├── api-integration.js # API client
│   └── ...
└── .env                 # Environment variables (create from .env.example)
```

## 🔧 Environment Variables

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

## 📚 Documentation

- `SETUP.md` - Detailed setup guide
- `DEPLOYMENT.md` - Deployment instructions
- `API.md` - API endpoint documentation

## 🗄️ Database

Uses Prisma with Neon Postgres. Run migrations with:
```bash
npm run db:migrate
```

View database with:
```bash
npm run db:studio
```

## 🚢 Deployment

Configured for Railway deployment. See `DEPLOYMENT.md` for details.

## 📝 License

ISC
