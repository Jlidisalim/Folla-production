/**
 * Environment Configuration Module
 * 
 * Validates all required environment variables at boot time.
 * Fails fast in production if critical vars are missing or test keys are used.
 * 
 * @module config/env
 */

import { z } from "zod";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

// ============================================================
// ENVIRONMENT SCHEMAS
// ============================================================

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("4000").transform(Number),

    // URLs
    FRONTEND_URL: z.string().url(),
    BACKEND_URL: z.string().url(),
    CORS_ORIGINS: z.string().optional(),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Clerk Auth
    CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required"),
    CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),

    // Paymee
    PAYMEE_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
    PAYMEE_API_KEY: z.string().min(1, "PAYMEE_API_KEY is required"),
    PAYMEE_WEBHOOK_URL: z.string().url().optional(),
    PAYMEE_RETURN_URL: z.string().url().optional(),
    PAYMEE_CANCEL_URL: z.string().url().optional(),
    PAYMEE_MODE: z.enum(["paylink", "dynamic"]).default("dynamic"),

    // Email (SMTP)
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().transform(Number).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    ADMIN_EMAIL: z.string().email().optional(),

    // Feature Flags
    SEND_ORDER_EMAIL: z.string().optional().default("true"),
    SEND_ADMIN_ORDER_EMAIL: z.string().optional().default("true"),
    SEND_LOGIN_EMAIL: z.string().optional().default("true"),

    // Observability
    SENTRY_DSN: z.string().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    // Meta CAPI (optional)
    META_PIXEL_ID: z.string().optional(),
    META_CAPI_ACCESS_TOKEN: z.string().optional(),
    META_CAPI_ENABLED: z.string().optional().default("false"),
    META_CAPI_USE_TEST_MODE: z.string().optional().default("true"),
    META_CAPI_TEST_EVENT_CODE: z.string().optional(),

    // Branding
    LOGO_URL: z.string().url().optional(),
});

// ============================================================
// PARSE AND VALIDATE
// ============================================================

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
    console.error("❌ Invalid environment configuration:");
    console.error(parseResult.error.format());
    process.exit(1);
}

export const env = parseResult.data;

// ============================================================
// PRODUCTION SAFETY GUARDS
// ============================================================

if (env.NODE_ENV === "production") {
    const errors: string[] = [];

    // Guard 1: No test/sandbox Clerk keys in production
    if (env.CLERK_PUBLISHABLE_KEY.includes("pk_test")) {
        errors.push("CLERK_PUBLISHABLE_KEY contains 'pk_test' - use production key (pk_live_*)");
    }
    if (env.CLERK_SECRET_KEY.includes("sk_test")) {
        errors.push("CLERK_SECRET_KEY contains 'sk_test' - use production key (sk_live_*)");
    }

    // Guard 2: No sandbox Paymee in production
    if (env.PAYMEE_ENV === "sandbox") {
        errors.push("PAYMEE_ENV is 'sandbox' - must be 'live' in production");
    }

    // Guard 3: No localhost in webhook URLs
    if (env.PAYMEE_WEBHOOK_URL?.includes("localhost") ||
        env.PAYMEE_WEBHOOK_URL?.includes("127.0.0.1") ||
        env.PAYMEE_WEBHOOK_URL?.includes("ngrok")) {
        errors.push("PAYMEE_WEBHOOK_URL contains localhost/ngrok - use production domain");
    }

    // Guard 4: HTTPS required in production
    if (!env.FRONTEND_URL.startsWith("https://")) {
        errors.push("FRONTEND_URL must use HTTPS in production");
    }
    if (!env.BACKEND_URL.startsWith("https://")) {
        errors.push("BACKEND_URL must use HTTPS in production");
    }

    // Guard 5: Sentry DSN recommended in production
    if (!env.SENTRY_DSN) {
        console.warn("⚠️ SENTRY_DSN not configured - error tracking disabled in production");
    }

    // Fail fast if any errors
    if (errors.length > 0) {
        console.error("❌ Production environment validation failed:");
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
    }

    console.log("✅ Production environment validated successfully");
}

// ============================================================
// DERIVED VALUES
// ============================================================

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

// CORS origins (parsed from comma-separated string)
export const corsOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : isProduction
        ? [env.FRONTEND_URL]
        : ["http://localhost:5173", "http://localhost:8080", "http://localhost:8081"];

// Paymee base URL
export const paymeeBaseUrl = env.PAYMEE_ENV === "live"
    ? "https://app.paymee.tn/api/v2"
    : "https://sandbox.paymee.tn/api/v2";

// Email feature flags (parsed to boolean)
export const emailFlags = {
    sendOrderEmail: env.SEND_ORDER_EMAIL !== "false",
    sendAdminOrderEmail: env.SEND_ADMIN_ORDER_EMAIL !== "false",
    sendLoginEmail: env.SEND_LOGIN_EMAIL !== "false",
};

// Meta CAPI flags
export const metaCapiEnabled = env.META_CAPI_ENABLED === "true";

// ============================================================
// REDACTION PATHS (for logger)
// ============================================================

export const redactPaths = [
    "CLERK_SECRET_KEY",
    "PAYMEE_API_KEY",
    "SMTP_PASS",
    "DATABASE_URL",
    "META_CAPI_ACCESS_TOKEN",
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers['x-api-key']",
    "res.headers['set-cookie']",
    "password",
    "token",
    "secret",
    "apiKey",
    "creditCard",
    "ssn",
];

export default env;
