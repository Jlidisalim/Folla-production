/**
 * Paymee Webhook Handler
 * 
 * This route handles Paymee payment webhook notifications.
 * It must be mounted BEFORE clerkMiddleware() to bypass auth.
 */

import express from "express";
import { PrismaClient } from "@prisma/client";
import { verifyPaymeeChecksum } from "../services/paymee.service";
import { restoreStockForItems } from "../services/stock.service";
import { sendOrderEmails } from "../services/emailService";
import { trackPurchase } from "../services/metaCapiService";
import logger from "../lib/logger";

const router = express.Router();
const prisma = new PrismaClient();

// Order item type for stock restoration
interface OrderItemWithProduct {
    productId: number;
    quantity: number;
    attributes: any;
}

/**
 * POST /api/paymee/webhook
 * Receives payment status updates from Paymee.
 * This endpoint is public but secured via checksum validation.
 */
router.post("/", async (req, res) => {
    try {
        console.log("[Paymee Webhook] Received webhook");
        console.log("[Paymee Webhook] Body:", JSON.stringify(req.body, null, 2));

        const { token, payment_status, check_sum } = req.body;

        // Validate required fields
        if (!token) {
            console.log("[Paymee Webhook] Missing token");
            return res.status(400).json({ error: "token manquant" });
        }

        // Verify checksum - SECURITY: Always validate checksum
        // In production, REJECT if checksum is missing
        const isProd = process.env.NODE_ENV === "production";

        if (!check_sum) {
            if (isProd) {
                logger.error({ token }, "Paymee webhook rejected: missing check_sum in production");
                return res.status(400).json({ error: "check_sum manquant - rejeté en production" });
            } else {
                // In development, warn but continue for testing
                logger.warn({ token }, "Paymee webhook received without checksum (allowed in dev only)");
            }
        } else {
            const isValid = verifyPaymeeChecksum(req.body);
            if (!isValid) {
                logger.warn({ token, payload: req.body }, "Paymee webhook invalid checksum");
                return res.status(400).json({ error: "Checksum invalide" });
            }
            logger.info({ token }, "Paymee webhook checksum verified");
        }

        // Find order by providerPaymentId (token)
        const order = await prisma.order.findFirst({
            where: { providerPaymentId: token },
            include: { items: { include: { product: true } } },
        });

        if (!order) {
            logger.warn({ token }, "Paymee webhook order not found for token");
            return res.status(404).json({ error: "Commande non trouvée" });
        }

        logger.info({ orderId: order.id, payment_status }, "Paymee webhook processing");

        // IDEMPOTENCY GUARD: Prevent duplicate processing
        // If order is already in a terminal state, acknowledge but don't reprocess
        if (order.paymentStatus === "paid") {
            logger.info({ orderId: order.id }, "Paymee webhook: order already paid, ignoring duplicate");
            return res.json({ ok: true, status: "already_paid" });
        }
        if (order.paymentStatus === "failed" || order.paymentStatus === "cancelled") {
            logger.info({ orderId: order.id, status: order.paymentStatus }, "Paymee webhook: order already terminal, ignoring");
            return res.json({ ok: true, status: "already_processed" });
        }

        // Handle payment status - Paymee can send boolean, string, or number
        const statusStr = String(payment_status).toLowerCase();
        const isPaid = payment_status === true ||
            payment_status === 1 ||
            statusStr === "true" ||
            statusStr === "1" ||
            statusStr === "completed" ||
            statusStr === "paid";
        const isFailed = payment_status === false ||
            payment_status === 0 ||
            statusStr === "false" ||
            statusStr === "0" ||
            statusStr === "failed" ||
            statusStr === "cancelled";

        if (isPaid) {
            // Update order to paid
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    paymentStatus: "paid",
                    status: "pending", // Move from pending_payment to pending
                    paidAt: new Date(),
                },
            });

            logger.info({ orderId: order.id }, "Paymee webhook: order marked as paid");

            // Track purchase for Meta CAPI
            const orderItems = order.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.price,
            }));

            trackPurchase(
                {
                    id: order.id,
                    total: order.total,
                    items: orderItems,
                },
                {
                    email: order.email || undefined,
                    phone: order.phone || undefined,
                    country: "TN",
                },
                `order_${order.id}`
            );

            // Send order confirmation emails
            if (order.email) {
                sendOrderEmails(order.id).then((result) => {
                    if (result.success) {
                        logger.info({ orderId: order.id }, "Paymee webhook: emails sent");
                    } else {
                        logger.error({ orderId: order.id, errors: result.errors }, "Paymee webhook: email errors");
                    }
                }).catch((err) => {
                    logger.error({ orderId: order.id, err }, "Paymee webhook: email exception");
                });
            }

            return res.json({ ok: true, status: "paid" });
        }

        if (isFailed) {
            // Restore stock and mark as cancelled
            await prisma.$transaction(async (tx) => {
                if (order.stockConsumed) {
                    await restoreStockForItems(tx, order.items as OrderItemWithProduct[]);
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

            logger.info({ orderId: order.id }, "Paymee webhook: order failed, stock restored");
            return res.json({ ok: true, status: "failed" });
        }

        // Unknown status - log and acknowledge
        logger.warn({ orderId: order.id, payment_status }, "Paymee webhook: unknown status");
        return res.json({ ok: true, status: "unknown" });
    } catch (err: any) {
        logger.error({ err }, "Paymee webhook error");
        res.status(500).json({ error: "Webhook processing error" });
    }
});

export default router;
