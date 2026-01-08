/**
 * Order Cancellation Route
 *
 * Handles order cancellation with required reason and proper notifications
 * based on payment method (CARD vs COD).
 */

import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { clerkAuth, ClerkAuthRequest } from "../middleware/clerkAuth";
import { requireAdmin, AdminAuthRequest } from "../middleware/requireAdmin";
import { restoreStockForItems } from "../services/stock.service";
import {
    CancelOrderSchema,
    createValidationErrorResponse,
} from "../validators/order.validator";
import logger from "../lib/logger";

const prisma = new PrismaClient();
const router = Router();

// Statuses that cannot be canceled
const NON_CANCELABLE_STATUSES = ["delivered", "completed"];

// ============================================================
// TYPES
// ============================================================

interface CancelNotificationPayload {
    orderId: number;
    orderCode: string;
    reason: string;
    canceledAt: Date;
    canceledBy: "admin" | "customer" | "system";
    paymentMethod: string | null;
    paymentStatus: string;
    customerEmail: string | null;
    customerName: string | null;
}

// ============================================================
// NOTIFICATION HELPERS
// ============================================================

/**
 * Create notification in database
 */
async function createCancellationNotification(
    tx: any,
    payload: CancelNotificationPayload,
    recipient: "admin" | "customer"
): Promise<void> {
    const orderCode = `#OR${payload.orderId.toString().padStart(3, "0")}`;

    await tx.notification.create({
        data: {
            type: "ORDER",
            title:
                recipient === "admin"
                    ? `Commande ${orderCode} annulée`
                    : `Votre commande ${orderCode} a été annulée`,
            message: payload.reason,
            payload: {
                orderId: payload.orderId,
                reason: payload.reason,
                canceledAt: payload.canceledAt.toISOString(),
                canceledBy: payload.canceledBy,
                paymentMethod: payload.paymentMethod,
                paymentStatus: payload.paymentStatus,
            },
            recipient,
            orderId: payload.orderId,
        },
    });
}

/**
 * Determine notification rules based on payment method and status
 *
 * | Payment Method | Payment Status | Admin | Customer |
 * |----------------|----------------|-------|----------|
 * | CARD (Paymee)  | PAID           | ✅    | ✅       |
 * | CARD (Paymee)  | != PAID        | ✅    | ❌       |
 * | COD            | Any            | ✅    | ✅       |
 */
function getNotificationRules(
    paymentMethod: string | null,
    paymentStatus: string
): { notifyAdmin: boolean; notifyCustomer: boolean; refundRequired: boolean } {
    const isCardPayment =
        paymentMethod === "paymee_card" || paymentMethod === "card";
    const isPaid = paymentStatus === "paid";

    if (isCardPayment) {
        if (isPaid) {
            return {
                notifyAdmin: true,
                notifyCustomer: true,
                refundRequired: true, // Paid card payment needs refund
            };
        } else {
            return {
                notifyAdmin: true,
                notifyCustomer: false, // Don't notify customer for unpaid card orders
                refundRequired: false,
            };
        }
    }

    // COD orders
    return {
        notifyAdmin: true,
        notifyCustomer: true,
        refundRequired: false,
    };
}

// ============================================================
// CANCEL ENDPOINT
// ============================================================

/**
 * PATCH /api/orders/:id/cancel
 * Cancel an order with required reason
 *
 * Rules:
 * - reason required, min 5 characters
 * - Cannot cancel delivered orders
 * - Saves cancelReason, canceledAt, sets status = "canceled"
 * - Restores stock if stockConsumed = true
 */
router.patch(
    "/:id/cancel",
    clerkAuth,
    requireAdmin,
    async (req: AdminAuthRequest, res) => {
        const orderId = Number(req.params.id);

        if (isNaN(orderId) || orderId <= 0) {
            return res.status(400).json({ error: "ID de commande invalide" });
        }

        try {
            // Validate request body
            const parseResult = CancelOrderSchema.safeParse(req.body);
            if (!parseResult.success) {
                logger.warn(
                    { errors: parseResult.error.issues, orderId },
                    "Cancel validation failed"
                );
                return res
                    .status(400)
                    .json(createValidationErrorResponse(parseResult.error));
            }

            const { reason } = parseResult.data;

            // Find the order
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: { include: { product: true } } },
            });

            if (!order) {
                return res.status(404).json({ error: "Commande introuvable" });
            }

            // Check if order can be canceled
            const normalizedStatus = order.status.toLowerCase().trim();
            if (NON_CANCELABLE_STATUSES.includes(normalizedStatus)) {
                return res.status(403).json({
                    error: "CANCEL_NOT_ALLOWED",
                    message: `Impossible d'annuler une commande ${order.status === "delivered" ? "livrée" : "terminée"}`,
                });
            }

            // Check if already canceled
            if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
                return res.status(400).json({
                    error: "ALREADY_CANCELED",
                    message: "Cette commande est déjà annulée",
                });
            }

            const canceledAt = new Date();
            const canceledBy = "admin"; // TODO: Determine from auth context

            // Get notification rules
            const notificationRules = getNotificationRules(
                order.paymentMethod,
                order.paymentStatus
            );

            // Cancel order in transaction
            const updatedOrder = await prisma.$transaction(async (tx) => {
                // Restore stock if consumed
                if (order.stockConsumed) {
                    await restoreStockForItems(tx, order.items as any[]);
                    logger.info({ orderId }, "Stock restored for canceled order");
                }

                // Update order
                const updated = await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: "canceled",
                        cancelReason: reason,
                        canceledAt,
                        canceledBy,
                        stockConsumed: false,
                        // Mark as refund_required if paid card payment
                        paymentStatus: notificationRules.refundRequired
                            ? "refund_required"
                            : order.paymentStatus,
                    },
                    include: { items: { include: { product: true } } },
                });

                // Create notification payload
                const notificationPayload: CancelNotificationPayload = {
                    orderId: order.id,
                    orderCode: `#OR${order.id.toString().padStart(3, "0")}`,
                    reason,
                    canceledAt,
                    canceledBy,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus,
                    customerEmail: order.email,
                    customerName: order.name,
                };

                // Create notifications
                if (notificationRules.notifyAdmin) {
                    await createCancellationNotification(tx, notificationPayload, "admin");
                }

                if (notificationRules.notifyCustomer && order.email) {
                    await createCancellationNotification(
                        tx,
                        notificationPayload,
                        "customer"
                    );
                }

                return updated;
            });

            logger.info(
                {
                    orderId,
                    reason,
                    canceledBy,
                    refundRequired: notificationRules.refundRequired,
                },
                "Order canceled successfully"
            );

            // Return canceled order
            res.json({
                id: updatedOrder.id,
                status: updatedOrder.status,
                cancelReason: updatedOrder.cancelReason,
                canceledAt: updatedOrder.canceledAt,
                canceledBy: updatedOrder.canceledBy,
                paymentStatus: updatedOrder.paymentStatus,
                refundRequired: notificationRules.refundRequired,
                message: "Commande annulée avec succès",
            });
        } catch (err) {
            logger.error({ err, orderId }, "Failed to cancel order");
            res.status(500).json({ error: "Échec de l'annulation de la commande" });
        }
    }
);

/**
 * GET /api/orders/:id/cancel-info
 * Get cancellation info for an order (for display in admin)
 */
router.get(
    "/:id/cancel-info",
    clerkAuth,
    requireAdmin,
    async (req: AdminAuthRequest, res) => {
        const orderId = Number(req.params.id);

        if (isNaN(orderId) || orderId <= 0) {
            return res.status(400).json({ error: "ID de commande invalide" });
        }

        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: {
                    id: true,
                    status: true,
                    cancelReason: true,
                    canceledAt: true,
                    canceledBy: true,
                    paymentMethod: true,
                    paymentStatus: true,
                },
            });

            if (!order) {
                return res.status(404).json({ error: "Commande introuvable" });
            }

            const normalizedStatus = order.status.toLowerCase().trim();
            const isCancelable = !NON_CANCELABLE_STATUSES.includes(normalizedStatus);
            const isCanceled =
                normalizedStatus === "canceled" || normalizedStatus === "cancelled";

            res.json({
                ...order,
                isCancelable,
                isCanceled,
            });
        } catch (err) {
            logger.error({ err, orderId }, "Failed to get cancel info");
            res
                .status(500)
                .json({ error: "Échec de la récupération des informations" });
        }
    }
);

export default router;
