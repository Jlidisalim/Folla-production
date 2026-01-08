import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import path from "path";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Load environment variables first
dotenv.config();

// ============================================================
// PRODUCTION CONFIG GUARD - Crash early if misconfigured
// ============================================================
import { enforceProductionConfig } from "./lib/configGuard";
enforceProductionConfig();

// ============================================================
// OBSERVABILITY - Initialize early
// ============================================================
import logger, { httpLogger } from "./lib/logger";
import { initSentry, addSentryErrorHandler, finalErrorHandler, captureException } from "./lib/sentry";

// Route imports
import productsRouter from "./routes/products";
import clientsRouter from "./routes/clients";
import ordersRouter from "./routes/orders";
import dashboardRoutes from "./routes/dashboard";
import notificationsRoutes from "./routes/notifications";
import visitorRoutes from "./routes/visitors";
import salesRoutes from "./routes/sales";
import employeesRoutes from "./routes/employees";
import calendarRoutes from "./routes/calendar";
import paymeeRoutes from "./routes/paymee";
import adminRoutes from "./routes/admin";
import cartRoutes from "./routes/cart";
import wishlistRoutes from "./routes/wishlist";
import testRoutes from "./routes/test";
import healthRoutes from "./routes/health";
import metaTestRoutes from "./routes/metaTest";
import meRoutes from "./routes/me";
import settingsRoutes from "./routes/settings";
import devEmailRoutes from "./routes/devEmail";
import tasksRoutes from "./routes/tasks";
import reportsRoutes from "./routes/reports";
import sitemapRoutes from "./routes/sitemap";
import cancelRoutes from "./routes/cancel";

// Clerk middleware (correct pattern)
import { clerkAuth } from "./middleware/clerkAuth";
import { requireAdmin } from "./middleware/requireAdmin";


import { PrismaClient } from "@prisma/client";
import visitorTracker from "./middleware/visitorTracker";
import { ensureVisitorInfrastructure } from "./lib/visitorService";

const app = express();
const prisma = new PrismaClient();

// ============================================================
// TRUST PROXY - Required for Railway/Vercel reverse proxies
// Enables correct client IP detection and HTTPS redirects
// ============================================================
app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 4000);
const origins =
  process.env.CORS_ORIGINS
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ??
  [process.env.FRONTEND_URL || "http://localhost:8080", "http://localhost:5173"];

console.log("[CORS] Allowed origins:", origins);
console.log("[CORS] Raw CORS_ORIGINS env:", process.env.CORS_ORIGINS);

// ============================================================
// SENTRY - Must be initialized before routes
// ============================================================
initSentry(app);

// ============================================================
// REQUEST LOGGING - Structured JSON logs
// ============================================================
app.use(httpLogger);

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // For Paymee webhooks
app.use(cookieParser());

// ============================================================
// PAYMEE WEBHOOK - Must be BEFORE clerkMiddleware()
// External payment webhooks cannot send Clerk tokens.
// This route is public but secured via checksum validation.
// ============================================================
import paymeeWebhookHandler from "./routes/paymee-webhook";
app.use("/api/paymee/webhook", paymeeWebhookHandler);

// ============================================================
// SECURITY: Helmet for HTTP security headers
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for embedding payment iframes
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images to load from different origins (frontend/backend)
}));

// ============================================================
// SECURITY: Rate Limiting to prevent DoS/brute-force attacks
// ============================================================

// General API rate limit: varies by environment
// Development: 5000 requests per 15 minutes (React Strict Mode causes double renders)
// Production: 250 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 250 : 5000,
  message: { error: "Trop de requêtes, veuillez réessayer plus tard" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for order creation: 10 per 15 minutes
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Trop de commandes, veuillez réessayer plus tard" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limit for payment init: 5 per 15 minutes
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Trop de tentatives de paiement, veuillez réessayer plus tard" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Permissive limit for payment status polling: 500 requests per 15 minutes
// Needed because frontend polls every 2 seconds during payment
const statusPollingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "Trop de vérifications de statut" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply permissive limit to payment status polling (BEFORE general limiter)
// This allows frequent polling during payment verification
app.use('/api/paymee/status', statusPollingLimiter);
app.use('/api/settings', statusPollingLimiter); // Also used during checkout

// Apply general rate limit to all other API routes  
app.use('/api/', generalLimiter);
app.use('/orders', generalLimiter);

// ============================================================
// PERFORMANCE: Enable Gzip/Brotli compression for all responses
// Reduces transfer size by ~70% for text-based content
// ============================================================
app.use(compression({
  level: 6, // Balanced compression level (1-9, higher = more compression but slower)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't accept it
    if (req.headers['x-no-compression']) return false;
    // Use default compression filter
    return compression.filter(req, res);
  }
}));

// ============================================================
// CLERK MIDDLEWARE - Must be applied BEFORE any protected routes
// This enables getAuth(req) to work in downstream middleware
// ============================================================
app.use(clerkMiddleware());

app.use(visitorTracker);

// ============================================================
// PERFORMANCE: Static files with aggressive caching
// ============================================================
const uploadPath = path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadPath, {
  maxAge: '7d', // Cache for 7 days
  etag: true, // Enable ETags for conditional requests
  lastModified: true,
  immutable: false, // Set to true if filenames are hashed
  setHeaders: (res, filePath) => {
    // Set CORS for images
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Vary header for proper caching with different Accept headers
    res.setHeader('Vary', 'Accept-Encoding');
  }
}));

// ============================================================
// SITEMAP (public, no auth) - For SEO
// ============================================================
app.use("/sitemap.xml", sitemapRoutes);

// ============================================================
// HEALTH CHECK (public, no auth) - Must be early for monitoring
// ============================================================
app.use("/health", healthRoutes);

// ============================================================
// TEST ENDPOINTS FOR AUDIT (DEV ONLY - disabled in production)
// ============================================================
if (process.env.NODE_ENV !== "production") {
  app.get("/__test__/backend-error", (req: Request, _res: Response) => {
    const requestId = (req as Request & { id?: string }).id;
    logger.info({ requestId }, "Intentional backend error triggered for testing");

    const error = new Error("Intentional test error for Sentry verification");
    (error as Error & { requestId?: string }).requestId = requestId;
    captureException(error, requestId);
    throw error;
  });

  app.get("/__test__/db-error", async (req: Request, _res: Response, next: NextFunction) => {
    const requestId = (req as Request & { id?: string }).id;
    logger.info({ requestId }, "Intentional DB error triggered for testing");

    try {
      // This will fail - querying a non-existent table
      await prisma.$queryRaw`SELECT * FROM non_existent_table_for_testing`;
    } catch (error) {
      if (error instanceof Error) {
        (error as Error & { requestId?: string }).requestId = requestId;
        captureException(error, requestId);
      }
      next(error);
    }
  });

  // Meta CAPI test routes - trigger events manually for testing
  app.use("/api/__test__/meta", metaTestRoutes);
}

// ============================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================
app.use("/products", productsRouter);
app.use("/clients", clientsRouter);

// ============================================================
// ORDERS ROUTES (mixed auth - see orders.ts for per-route auth)
// - POST /orders: PUBLIC (guest checkout)
// - GET /orders: clerkAuth + requireAdmin
// - GET /orders/me: clerkAuth only
// - GET/PATCH/DELETE /orders/:id: clerkAuth + requireAdmin
// ============================================================
app.use("/orders", ordersRouter);

// ============================================================
// ADMIN ROUTES (Clerk auth + admin role required)
// ============================================================
app.use("/admin", clerkAuth, requireAdmin, adminRoutes);

// ============================================================
// OTHER PROTECTED ROUTES
// Dashboard and notifications require admin access
// ============================================================
app.use("/dashboard", clerkAuth, requireAdmin, dashboardRoutes);
app.use("/notifications", clerkAuth, requireAdmin, notificationsRoutes);

// ============================================================
// API ROUTES (various auth requirements)
// ============================================================
app.use("/api/visitors", visitorRoutes);
app.use("/api/sales", clerkAuth, requireAdmin, salesRoutes);
app.use("/sales", clerkAuth, requireAdmin, salesRoutes);
app.use("/api/employees", clerkAuth, requireAdmin, employeesRoutes);
app.use("/api/calendar", clerkAuth, requireAdmin, calendarRoutes);
app.use("/api/paymee", paymeeRoutes); // Public - handles webhooks
app.use("/api/cart", cartRoutes); // Public - cart operations
app.use("/api/wishlist", wishlistRoutes); // Wishlist operations
app.use("/api/test", testRoutes); // Dev-only test routes (self-disabled in production)
app.use("/api/me", meRoutes); // Current user info (role from Employee table)
app.use("/api/settings", settingsRoutes); // Shop settings (public GET, admin PUT)
app.use("/api/dev", devEmailRoutes); // Dev email test routes (self-disabled in production)
app.use("/api/tasks", tasksRoutes); // Task management routes
app.use("/api/reports", reportsRoutes); // Admin completion reports
app.use("/api/orders", cancelRoutes); // Order cancellation routes (admin only)


// Order notifications endpoint (admin only)
app.get("/orders/notifications", clerkAuth, requireAdmin, async (req, res, next) => {
  try {
    const notifs = await prisma.notification.findMany({
      include: { order: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(notifs);
  } catch (err) {
    logger.error({ err }, "Error fetching notifications");
    next(err);
  }
});

// Simple root health check (legacy, public)
app.get("/", (_, res) => res.json({ ok: true }));

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// ERROR HANDLING - Order matters!
// 1. Sentry error handler (captures errors)
// 2. Final error handler (logs and returns safe response)
// ============================================================
addSentryErrorHandler(app);
app.use(finalErrorHandler);

async function bootstrap() {
  try {
    await ensureVisitorInfrastructure();

    // Start payment reconciliation job (every 15 minutes)
    // This handles orphaned pending_payment orders
    if (process.env.NODE_ENV === "production") {
      const { startReconciliationJob } = await import("./jobs/paymentReconciliation");
      startReconciliationJob(15);
    }

    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Server started");
      logger.info("Authentication: Clerk (using clerkMiddleware + getAuth)");
    });
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

bootstrap();
