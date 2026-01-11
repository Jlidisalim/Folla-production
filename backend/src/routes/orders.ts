import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/express";
import { clerkAuth, ClerkAuthRequest } from "../middleware/clerkAuth";
import { requireAdmin, AdminAuthRequest } from "../middleware/requireAdmin";
import {
  consumeStockForItems,
  restoreStockForItems,
} from "../services/stock.service";
import { sendOrderEmails } from "../services/emailService";
import { trackInitiateCheckout } from "../services/metaCapiService";
import { validateCart, type CartItemInput } from "../services/validateCart.service";
import logger from "../lib/logger";
import {
  CreateOrderSchemaStrict,
  CreateOrderSchema,
  createValidationErrorResponse,
} from "../validators/order.validator";

const prisma = new PrismaClient();
const router = Router();

// Statuses that trigger stock restoration
const RESTOCK_STATUSES = ["cancelled", "canceled", "returned"];

const normalizeStatus = (value: any) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * GET all orders (admin only)
 * Protected by Clerk auth + admin role check
 */
router.get(
  "/",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    try {
      // By default, hide orders with pending_payment status (not real orders yet)
      // Use ?includePaymentPending=true to see all orders
      const includePaymentPending = req.query.includePaymentPending === "true";

      const whereClause = includePaymentPending
        ? {}
        : {
          NOT: {
            paymentStatus: "pending_payment"
          }
        };

      const orders = await prisma.order.findMany({
        where: whereClause,
        include: {
          items: { include: { product: true } },
        },
        orderBy: { id: "desc" },
      });
      res.json(orders);
    } catch (err) {
      console.error("Error fetching orders:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  }
);

/**
 * GET orders for current user (by Clerk user's email)
 * IMPORTANT: This route MUST come before /:id to avoid matching "me" as an ID
 * Protected by Clerk auth only (customers can see their own orders)
 */
router.get("/me", clerkAuth, async (req: ClerkAuthRequest, res) => {
  try {
    if (!req.clerkUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get user's email from Clerk
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(req.clerkUserId);
    } catch (err) {
      return res.status(400).json({ error: "User not found" });
    }

    const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;

    if (!userEmail) {
      return res.status(400).json({ error: "User email not found" });
    }

    const orders = await prisma.order.findMany({
      where: { email: userEmail },
      include: {
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/**
 * Create new order (PUBLIC - allows guest checkout)
 *
 * Stock is decremented at order creation for ALL payment methods.
 * This prevents race conditions and double-deduction issues.
 */
router.post("/", async (req, res) => {
  try {
    // Validate request body with Zod
    const parseResult = CreateOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.issues, body: req.body }, "Order validation failed");
      return res.status(400).json(createValidationErrorResponse(parseResult.error));
    }

    const { address, total, items, client, payment, region } = parseResult.data;

    const paymentMethod =
      payment?.method === "card"
        ? "paymee_card"
        : payment?.method || "unknown";

    // Determine initial statuses based on payment method
    const isCardPayment = paymentMethod === "paymee_card";
    const initialStatus = isCardPayment ? "pending_payment" : "pending";
    const initialPaymentStatus = isCardPayment ? "pending_payment" : "pending";

    // === CART VALIDATION: Verify items against latest DB data ===
    // This ensures no stale prices, stock, or removed products slip through
    const cartItemsForValidation: CartItemInput[] = items.map((raw: any) => ({
      productId: Number(raw.productId),
      combinationId: raw.attributes?.combinationId || raw.combinationId || null,
      quantity: Math.max(1, Number(raw.quantity ?? 1)),
      unitType: (raw.unitType as "piece" | "quantity") || "piece",
    }));

    const validationResult = await validateCart(cartItemsForValidation);

    // If validation found issues that prevent order (removed items, out of stock, etc.)
    if (!validationResult.valid || validationResult.removedProductIds.length > 0) {
      logger.warn({
        issues: validationResult.issues,
        removedProductIds: validationResult.removedProductIds
      }, "Cart validation failed - stale cart data");

      return res.status(409).json({
        error: "Cart has changed",
        message: "Votre panier a été modifié. Veuillez vérifier les changements avant de continuer.",
        validation: validationResult,
      });
    }

    // Check if client-provided total matches backend-computed total (with tolerance)
    const clientTotal = Number(total);
    const serverTotal = validationResult.totals.grandTotal;
    const tolerance = 0.5; // Allow 0.50 DT tolerance for rounding

    if (Math.abs(clientTotal - serverTotal) > tolerance) {
      logger.warn({
        clientTotal,
        serverTotal,
        difference: Math.abs(clientTotal - serverTotal)
      }, "Total mismatch detected");

      return res.status(409).json({
        error: "Total mismatch",
        message: "Le total a changé. Veuillez actualiser votre panier.",
        validation: validationResult,
        expectedTotal: serverTotal,
        providedTotal: clientTotal,
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      // Prepare items for stock consumption
      const stockItems = items.map((raw: any) => ({
        productId: Number(raw.productId),
        quantity: Math.max(1, Number(raw.quantity ?? 1)),
        combinationId:
          (raw.attributes?.combinationId as string) ||
          (raw.combinationId as string) ||
          null,
      }));

      // Validate all items have valid productId
      for (const item of stockItems) {
        if (!item.productId || !Number.isFinite(item.productId)) {
          throw new Error("Invalid item");
        }
        const exists = await tx.product.findUnique({
          where: { id: item.productId },
          select: { id: true },
        });
        if (!exists) {
          throw new Error("Product not found");
        }
      }

      // CONSUME STOCK FOR ALL PAYMENT METHODS (COD and card)
      await consumeStockForItems(tx, stockItems);

      // Prepare order items for database
      const orderItems = items.map((raw: any) => ({
        product: { connect: { id: Number(raw.productId) } },
        quantity: Math.max(1, Number(raw.quantity ?? 1)),
        price: Number(raw.price),
        variant: raw.variant ?? null,
        color: raw.color ?? null,
        size: raw.size ?? null,
        attributes: raw.attributes ?? null,
      }));

      // Create order with stockConsumed = true (always consumed at creation)
      return await tx.order.create({
        data: {
          name: client?.name || null,
          email: client?.email || null,
          phone: client?.phone || null,
          address: address || client?.address || null,
          region: region || client?.region || null,
          total: Number(total),
          paymentMethod,
          paymentStatus: initialPaymentStatus,
          status: initialStatus,
          stockConsumed: true,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });
    });

    // Meta CAPI: Track InitiateCheckout (non-blocking)
    // For card payments, this is the checkout start; Purchase fires after payment confirmation
    // For COD orders, we track both InitiateCheckout and Purchase here
    const orderItemsForCapi = order.items.map((item: { productId: number; quantity: number; price: number }) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.price,
    }));

    trackInitiateCheckout(
      {
        id: order.id,
        total: order.total,
        items: orderItemsForCapi,
      },
      {
        email: client?.email,
        phone: client?.phone,
        country: "TN",
        clientIp: req.ip,
        clientUserAgent: req.headers["user-agent"] as string | undefined,
      },
      `checkout_${order.id}`
    );

    // Send emails for COD orders (card orders send emails after payment confirmation)
    const isCodOrder = paymentMethod === "cod" || paymentMethod === "unknown";
    if (isCodOrder && order.email) {
      // Send emails in background - don't block the response
      sendOrderEmails(order.id).then((result) => {
        if (result.success) {
          console.log(`[orders] Emails sent for COD order #${order.id}`);
        } else {
          console.error(`[orders] Email errors for order #${order.id}:`, result.errors);
        }
      }).catch((err) => {
        console.error(`[orders] Email exception for order #${order.id}:`, err);
      });
    }

    res.status(201).json(order);
  } catch (err) {
    if (
      err instanceof Error &&
      ["Stock insuffisant", "Invalid item", "Product not found"].includes(
        err.message
      )
    ) {
      return res.status(400).json({ error: err.message });
    }
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

/**
 * GET single order (admin only)
 */
router.get(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: true } },
        },
      });

      if (!order) return res.status(404).json({ error: "Order not found" });
      res.json(order);
    } catch (err) {
      console.error("Error fetching order:", err);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  }
);

/**
 * PATCH order status (admin only)
 */
router.patch(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    const { status, paymentStatus } = req.body;

    const nextStatus = normalizeStatus(status);
    if (!nextStatus) return res.status(400).json({ error: "Missing status" });

    try {
      const existing = await prisma.order.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });
      if (!existing) return res.status(404).json({ error: "Order not found" });

      const prevStatus = normalizeStatus(existing.status);
      const wasRestored = RESTOCK_STATUSES.includes(prevStatus);
      const shouldRestock = RESTOCK_STATUSES.includes(nextStatus);

      const updated = await prisma.$transaction(async (tx) => {
        const updateData: any = { status: nextStatus };

        if (paymentStatus) {
          updateData.paymentStatus = paymentStatus;
        }

        if (shouldRestock && existing.stockConsumed && !wasRestored) {
          await restoreStockForItems(tx, existing.items as any[]);
          updateData.stockConsumed = false;
        }

        const updatedOrder = await tx.order.update({
          where: { id },
          data: updateData,
          include: { items: { include: { product: true } } },
        });

        return updatedOrder;
      });

      res.json(updated);
    } catch (err) {
      console.error("Error updating order:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  }
);

/**
 * DELETE order (admin only)
 */
router.delete(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req: AdminAuthRequest, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      await prisma.$transaction(async (tx) => {
        if (order.stockConsumed) {
          await restoreStockForItems(tx, order.items as any[]);
        }

        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.order.delete({ where: { id } });
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error deleting order:", err);
      res.status(500).json({ error: "Failed to delete order" });
    }
  }
);

export default router;
