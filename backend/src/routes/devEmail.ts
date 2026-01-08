/**
 * Dev Email Test Routes
 *
 * Test endpoints for email delivery verification.
 * Only enabled in development mode.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import {
    sendOrderConfirmationEmail,
    sendAdminNewOrderEmail,
    sendLoginAlertEmail,
    emailConfig,
    type OrderWithItems,
} from "../services/emailService";

const router = express.Router();
const prisma = new PrismaClient();

// Only enable in development
const isDev = process.env.NODE_ENV !== "production";

/**
 * GET /api/dev/test-email
 *
 * Send a test email to verify SMTP configuration.
 *
 * Query params:
 *   - to: recipient email (required)
 *   - type: "login" | "order" (required)
 *
 * Examples:
 *   curl "http://localhost:4002/api/dev/test-email?to=test@gmail.com&type=login"
 *   curl "http://localhost:4002/api/dev/test-email?to=test@gmail.com&type=order"
 */
router.get("/test-email", async (req, res) => {
    if (!isDev) {
        return res.status(403).json({ ok: false, sent: false, error: "Only available in development" });
    }

    try {
        const { to, type } = req.query;

        if (!to || typeof to !== "string") {
            return res.status(400).json({
                ok: false,
                sent: false,
                error: "Missing 'to' query parameter (recipient email)",
                usage: "/api/dev/test-email?to=your@email.com&type=login|order",
            });
        }

        if (!type || (type !== "login" && type !== "order")) {
            return res.status(400).json({
                ok: false,
                sent: false,
                error: "Missing or invalid 'type' query parameter. Must be 'login' or 'order'",
                usage: "/api/dev/test-email?to=your@email.com&type=login|order",
            });
        }

        // Check if mailer is configured
        if (!emailConfig.isConfigured) {
            return res.status(503).json({
                ok: false,
                sent: false,
                error: "SMTP not configured. Check SMTP_USER and SMTP_PASS in .env",
            });
        }

        console.log(`[dev-email] Sending test ${type} email to ${to}`);

        if (type === "login") {
            // Send login alert test
            const result = await sendLoginAlertEmail({
                email: to,
                timestamp: new Date(),
                ip: req.ip || "127.0.0.1",
                userAgent: req.headers["user-agent"] || "Test Browser",
            });

            if (result.success) {
                return res.json({ ok: true, sent: true, type: "login", to });
            } else {
                console.error(`[dev-email] Login email failed:`, result.errors);
                return res.status(500).json({ ok: false, sent: false, error: result.errors.join(", ") });
            }
        } else {
            // type === "order"
            // Find or create a mock order for testing
            let order: OrderWithItems | null = await prisma.order.findFirst({
                include: { items: { include: { product: true } } },
                orderBy: { id: "desc" },
            });

            if (!order) {
                // Create a fake order payload for testing
                const fakeOrder: OrderWithItems = {
                    id: 99999,
                    total: 125.50,
                    status: "pending",
                    name: "Test Customer",
                    email: to,
                    phone: "+216 12 345 678",
                    address: "123 Test Street, Test City",
                    region: "Tunis",
                    paymentMethod: "cod",
                    paymentStatus: "pending",
                    createdAt: new Date(),
                    items: [
                        {
                            id: 1,
                            quantity: 2,
                            price: 45.00,
                            variant: null,
                            color: "Beige",
                            size: "M",
                            attributes: null,
                            product: {
                                id: 1,
                                title: "Panier Artisanal Tunisien",
                                images: [],
                            },
                        },
                        {
                            id: 2,
                            quantity: 1,
                            price: 35.50,
                            variant: null,
                            color: null,
                            size: null,
                            attributes: null,
                            product: {
                                id: 2,
                                title: "Coussin Berbère",
                                images: [],
                            },
                        },
                    ],
                };

                console.log(`[dev-email] No orders in DB, using fake order payload`);

                const [customerResult, adminResult] = await Promise.all([
                    sendOrderConfirmationEmail({ ...fakeOrder, email: to }),
                    sendAdminNewOrderEmail({ ...fakeOrder, email: to }, to),
                ]);

                const success = customerResult.success && adminResult.success;
                const errors = [...customerResult.errors, ...adminResult.errors];

                if (success) {
                    return res.json({ ok: true, sent: true, type: "order", to, orderId: "fake" });
                } else {
                    console.error(`[dev-email] Order email failed:`, errors);
                    return res.status(500).json({ ok: false, sent: false, error: errors.join(", ") });
                }
            }

            // Override email with test recipient
            const testOrder = { ...order, email: to };

            const [customerResult, adminResult] = await Promise.all([
                sendOrderConfirmationEmail(testOrder),
                sendAdminNewOrderEmail(testOrder, to),
            ]);

            const success = customerResult.success && adminResult.success;
            const errors = [...customerResult.errors, ...adminResult.errors];

            if (success) {
                return res.json({ ok: true, sent: true, type: "order", to, orderId: order.id });
            } else {
                console.error(`[dev-email] Order email failed:`, errors);
                return res.status(500).json({ ok: false, sent: false, error: errors.join(", ") });
            }
        }
    } catch (err: any) {
        console.error("[dev-email] Error:", err);
        return res.status(500).json({ ok: false, sent: false, error: err.message });
    }
});

/**
 * POST /api/dev/simulate-login-email
 *
 * Simulate sending a login alert email (for testing when auth is external).
 *
 * Body:
 *   - email: recipient email (required)
 *   - ip: client IP address (optional)
 *   - userAgent: browser user agent (optional)
 *
 * Example:
 *   curl -X POST http://localhost:4002/api/dev/simulate-login-email \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"test@gmail.com","ip":"192.168.1.1","userAgent":"Chrome/120"}'
 */
router.post("/simulate-login-email", async (req, res) => {
    if (!isDev) {
        return res.status(403).json({ ok: false, sent: false, error: "Only available in development" });
    }

    try {
        const { email, ip, userAgent } = req.body;

        if (!email || typeof email !== "string") {
            return res.status(400).json({
                ok: false,
                sent: false,
                error: "Missing 'email' in request body",
                usage: 'POST with body: { "email": "your@email.com", "ip": "...", "userAgent": "..." }',
            });
        }

        // Check if mailer is configured
        if (!emailConfig.isConfigured) {
            return res.status(503).json({
                ok: false,
                sent: false,
                error: "SMTP not configured. Check SMTP_USER and SMTP_PASS in .env",
            });
        }

        console.log(`[dev-email] Simulating login alert for ${email}`);

        const result = await sendLoginAlertEmail({
            email,
            timestamp: new Date(),
            ip: ip || req.ip || "127.0.0.1",
            userAgent: userAgent || req.headers["user-agent"] || "Unknown",
        });

        if (result.success) {
            return res.json({ ok: true, sent: true, email });
        } else {
            console.error(`[dev-email] Login alert failed:`, result.errors);
            return res.status(500).json({ ok: false, sent: false, error: result.errors.join(", ") });
        }
    } catch (err: any) {
        console.error("[dev-email] Error:", err);
        return res.status(500).json({ ok: false, sent: false, error: err.message });
    }
});

/**
 * GET /api/dev/email-config
 *
 * Check email configuration status.
 */
router.get("/email-config", async (_req, res) => {
    if (!isDev) {
        return res.status(403).json({ error: "Only available in development" });
    }

    res.json({
        configured: emailConfig.isConfigured,
        from: emailConfig.from,
        adminEmail: emailConfig.adminEmail,
        flags: emailConfig.flags,
        environment: process.env.NODE_ENV || "development",
    });
});

export default router;
