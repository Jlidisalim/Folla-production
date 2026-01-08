// server/routes/notifications.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * Ensure overdue notifications for pending orders older than thresholdMs (48h default).
 * Creates one notification per order only if such a notification doesn't already exist.
 */
async function ensureOverdueNotifications(thresholdMs = 48 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - thresholdMs);

  // find pending orders older than cutoff
  const overdueOrders = await prisma.order.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff },
    },
    select: { id: true, name: true, total: true, createdAt: true },
  });

  for (const o of overdueOrders) {
    // Avoid duplicates by searching for notifications with a clear marker in payload or title.
    const exists = await prisma.notification.findFirst({
      where: {
        orderId: o.id,
        OR: [
          { title: { contains: "Pending for over 48", mode: "insensitive" } },
          { payload: { path: ["overdue"], equals: true } },
        ],
      },
    });

    if (!exists) {
      const title = `Order #${o.id} — Pending for over 48 h`;
      const message = `Order #${
        o.id
      } placed on ${o.createdAt.toISOString()} is still pending.`;
      await prisma.notification.create({
        data: {
          type: "ORDER",
          title,
          message,
          payload: { orderId: o.id, overdue: true, createdAt: o.createdAt },
          read: false,
          recipient: "admin",
          order: { connect: { id: o.id } },
        },
      });
    }
  }
}

/**
 * Ensure notifications for new pending orders created within thresholdMs (24h default).
 * Creates one notification per order only if such a notification doesn't already exist.
 */
async function ensureNewOrderNotifications(thresholdMs = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - thresholdMs);

  // find pending orders created within the last thresholdMs
  const newOrders = await prisma.order.findMany({
    where: {
      status: "pending",
      createdAt: { gte: cutoff },
    },
    select: {
      id: true,
      name: true,
      total: true,
      createdAt: true,
      items: { select: { id: true } },
    },
  });

  for (const o of newOrders) {
    // Avoid duplicates by searching for notifications with title containing "New order"
    const exists = await prisma.notification.findFirst({
      where: {
        orderId: o.id,
        title: { contains: "New order", mode: "insensitive" },
      },
    });

    if (!exists) {
      const title = `New order #${o.id} from ${o.name ?? "Customer"}`;
      const message = `Total ${Number(o.total ?? 0).toFixed(2)} — ${
        o.items?.length ?? 0
      } items`;
      await prisma.notification.create({
        data: {
          type: "ORDER",
          title,
          message,
          payload: { orderId: o.id, createdAt: o.createdAt },
          read: false,
          recipient: "admin",
          order: { connect: { id: o.id } },
        },
      });
    }
  }
}

/**
 * GET /notifications
 * Ensures overdue and new order notifications (best-effort) then returns persisted notifications.
 * Optional query: ?unread=true
 */
router.get("/", async (req, res) => {
  try {
    // generate overdue notifs before returning (non-fatal)
    try {
      await ensureOverdueNotifications();
    } catch (err) {
      console.warn("ensureOverdueNotifications failed:", err);
    }

    // generate new order notifs before returning (non-fatal)
    try {
      await ensureNewOrderNotifications();
    } catch (err) {
      console.warn("ensureNewOrderNotifications failed:", err);
    }

    const unreadOnly = req.query.unread === "true";
    const where: any = {};
    if (unreadOnly) where.read = false;

    const notifs = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { order: true },
      take: 200,
    });

    res.json(notifs);
  } catch (err) {
    console.error("GET /notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/**
 * GET /orders/notifications
 * Return notifications that are linked to orders (compatibility endpoint).
 * This DOES NOT synthesize on-the-fly order notifications (use /notifications for overdue creation + all).
 */
router.get("/orders/notifications", async (req, res) => {
  try {
    const notifs = await prisma.notification.findMany({
      where: { orderId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { order: true },
      take: 200,
    });
    res.json(notifs);
  } catch (err) {
    console.error("GET /orders/notifications error:", err);
    res.status(500).json({ error: "Failed to fetch order notifications" });
  }
});

/**
 * POST /notifications/order-created
 * Create a notification for a newly created order.
 * Body: { orderId: number, recipient?: string }
 * Recommended: call this from your order creation handler (or use the direct prisma create shown below).
 */
router.post("/order-created", async (req, res) => {
  try {
    const orderId = Number(req.body.orderId);
    const recipient = req.body.recipient ?? "admin";

    if (!orderId || Number.isNaN(orderId)) {
      return res.status(400).json({ error: "Missing or invalid orderId" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    const notif = await prisma.notification.create({
      data: {
        type: "ORDER",
        title: `New order #${order.id} from ${order.name ?? "Customer"}`,
        message: `Total ${Number(order.total ?? 0).toFixed(2)} — ${
          order.items?.length ?? 0
        } items`,
        payload: { orderId: order.id, createdAt: order.createdAt },
        read: false,
        recipient,
        order: { connect: { id: order.id } },
      },
      include: { order: true },
    });

    res.status(201).json(notif);
  } catch (err) {
    console.error("POST /notifications/order-created error:", err);
    res.status(500).json({ error: "Failed to create order notification" });
  }
});

/**
 * POST /notifications/:id/read
 * Mark a single notification read (persisted)
 */
router.post("/:id/read", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("POST /notifications/:id/read error:", err);
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

/**
 * POST /notifications/mark-all-read
 * Mark all notifications read (optionally filter ?recipient=admin)
 */
router.post("/mark-all-read", async (req, res) => {
  try {
    const recipient = req.query.recipient as string | undefined;
    const where: any = { read: false };
    if (recipient) where.recipient = recipient;

    const updated = await prisma.notification.updateMany({
      where,
      data: { read: true },
    });

    res.json({ updatedCount: updated.count });
  } catch (err) {
    console.error("POST /notifications/mark-all-read error:", err);
    res.status(500).json({ error: "Failed to mark all notifications read" });
  }
});

/**
 * POST /orders/:orderId/mark-read
 * Convenience: mark notifications linked to an order as read
 */
router.post("/orders/:orderId/mark-read", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (Number.isNaN(orderId))
      return res.status(400).json({ error: "Bad order id" });

    const updated = await prisma.notification.updateMany({
      where: { orderId },
      data: { read: true },
    });

    res.json({ updatedCount: updated.count });
  } catch (err) {
    console.error("POST /orders/:orderId/mark-read error:", err);
    res.status(500).json({ error: "Failed to mark order notifications read" });
  }
});

export default router;
