import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  initPaymeePayment,
  verifyPaymeeChecksum,
} from "../services/paymee.service";
import { restoreStockForItems } from "../services/stock.service";
import { sendOrderEmails } from "../services/emailService";
import { trackPurchase } from "../services/metaCapiService";
import logger from "../lib/logger";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/paymee/init
 * Initialize a Paymee payment for an existing order
 */
router.post("/init", async (req, res) => {
  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        error:
          "Request body is missing. Make sure express.json() middleware is configured.",
      });
    }

    const { orderId } = req.body;
    const id = Number(orderId);

    if (!orderId || !id) {
      return res.status(400).json({
        error: "orderId is required in the request body.",
      });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Commande introuvable" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ error: "Commande déjà payée" });
    }

    const { token, paymentUrl } = await initPaymeePayment(order);

    await prisma.order.update({
      where: { id },
      data: {
        paymentMethod: "paymee_card",
        providerPaymentId: token,
        paymentStatus: "pending_payment",
        status: "pending_payment",
      },
    });

    res.json({ token, paymentUrl });
  } catch (err: any) {
    console.error("Paymee init error", err);

    // Check for validation errors from service
    const errorMessage = err.message || "Payment init error";

    // If error is about missing API key or localhost webhook, return 400 with helpful message
    if (
      errorMessage.includes("PAYMEE_API_KEY") ||
      errorMessage.includes("PAYMEE_WEBHOOK_URL") ||
      errorMessage.includes("localhost")
    ) {
      return res.status(400).json({ error: errorMessage });
    }

    // For other errors, return 500
    res.status(500).json({ error: errorMessage });
  }
});

// NOTE: Webhook route (/webhook) is now handled by paymee-webhook.ts
// It is mounted BEFORE clerkMiddleware() in index.ts to bypass auth.
// See: src/routes/paymee-webhook.ts

/**
 * GET /api/paymee/redirect/success
 * Redirect from Paymee (HTTPS ngrok) to local frontend after successful payment
 * Paymee requires HTTPS URLs, so we use this as an intermediary
 */
router.get("/redirect/success", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  // Forward all query params from Paymee to the frontend
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const redirectUrl = `${frontendUrl}/payment/paymee/callback${queryString ? `?${queryString}` : ""}`;
  console.log("[Paymee Redirect] Success redirect to:", redirectUrl);
  res.redirect(redirectUrl);
});

/**
 * GET /api/paymee/redirect/cancel
 * Redirect from Paymee (HTTPS ngrok) to local frontend after cancelled payment
 */
router.get("/redirect/cancel", (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const redirectUrl = `${frontendUrl}/cart`;
  console.log("[Paymee Redirect] Cancel redirect to:", redirectUrl);
  res.redirect(redirectUrl);
});

/**
 * GET /api/paymee/status/:orderId
 * Get payment status for an order
 * Requires the request to come from the order owner (via email match) or is restricted
 */
router.get("/status/:orderId", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!orderId) return res.status(400).json({ error: "orderId invalide" });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        providerPaymentId: true,
        paidAt: true,
        paymentMethod: true,
        stockConsumed: true,
        email: true, // Include email to verify ownership
      },
    });
    if (!order) return res.status(404).json({ error: "Commande introuvable" });

    // Try to get authenticated user's email
    let userEmail: string | null = null;
    try {
      const auth = getAuth(req);
      if (auth?.userId) {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
      }
    } catch {
      // Auth is optional - continue without it
    }

    // If user is authenticated and email matches, return full info
    // Otherwise return only non-sensitive status fields
    const isOwner = userEmail && order.email && userEmail.toLowerCase() === order.email.toLowerCase();

    if (isOwner) {
      // Return full order status (excluding email for privacy)
      const { email: _, ...safeOrder } = order;
      res.json(safeOrder);
    } else {
      // Return only minimal status info for non-owners
      res.json({
        id: order.id,
        paymentStatus: order.paymentStatus,
        status: order.status,
      });
    }
  } catch (err: any) {
    logger.error({ err, orderId: req.params.orderId }, "Paymee status error");
    res.status(500).json({ error: err.message || "Status error" });
  }
});

/**
 * POST /api/paymee/cancel/:orderId
 * Cancel a pending payment order and restore stock
 * Called when user closes the payment modal without completing payment
 */
router.post("/cancel/:orderId", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ error: "orderId invalide" });
    }

    console.log("[Paymee Cancel] Cancelling order:", orderId);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ error: "Commande introuvable" });
    }

    // Only allow cancelling orders that are in pending_payment state
    if (order.paymentStatus !== "pending_payment") {
      console.log("[Paymee Cancel] Order", orderId, "not in pending_payment state, current status:", order.paymentStatus);
      return res.status(400).json({
        error: "Cette commande ne peut pas être annulée",
        currentStatus: order.paymentStatus
      });
    }

    // Restore stock and cancel order
    await prisma.$transaction(async (tx) => {
      if (order.stockConsumed) {
        await restoreStockForItems(tx, order.items as any[]);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "cancelled",
          status: "cancelled",
          stockConsumed: false,
        },
      });
    });

    console.log("[Paymee Cancel] Order", orderId, "cancelled, stock restored");

    res.json({ ok: true, message: "Commande annulée" });
  } catch (err: any) {
    console.error("[Paymee Cancel] Error:", err);
    res.status(500).json({ error: err.message || "Erreur lors de l'annulation" });
  }
});

/**
 * GET /api/paymee/verify
 * Verify Paymee payment and update order status
 * Query params: orderId, transactionId
 *
 * Stock was already consumed. This only updates status.
 * If verification fails, restore stock.
 */
router.get("/verify", async (req, res) => {
  try {
    const { orderId, transactionId } = req.query;

    if (!orderId) {
      return res.status(400).json({
        status: "failed",
        message: "orderId manquant",
      });
    }

    const orderIdNum = Number(orderId);
    if (!orderIdNum) {
      return res.status(400).json({
        status: "failed",
        message: "orderId invalide",
      });
    }

    console.log(
      "[Paymee Verify] Checking order:",
      orderIdNum,
      "transaction:",
      transactionId
    );

    // Find order with items for potential stock restore
    const order = await prisma.order.findUnique({
      where: { id: orderIdNum },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({
        status: "failed",
        message: "Commande introuvable",
      });
    }

    // Check if already paid
    if (order.paymentStatus === "paid") {
      console.log("[Paymee Verify] Order already paid");
      return res.json({
        status: "success",
        message: "Paiement déjà confirmé",
      });
    }

    // Verify transaction
    const token = order.providerPaymentId;
    let isVerified = false;

    if (transactionId && token && String(transactionId) === String(token)) {
      isVerified = true;
      console.log("[Paymee Verify] Transaction ID matches token");
    }

    if (isVerified) {
      // Payment successful - only update status
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "paid",
          status: "pending", // Move from pending_payment to pending
          paidAt: new Date(),
        },
      });

      console.log("[Paymee Verify] Order marked as paid");

      // Meta CAPI: Track Purchase event (non-blocking)
      const orderItemsForCapi = order.items.map((item: { productId: number; quantity: number; price: number }) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
      }));

      trackPurchase(
        {
          id: order.id,
          total: order.total,
          email: order.email,
          phone: order.phone,
          address: order.address,
          items: orderItemsForCapi,
        },
        {
          email: order.email ?? undefined,
          phone: order.phone ?? undefined,
          city: order.address?.split(",")[0]?.trim(),
          country: "TN",
          clientIp: req.ip,
          clientUserAgent: req.headers["user-agent"] as string | undefined,
        },
        `order_${order.id}`
      );

      // Send order confirmation emails
      if (order.email) {
        sendOrderEmails(order.id).then((result) => {
          if (result.success) {
            console.log(`[Paymee Verify] Emails sent for order #${order.id}`);
          } else {
            console.error(`[Paymee Verify] Email errors for order #${order.id}:`, result.errors);
          }
        }).catch((err) => {
          console.error(`[Paymee Verify] Email exception for order #${order.id}:`, err);
        });
      }

      return res.json({
        status: "success",
        message: "Paiement confirmé avec succès",
      });
    } else {
      // Payment failed - restore stock
      await prisma.$transaction(async (tx) => {
        if (order.stockConsumed) {
          await restoreStockForItems(tx, order.items as any[]);
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "failed",
            status: "cancelled",
            stockConsumed: false,
          },
        });
      });

      console.log("[Paymee Verify] Payment failed, stock restored");

      return res.json({
        status: "failed",
        message: "Paiement non vérifié ou échoué",
      });
    }
  } catch (err: any) {
    console.error("[Paymee Verify] Error:", err);
    res.status(500).json({
      status: "failed",
      message: err.message || "Erreur lors de la vérification",
    });
  }
});

// ============================================================
// TEST ENDPOINTS - DEVELOPMENT ONLY
// These endpoints allow manual payment status changes for testing
// CRITICAL: Must be disabled in production to prevent fraud
// ============================================================
if (process.env.NODE_ENV !== "production") {
  /**
   * POST /api/paymee/test/confirm/:orderId
   * Manually mark order as paid for testing (bypasses webhook)
   * ONLY FOR DEVELOPMENT/TESTING
   */
  router.post("/test/confirm/:orderId", async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      if (!orderId) {
        return res.status(400).json({ error: "Invalid orderId" });
      }

      console.log(
        "[Paymee Test] Manually confirming payment for order:",
        orderId
      );

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Only update payment status - stock was already consumed
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "paid",
          status: "pending", // Move from pending_payment to pending
          paidAt: new Date(),
        },
      });

      console.log("[Paymee Test] Order marked as paid");

      // Send order confirmation emails
      if (order.email) {
        sendOrderEmails(order.id).then((result) => {
          console.log(`[Paymee Test] Email result for order #${order.id}:`, result);
        }).catch((err) => {
          console.error(`[Paymee Test] Email exception for order #${order.id}:`, err);
        });
      }

      res.json({ success: true, message: "Order marked as paid" });
    } catch (err: any) {
      console.error("[Paymee Test] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/paymee/test/fail/:orderId
   * Manually mark order as failed for testing (simulates failed payment)
   * ONLY FOR DEVELOPMENT/TESTING
   */
  router.post("/test/fail/:orderId", async (req, res) => {
    try {
      const orderId = Number(req.params.orderId);
      if (!orderId) {
        return res.status(400).json({ error: "Invalid orderId" });
      }

      console.log("[Paymee Test] Manually failing payment for order:", orderId);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Restore stock and mark as failed
      await prisma.$transaction(async (tx) => {
        if (order.stockConsumed) {
          await restoreStockForItems(tx, order.items as any[]);
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: "failed",
            status: "cancelled",
            stockConsumed: false,
          },
        });
      });

      console.log("[Paymee Test] Order marked as failed, stock restored");

      res.json({ success: true, message: "Order marked as failed, stock restored" });
    } catch (err: any) {
      console.error("[Paymee Test] Error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}

export default router;

