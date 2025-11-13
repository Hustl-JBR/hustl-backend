// server.js — Hustl backend (integrated with new API)
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

const app = express();
const PORT = process.env.PORT || 8080;

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
app.use(express.static(publicPath));

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

// API Routes
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/jobs", jobsRouter);
app.use("/offers", offersRouter);
app.use("/threads", threadsRouter);
app.use("/payments", paymentsRouter);
app.use("/webhooks", webhooksRouter);
app.use("/r2", r2Router);

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
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (
    req.path.startsWith("/auth/") ||
    req.path.startsWith("/users/") ||
    req.path.startsWith("/jobs/") ||
    req.path.startsWith("/offers/") ||
    req.path.startsWith("/threads/") ||
    req.path.startsWith("/payments/") ||
    req.path.startsWith("/webhooks/") ||
    req.path.startsWith("/r2/") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/create-checkout-session")
  ) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(publicPath, "index.html"));
});

// Start the backend server
app.listen(PORT, () => {
  console.log(`🚀 Hustl backend running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${publicPath}`);
});
