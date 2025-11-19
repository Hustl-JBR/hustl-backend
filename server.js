// server.js — Hustl backend (integrated with new API)
const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

const app = express();
const PORT = process.env.PORT || 8080;

// Rate limiting - Production-ready limits (can handle hundreds of concurrent users)
// IMPORTANT: Limits are PER IP ADDRESS, so different users from different IPs each get their own limits
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per 15 minutes (increased to handle profile page loading)
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Rate limiting for auth endpoints (supports hundreds of signups from different IPs)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 auth requests per 15 minutes (allows for many signups from different IPs)
  message: { error: 'Too many authentication attempts from this IP, please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Apply rate limiting to all API routes (except static files and health checks)
app.use((req, res, next) => {
  // Skip rate limiting for static files
  if (req.path.startsWith('/public/') || req.path.includes('.')) {
    return next();
  }
  // Skip rate limiting for health check (handled in limiter config, but double-check)
  if (req.path === '/health') {
    return next();
  }
  limiter(req, res, next);
});

// CORS: allow all origins in development, configure for production
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" 
      ? process.env.FRONTEND_BASE_URL 
      : true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public folder
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    // Disable caching for HTML and JS files to ensure updates are picked up
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Health check route
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hustl-backend", timestamp: new Date().toISOString() });
});

// Import route modules
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const jobsRouter = require("./routes/jobs");
const offersRouter = require("./routes/offers");
const threadsRouter = require("./routes/threads");
const paymentsRouter = require("./routes/payments");
const webhooksRouter = require("./routes/webhooks");
const r2Router = require("./routes/r2");
const stripeConnectRouter = require("./routes/stripe-connect");
const reviewsRouter = require("./routes/reviews");
const feedbackRouter = require("./routes/feedback");
const adminRouter = require("./routes/admin");
const notificationsRouter = require("./routes/notifications");

// API Routes with rate limiting
app.use("/auth", authLimiter, authRouter); // Stricter rate limiting for auth
app.use("/users", usersRouter);
app.use("/jobs", jobsRouter);
app.use("/offers", offersRouter);
app.use("/threads", threadsRouter);
app.use("/payments", paymentsRouter);
app.use("/webhooks", webhooksRouter);
app.use("/r2", r2Router);
app.use("/stripe-connect", stripeConnectRouter);
app.use("/reviews", reviewsRouter);
app.use("/feedback", feedbackRouter);
app.use("/admin", adminRouter);
app.use("/notifications", notificationsRouter);

// Legacy Stripe Checkout session creation (keep for backward compatibility)
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { amountTotalCents, customerEmail, description } = req.body || {};

    if (!amountTotalCents) {
      return res.status(400).json({ error: "Missing amountTotalCents" });
    }

    const origin =
      process.env.FRONTEND_BASE_URL ||
      process.env.APP_BASE_URL ||
      req.get("origin") ||
      `${req.protocol}://${req.get("host")}`;
    const base = origin.replace(/\/+$/, "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: description || "Hustl Payment" },
            unit_amount: Number(amountTotalCents),
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      success_url: `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// Serve index.html for all non-API routes (SPA fallback)
// Use middleware instead of wildcard route (Express 5.x compatibility)
app.use((req, res, next) => {
  // Don't serve index.html for API routes or static files
  if (
    req.path.startsWith("/auth/") ||
    req.path.startsWith("/users/") ||
    req.path.startsWith("/jobs/") ||
    req.path.startsWith("/offers/") ||
    req.path.startsWith("/threads/") ||
    req.path.startsWith("/payments/") ||
    req.path.startsWith("/webhooks/") ||
    req.path.startsWith("/r2/") ||
    req.path.startsWith("/stripe-connect/") ||
    req.path.startsWith("/reviews/") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/create-checkout-session") ||
    req.path.includes(".") // Exclude direct file requests (e.g., /style.css, /api-integration.js)
  ) {
    return next(); // Continue to next middleware/route handler
  }
  // Serve index.html for all other routes (SPA fallback)
  res.sendFile(path.join(publicPath, "index.html"));
});

// Start the backend server
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
app.listen(PORT, host, () => {
  console.log(`🚀 Hustl backend running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${publicPath}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Production mode - App is live!`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_BASE_URL || 'Not set'}`);
  } else {
    console.log(`📱 Development mode - Access from your phone: http://[your-ip]:${PORT}`);
    console.log(`   (Make sure your phone is on the same WiFi network)`);
  }
  
  // Start cleanup job scheduler
  const { cleanupOldJobs } = require('./services/cleanup');
  
  // Run cleanup immediately on startup (optional)
  cleanupOldJobs().catch(err => {
    console.error('[Startup] Cleanup error (non-fatal):', err);
  });
  
  // Run cleanup every 6 hours
  const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  setInterval(() => {
    cleanupOldJobs().catch(err => {
      console.error('[Scheduled Cleanup] Error (non-fatal):', err);
    });
  }, CLEANUP_INTERVAL_MS);
  
  console.log(`🧹 Cleanup job scheduled: runs every 6 hours (deletes all jobs older than 2 weeks)`);
});
