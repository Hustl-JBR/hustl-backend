// server.js — Hustl backend (integrated with new API)
const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || "");

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for Railway (needed for rate limiting behind proxy)
app.set('trust proxy', 1);

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws',
  verifyClient: (info, callback) => {
    // Verify JWT token from query string
    const url = new URL(info.req.url, `http://${info.req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      callback(false, 401, 'Unauthorized');
      return;
    }
    
    // Verify token (reuse auth middleware logic)
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      info.req.user = decoded; // Attach user to request
      callback(true);
    } catch (error) {
      callback(false, 401, 'Invalid token');
    }
  },
});

// WebSocket connection handling
const connectedClients = new Map(); // userId -> Set of WebSocket connections

wss.on('connection', (ws, req) => {
  const user = req.user;
  if (!user || !user.id) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  const userId = user.id;
  
  // Add connection to user's set
  if (!connectedClients.has(userId)) {
    connectedClients.set(userId, new Set());
  }
  connectedClients.get(userId).add(ws);

  console.log(`[WebSocket] User ${userId} connected (${connectedClients.get(userId).size} connections)`);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connected',
  }));

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'typing':
          // Broadcast typing indicator to other users in thread
          if (message.threadId) {
            broadcastToThread(message.threadId, userId, {
              type: 'typing',
              userId,
              userName: user.name || user.email,
              threadId: message.threadId,
              isTyping: message.isTyping,
            });
          }
          break;
          
        case 'presence':
          // Update presence status
          broadcastToAll({
            type: 'presence',
            userId,
            status: message.status || 'online',
          });
          break;
          
        default:
          console.log(`[WebSocket] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    const userConnections = connectedClients.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        connectedClients.delete(userId);
      }
    }
    console.log(`[WebSocket] User ${userId} disconnected`);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[WebSocket] Error for user ${userId}:`, error);
  });
});

// Helper function to broadcast to all users in a thread
async function broadcastToThread(threadId, senderId, message) {
  try {
    const prisma = require('./db');
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: { userA: true, userB: true },
    });

    if (!thread) return;

    const recipientId = thread.userAId === senderId ? thread.userBId : thread.userAId;
    
    // Send to recipient
    const recipientConnections = connectedClients.get(recipientId);
    if (recipientConnections) {
      recipientConnections.forEach(ws => {
        if (ws.readyState === 1) { // OPEN
          ws.send(JSON.stringify(message));
        }
      });
    }
  } catch (error) {
    console.error('[WebSocket] Error broadcasting to thread:', error);
  }
}

// Helper function to broadcast to all connected clients
function broadcastToAll(message) {
  connectedClients.forEach((connections) => {
    connections.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(JSON.stringify(message));
      }
    });
  });
}

// Export function to send messages from API routes
global.sendWebSocketMessage = function(userId, message) {
  const userConnections = connectedClients.get(userId);
  if (userConnections) {
    userConnections.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    });
  }
};

// Export function to broadcast to thread participants
global.broadcastToThread = broadcastToThread;

// Rate limiting - Production-ready limits (can handle hundreds of concurrent users)
// IMPORTANT: Limits are PER IP ADDRESS, so different users from different IPs each get their own limits
// NOTE: Increased limits because frontend makes many parallel requests (threads, messages, etc.)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window (shorter window = faster recovery)
  max: 300, // Limit each IP to 300 requests per minute (5 per second sustained)
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/health';
  },
});

// Rate limiting for auth endpoints (supports hundreds of signups from different IPs)
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 20, // Limit each IP to 20 auth requests per minute
  message: { error: 'Too many authentication attempts from this IP, please wait a moment and try again.' },
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

// CORS: allow hustljobs.com and localhost
const allowedOrigins = [
  'https://hustljobs.com',
  'https://www.hustljobs.com',
  'http://localhost:3000',
  'http://localhost:8080',
  process.env.FRONTEND_BASE_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // In development, allow all
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      console.warn('[CORS] Blocked origin:', origin);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route (before everything else)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hustl-backend", timestamp: new Date().toISOString() });
});

// Import route modules (must be before static files)
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
const referralsRouter = require("./routes/referrals");
const trackingRouter = require("./routes/tracking");
const supportRouter = require("./routes/support");
const analyticsRouter = require("./routes/analytics");
const verificationRouter = require("./routes/verification");

// CRITICAL: API Routes MUST come BEFORE static files to ensure they're matched first
app.use("/auth", authLimiter, authRouter); // Stricter rate limiting for auth
app.use("/users", usersRouter);
app.use("/jobs", jobsRouter);
app.use("/offers", offersRouter);
app.use("/threads", threadsRouter);
app.use("/payments", paymentsRouter);
app.use("/webhooks", webhooksRouter);
app.use("/r2", r2Router); // Must be before static files!
app.use("/stripe-connect", stripeConnectRouter);
app.use("/reviews", reviewsRouter);
app.use("/feedback", feedbackRouter);
app.use("/admin", adminRouter);
app.use("/notifications", notificationsRouter);
app.use("/referrals", referralsRouter);
app.use("/tracking", trackingRouter);
app.use("/support", supportRouter);
app.use("/analytics", analyticsRouter);
app.use("/verification", verificationRouter);

// Serve static files from /public folder (AFTER API routes)
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

// Global error handler middleware (MUST be after all routes, before static files)
app.use((err, req, res, next) => {
  console.error('[Global Error Handler] Unhandled error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Handle Prisma errors
  if (err.code && err.code.startsWith('P')) {
    if (err.code === 'P1001' || err.code === 'P1002' || err.code === 'P1003') {
      // Database connection errors
      return res.status(503).json({ 
        error: 'Database connection error',
        message: 'Unable to connect to database. Please try again in a moment.',
        code: err.code
      });
    }
    if (err.code === 'P2002') {
      // Unique constraint violation
      return res.status(409).json({ 
        error: 'Duplicate entry',
        message: 'This record already exists.',
        code: err.code
      });
    }
    if (err.code === 'P2025') {
      // Record not found
      return res.status(404).json({ 
        error: 'Not found',
        message: 'The requested record was not found.',
        code: err.code
      });
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'Authentication error',
      message: 'Please log in again.',
      code: err.name
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation error',
      message: err.message || 'Invalid input provided.',
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({ 
    error: err.message || 'Internal server error',
    message: err.message || 'An unexpected error occurred. Please try again.',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    })
  });
});

// 404 handler for API routes
app.use((req, res, next) => {
  // Only handle 404 for API routes
  if (req.path.startsWith("/auth/") ||
      req.path.startsWith("/users/") ||
      req.path.startsWith("/jobs/") ||
      req.path.startsWith("/offers/") ||
      req.path.startsWith("/threads/") ||
      req.path.startsWith("/payments/") ||
      req.path.startsWith("/webhooks/") ||
      req.path.startsWith("/r2/") ||
      req.path.startsWith("/stripe-connect/") ||
      req.path.startsWith("/reviews/") ||
      req.path.startsWith("/verification/") ||
      req.path.startsWith("/admin/") ||
      req.path.startsWith("/notifications/") ||
      req.path.startsWith("/referrals/") ||
      req.path.startsWith("/tracking/") ||
      req.path.startsWith("/support/") ||
      req.path.startsWith("/analytics/") ||
      req.path.startsWith("/feedback/")) {
    return res.status(404).json({ 
      error: 'Not found',
      message: `API endpoint ${req.method} ${req.path} not found.`
    });
  }
  next();
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
    req.path.startsWith("/verification/") ||
    req.path.startsWith("/health") ||
    req.path.startsWith("/create-checkout-session") ||
    req.path.includes(".") // Exclude direct file requests (e.g., /style.css, /api-integration.js)
  ) {
    return next(); // Continue to next middleware/route handler
  }
  // Serve index.html for all other routes (SPA fallback)
  res.sendFile(path.join(publicPath, "index.html"));
});

// Start server (using http server for WebSocket support)
const host = process.env.HOST || "0.0.0.0";
server.listen(PORT, host, () => {
  console.log(`🚀 Hustl backend running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${publicPath}`);
  
  // Log registered routes for debugging
  console.log(`\n✅ Registered API Routes:`);
  console.log(`   POST /r2/upload - File upload to R2`);
  console.log(`   GET  /jobs/my-jobs - Get user's jobs`);
  console.log(`   GET  /offers/user/me - Get user's offers`);
  console.log(`   POST /r2/presign - Generate presigned URL (legacy)\n`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Production mode - App is live!`);
    console.log(`🔗 Frontend URL: ${process.env.FRONTEND_BASE_URL || 'Not set'}`);
  } else {
    console.log(`📱 Development mode - Access from your phone: http://[your-ip]:${PORT}`);
    console.log(`   (Make sure your phone is on the same WiFi network)`);
  }
  
  // Start cleanup job scheduler (only if database is ready)
  try {
    const { cleanup72HourJobs, cleanupOldJobs, runAllCleanup } = require('./services/cleanup');
    
    // Run cleanup immediately on startup (with error handling)
    runAllCleanup().catch(err => {
      // Ignore migration errors - database might not be migrated yet
      if (err.code === 'P2022' || err.message?.includes('does not exist')) {
        console.warn('[Startup] Cleanup skipped - database migrations not run yet');
      } else {
        console.error('[Startup] Cleanup error (non-fatal):', err.message);
      }
    });
    
    // Run cleanup every 2 hours (more frequent for better UX)
    const CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
    setInterval(() => {
      runAllCleanup().catch(err => {
        // Ignore migration errors
        if (err.code === 'P2022' || err.message?.includes('does not exist')) {
          // Silently skip - migrations not run yet
          return;
        }
        console.error('[Scheduled Cleanup] Error (non-fatal):', err.message);
      });
    }, CLEANUP_INTERVAL_MS);
    
    console.log(`🧹 Cleanup job scheduled: runs every 2 hours`);
    console.log(`   - Cancels OPEN jobs older than 48-72h with no accepted offers`);
    console.log(`   - Deletes all jobs older than 2 weeks`);
  } catch (cleanupError) {
    console.warn('[Startup] Could not initialize cleanup service:', cleanupError.message);
  }
});
