/**
 * Production Boot Guard
 * 
 * Validates critical environment variables at startup.
 * CRASHES the application if misconfigured in production.
 * This prevents accidental deployment with sandbox/test credentials.
 */

import logger from "./logger";

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate production configuration
 * Returns errors for fatal issues, warnings for non-critical issues
 */
export function validateConfig(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const isProd = process.env.NODE_ENV === "production";

    // ============================================================
    // PRODUCTION-ONLY CHECKS (Fatal if failed)
    // ============================================================
    if (isProd) {
        // Paymee MUST be in live mode
        const paymeeEnv = (process.env.PAYMEE_ENV || "").toLowerCase();
        if (paymeeEnv !== "live") {
            errors.push(
                `FATAL: PAYMEE_ENV="${paymeeEnv}" but must be "live" in production. ` +
                `You are about to process REAL payments with SANDBOX mode!`
            );
        }

        // Clerk keys must be live keys
        const clerkPubKey = process.env.CLERK_PUBLISHABLE_KEY || "";
        const clerkSecKey = process.env.CLERK_SECRET_KEY || "";

        if (clerkPubKey.startsWith("pk_test_")) {
            errors.push(
                `FATAL: CLERK_PUBLISHABLE_KEY starts with "pk_test_" but production requires "pk_live_". ` +
                `Authentication will not work correctly with test keys in production.`
            );
        }

        if (clerkSecKey.startsWith("sk_test_")) {
            errors.push(
                `FATAL: CLERK_SECRET_KEY starts with "sk_test_" but production requires "sk_live_". ` +
                `Backend authentication will fail with test keys in production.`
            );
        }

        // Paymee webhook URL must be HTTPS
        const webhookUrl = process.env.PAYMEE_WEBHOOK_URL || "";
        if (!webhookUrl.startsWith("https://")) {
            errors.push(
                `FATAL: PAYMEE_WEBHOOK_URL must be HTTPS in production. ` +
                `Current: "${webhookUrl}". Paymee will not send webhooks to HTTP URLs.`
            );
        }

        // Paymee webhook URL must NOT contain localhost
        if (webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")) {
            errors.push(
                `FATAL: PAYMEE_WEBHOOK_URL contains localhost. ` +
                `Paymee cannot reach localhost in production. Use a public domain.`
            );
        }

        // CORS origins should not be wildcard
        const corsOrigins = process.env.CORS_ORIGINS || "";
        if (corsOrigins.includes("*")) {
            errors.push(
                `FATAL: CORS_ORIGINS contains "*" which is not allowed in production. ` +
                `Specify exact domains: https://follacouffin.tn,https://www.follacouffin.tn`
            );
        }

        // Database URL should not be localhost in production (warning only)
        const dbUrl = process.env.DATABASE_URL || "";
        if (dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")) {
            warnings.push(
                `WARNING: DATABASE_URL points to localhost. ` +
                `This is unusual for production but may be intentional if running locally.`
            );
        }

        // Frontend URL must be HTTPS
        const frontendUrl = process.env.FRONTEND_URL || "";
        if (!frontendUrl.startsWith("https://")) {
            errors.push(
                `FATAL: FRONTEND_URL must be HTTPS in production. ` +
                `Current: "${frontendUrl}". Cookies and auth will not work over HTTP.`
            );
        }

        // Sentry DSN recommended
        if (!process.env.SENTRY_DSN) {
            warnings.push(
                `WARNING: SENTRY_DSN not configured. ` +
                `Error tracking is disabled. Consider adding Sentry for production monitoring.`
            );
        }
    }

    // ============================================================
    // REQUIRED VARIABLES (All environments)
    // ============================================================
    const required = [
        { key: "DATABASE_URL", desc: "PostgreSQL connection string" },
        { key: "CLERK_PUBLISHABLE_KEY", desc: "Clerk public key" },
        { key: "CLERK_SECRET_KEY", desc: "Clerk secret key" },
    ];

    for (const { key, desc } of required) {
        if (!process.env[key]) {
            errors.push(`MISSING: ${key} is required (${desc})`);
        }
    }

    // Paymee is required if in dynamic mode
    if ((process.env.PAYMEE_MODE || "dynamic") === "dynamic") {
        const paymeeRequired = [
            { key: "PAYMEE_API_KEY", desc: "Paymee API key" },
            { key: "PAYMEE_WEBHOOK_URL", desc: "Paymee webhook URL" },
        ];
        for (const { key, desc } of paymeeRequired) {
            if (!process.env[key]) {
                errors.push(`MISSING: ${key} is required for Paymee dynamic mode (${desc})`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Run validation and crash if production is misconfigured
 * Call this at the very start of the application
 */
export function enforceProductionConfig(): void {
    const result = validateConfig();
    const isProd = process.env.NODE_ENV === "production";

    // Log warnings
    for (const warning of result.warnings) {
        logger.warn(warning);
    }

    // In production, errors are fatal
    if (!result.valid) {
        console.error("\n" + "=".repeat(70));
        console.error("🚨 PRODUCTION CONFIGURATION ERRORS DETECTED 🚨");
        console.error("=".repeat(70) + "\n");

        for (const error of result.errors) {
            console.error(`❌ ${error}\n`);
        }

        console.error("=".repeat(70));
        console.error("The application cannot start with these configuration errors.");
        console.error("Please fix the issues above and restart.");
        console.error("=".repeat(70) + "\n");

        if (isProd) {
            process.exit(1);
        } else {
            // In development, log but don't crash
            logger.error({ errors: result.errors }, "Configuration errors (non-fatal in dev)");
        }
    } else if (isProd) {
        logger.info("✅ Production configuration validated successfully");
    }
}

export default { validateConfig, enforceProductionConfig };
