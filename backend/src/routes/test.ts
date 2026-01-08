import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  sendOrderEmails,
  sendOrderConfirmationEmail,
  sendAdminNewOrderEmail,
  emailConfig,
  OrderWithItems,
} from "../services/emailService";

const router = express.Router();
const prisma = new PrismaClient();

// Only enable in development
const isDev = process.env.NODE_ENV !== "production";

/**
 * GET /api/test/email/config
 * Check email configuration status
 */
router.get("/email/config", async (_req, res) => {
  if (!isDev) {
    return res.status(403).json({ error: "Only available in development" });
  }

  res.json({
    configured: emailConfig.isConfigured,
    from: emailConfig.from,
    adminEmail: emailConfig.adminEmail,
    environment: process.env.NODE_ENV || "development",
  });
});

/**
 * POST /api/test/email/order/:orderId
 * Send test order emails for an existing order
 *
 * Usage: curl -X POST http://localhost:4002/api/test/email/order/123
 */
router.post("/email/order/:orderId", async (req, res) => {
  if (!isDev) {
    return res.status(403).json({ error: "Only available in development" });
  }

  try {
    const orderId = Number(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ error: "Invalid orderId" });
    }

    console.log(`[Test Email] Sending emails for order #${orderId}`);

    const result = await sendOrderEmails(orderId);

    res.json({
      orderId: orderId,
      success: result.success,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error("[Test Email] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test/email/preview
 * Send a test email with mock data or an existing order
 *
 * Usage: 
 *   curl -X POST http://localhost:4002/api/test/email/preview \
 *     -H "Content-Type: application/json" \
 *     -d '{"to": "test@example.com"}'
 * 
 * Or with an existing order:
 *   curl -X POST http://localhost:4002/api/test/email/preview \
 *     -H "Content-Type: application/json" \
 *     -d '{"to": "test@example.com", "orderId": 123}'
 */
router.post("/email/preview", async (req, res) => {
  if (!isDev) {
    return res.status(403).json({ error: "Only available in development" });
  }

  try {
    const { to, orderId } = req.body;

    if (!to) {
      return res.status(400).json({
        error: "Email address required",
        usage: 'POST with body: { "to": "your@email.com" } or { "to": "your@email.com", "orderId": 123 }',
      });
    }

    let order: OrderWithItems;

    if (orderId) {
      // Use existing order
      const existingOrder = await prisma.order.findUnique({
        where: { id: Number(orderId) },
        include: { items: { include: { product: true } } },
      });

      if (!existingOrder) {
        return res.status(404).json({ error: `Order #${orderId} not found` });
      }

      // Override email for testing
      order = { ...existingOrder, email: to };
    } else {
      // Try to find any existing order for preview
      const anyOrder = await prisma.order.findFirst({
        include: { items: { include: { product: true } } },
        orderBy: { id: "desc" },
      });

      if (anyOrder) {
        // Use existing order with overridden email
        order = { ...anyOrder, email: to };
        console.log(`[Test Email] Using existing order #${anyOrder.id} for preview`);
      } else {
        return res.status(400).json({
          error: "No orders exist in database. Create an order first or specify orderId.",
        });
      }
    }

    console.log(`[Test Email] Sending preview emails for order #${order.id} to ${to}`);

    // Send both emails
    const [customerResult, adminResult] = await Promise.all([
      sendOrderConfirmationEmail(order),
      sendAdminNewOrderEmail(order, to), // Also send admin email to the test address
    ]);

    const errors: string[] = [...customerResult.errors, ...adminResult.errors];
    const success = customerResult.success && adminResult.success;

    res.json({
      preview: true,
      to: to,
      orderId: order.id,
      success: success,
      errors: errors,
      details: {
        customer: customerResult,
        admin: adminResult,
      },
    });
  } catch (err: any) {
    console.error("[Test Email] Error:", err);
    res.status(500).json({ 
      preview: true,
      success: false,
      errors: [err.message],
    });
  }
});

/**
 * POST /api/test/email/customer/:orderId
 * Send only customer confirmation email
 */
router.post("/email/customer/:orderId", async (req, res) => {
  if (!isDev) {
    return res.status(403).json({ error: "Only available in development" });
  }

  try {
    const orderId = Number(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ error: "Invalid orderId" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (!order.email) {
      return res.status(400).json({ error: "Order has no email address" });
    }

    const result = await sendOrderConfirmationEmail(order);

    res.json({
      orderId: orderId,
      to: order.email,
      success: result.success,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error("[Test Email] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/test/email/admin/:orderId
 * Send only admin notification email
 */
router.post("/email/admin/:orderId", async (req, res) => {
  if (!isDev) {
    return res.status(403).json({ error: "Only available in development" });
  }

  try {
    const orderId = Number(req.params.orderId);
    const { to } = req.body; // Optional: override admin email

    if (!orderId) {
      return res.status(400).json({ error: "Invalid orderId" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const result = await sendAdminNewOrderEmail(order, to);

    res.json({
      orderId: orderId,
      to: to || emailConfig.adminEmail,
      success: result.success,
      errors: result.errors,
    });
  } catch (err: any) {
    console.error("[Test Email] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
