/**
 * Meta CAPI Test Routes
 * src/routes/metaTest.ts
 *
 * Development-only routes for testing Meta Conversions API events.
 * These routes are NOT mounted in production.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import {
  trackPurchase,
  trackAddToCart,
  trackViewContent,
} from "../services/metaCapiService";

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/__test__/meta/purchase/:orderId
 * Trigger a Purchase event for an existing order.
 * Useful for testing Meta Events Manager → Test Events.
 */
router.post("/purchase/:orderId", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!orderId || !Number.isFinite(orderId)) {
      return res.status(400).json({ ok: false, error: "Invalid orderId" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found" });
    }

    const orderItemsForCapi = order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
    }));

    // Use test_ prefix for event ID to distinguish test events
    const eventId = `test_order_${order.id}_${Date.now()}`;

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
      eventId
    );

    console.log(`[MetaCAPI Test] Triggered Purchase event for order #${order.id}, eventId: ${eventId}`);

    res.json({
      ok: true,
      message: `Purchase event triggered for order #${order.id}`,
      eventId,
      order: {
        id: order.id,
        total: order.total,
        email: order.email ? "***" : null,
        itemCount: order.items.length,
      },
    });
  } catch (err: any) {
    console.error("[MetaCAPI Test] Error:", err);
    res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
});

/**
 * POST /api/__test__/meta/add-to-cart
 * Trigger a test AddToCart event with fake data.
 */
router.post("/add-to-cart", async (req, res) => {
  try {
    const eventId = `test_atc_${Date.now()}`;

    trackAddToCart(
      {
        productId: "TEST_PRODUCT_123",
        title: "Test Product",
        unitPrice: 99.0,
        quantity: 2,
      },
      {
        email: "test@example.com",
        phone: "+21612345678",
        country: "TN",
        clientIp: req.ip,
        clientUserAgent: req.headers["user-agent"] as string | undefined,
      },
      eventId
    );

    console.log(`[MetaCAPI Test] Triggered AddToCart event, eventId: ${eventId}`);

    res.json({
      ok: true,
      message: "AddToCart event triggered",
      eventId,
    });
  } catch (err: any) {
    console.error("[MetaCAPI Test] Error:", err);
    res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
});

/**
 * POST /api/__test__/meta/view-content
 * Trigger a test ViewContent event with fake data.
 */
router.post("/view-content", async (req, res) => {
  try {
    const eventId = `test_vc_${Date.now()}`;

    trackViewContent(
      {
        id: "TEST_PRODUCT_456",
        title: "Test Product View",
        category: "Test Category",
        pricePiece: 150.0,
      },
      {
        email: "test@example.com",
        country: "TN",
        clientIp: req.ip,
        clientUserAgent: req.headers["user-agent"] as string | undefined,
      },
      eventId
    );

    console.log(`[MetaCAPI Test] Triggered ViewContent event, eventId: ${eventId}`);

    res.json({
      ok: true,
      message: "ViewContent event triggered",
      eventId,
    });
  } catch (err: any) {
    console.error("[MetaCAPI Test] Error:", err);
    res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
});

export default router;
