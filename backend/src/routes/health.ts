import { Request, Response, Router } from "express";
import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

const router = Router();
const prisma = new PrismaClient();

// Read version from package.json
let appVersion = "1.0.0";
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("../../package.json");
  appVersion = pkg.version || "1.0.0";
} catch {
  logger.warn("Could not read package.json for version in health check");
}

// Track server start time for uptime calculation
const startTime = Date.now();

interface HealthCheck {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
  };
}

/**
 * Check database connectivity with timeout
 */
async function checkDatabase(timeoutMs = 2000): Promise<HealthCheck> {
  const start = Date.now();

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database health check timeout")), timeoutMs);
    });

    // Run a simple query
    const queryPromise = prisma.$queryRaw`SELECT 1 as health_check`;

    // Race between query and timeout
    await Promise.race([queryPromise, timeoutPromise]);

    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";
    logger.error({ error }, "Database health check failed");

    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: message,
    };
  }
}

/**
 * GET /health
 * Production-ready health check endpoint
 */
router.get("/", async (_req: Request, res: Response) => {
  const dbCheck = await checkDatabase();
  const memoryUsage = process.memoryUsage();

  const health: HealthResponse = {
    status: dbCheck.ok ? "ok" : "down",
    timestamp: new Date().toISOString(),
    version: appVersion,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbCheck,
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
      },
    },
  };

  // Return 503 if any critical check fails
  const httpStatus = health.status === "ok" ? 200 : 503;

  res.status(httpStatus).json(health);
});

export default router;
