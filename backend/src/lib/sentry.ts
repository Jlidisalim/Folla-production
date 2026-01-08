import * as Sentry from "@sentry/node";
import { Express, Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// Read version from package.json
let appVersion = "unknown";
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("../../package.json");
  appVersion = pkg.version || "unknown";
} catch {
  logger.warn("Could not read package.json for version");
}

/**
 * Initialize Sentry error tracking
 * Must be called early in app bootstrap, before routes are registered
 */
export function initSentry(_app: Express): void {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn("SENTRY_DSN not configured - error tracking disabled");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: `folla-backend@${appVersion}`,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Don't send PII
    sendDefaultPii: false,
  });

  logger.info({ environment: process.env.SENTRY_ENVIRONMENT }, "Sentry initialized");
}

/**
 * Add Sentry error handler middleware
 * Must be called AFTER all routes but BEFORE custom error handlers
 */
export function addSentryErrorHandler(_app: Express): void {
  // In Sentry v8, error handling is automatic
  // No additional middleware needed
}

/**
 * Capture an exception and send to Sentry
 */
export function captureException(error: Error, requestId?: string): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (requestId) {
      scope.setTag("requestId", requestId);
    }
    Sentry.captureException(error);
  });
}

/**
 * Final error handler - logs and returns safe JSON response
 */
export function finalErrorHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const requestId = (req as Request & { id?: string }).id || "unknown";

  // Capture to Sentry
  captureException(err, requestId);

  // Log the error with context
  logger.error({
    err,
    requestId,
    method: req.method,
    url: req.url,
    status,
  }, "Request error");

  // Never expose internal errors to clients
  const message = status >= 500 ? "Internal Server Error" : err.message;

  res.status(status).json({
    error: message,
    requestId,
    timestamp: new Date().toISOString(),
  });
}
