/**
 * Payment Reconciliation Job
 * 
 * Finds orders stuck in 'pending_payment' state for too long and marks them as expired.
 * This handles cases where:
 * - User closed browser without completing payment
 * - Paymee webhook failed to deliver
 * - Network issues during payment process
 * 
 * Run this as a cron job every 15 minutes.
 */

import { PrismaClient } from "@prisma/client";
import logger from "../lib/logger";

const prisma = new PrismaClient();

// Default timeout: 30 minutes
const PAYMENT_TIMEOUT_MINUTES = parseInt(process.env.PAYMENT_TIMEOUT_MINUTES || "30", 10);

interface ReconciliationResult {
    processed: number;
    expired: number;
    stockRestored: number;
    errors: string[];
}

/**
 * Find and expire orphaned pending_payment orders
 */
export async function reconcileOrphanedPayments(): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
        processed: 0,
        expired: 0,
        stockRestored: 0,
        errors: [],
    };

    const cutoffTime = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000);

    logger.info({
        cutoffTime,
        timeoutMinutes: PAYMENT_TIMEOUT_MINUTES
    }, "Starting payment reconciliation job");

    try {
        // Find orders that have been in pending_payment for too long
        const orphanedOrders = await prisma.order.findMany({
            where: {
                paymentStatus: "pending_payment",
                createdAt: { lt: cutoffTime },
                // Don't touch orders already being processed
                status: "pending_payment",
            },
            include: {
                items: {
                    include: { product: true },
                },
            },
        });

        result.processed = orphanedOrders.length;

        if (orphanedOrders.length === 0) {
            logger.info("No orphaned payments found");
            return result;
        }

        logger.info({ count: orphanedOrders.length }, "Found orphaned pending_payment orders");

        // Process each orphaned order
        for (const order of orphanedOrders) {
            try {
                await prisma.$transaction(async (tx) => {
                    // Restore stock if it was consumed
                    if (order.stockConsumed) {
                        for (const item of order.items) {
                            // Parse combination info from attributes
                            const combinationId =
                                (item.attributes as any)?.combinationId ||
                                (item.attributes as any)?.combination_id;

                            if (combinationId) {
                                // Restore variant stock
                                const product = await tx.product.findUnique({
                                    where: { id: item.productId },
                                });

                                if (product?.combinations) {
                                    const combinations = product.combinations as any[];
                                    const combo = combinations.find(c => c.id === combinationId);
                                    if (combo && typeof combo.stock === "number") {
                                        combo.stock += item.quantity;
                                        await tx.product.update({
                                            where: { id: item.productId },
                                            data: { combinations },
                                        });
                                        result.stockRestored++;
                                    }
                                }
                            } else {
                                // Restore main product stock
                                await tx.product.update({
                                    where: { id: item.productId },
                                    data: {
                                        availableQuantity: { increment: item.quantity },
                                    },
                                });
                                result.stockRestored++;
                            }
                        }
                    }

                    // Mark order as expired
                    await tx.order.update({
                        where: { id: order.id },
                        data: {
                            paymentStatus: "expired",
                            status: "cancelled",
                            stockConsumed: false,
                            cancelReason: "Paiement expiré - délai dépassé",
                            canceledAt: new Date(),
                            canceledBy: "system",
                        },
                    });
                });

                result.expired++;
                logger.info({
                    orderId: order.id,
                    createdAt: order.createdAt,
                    ageMinutes: Math.round((Date.now() - order.createdAt.getTime()) / 60000),
                }, "Expired orphaned order and restored stock");

            } catch (orderErr: any) {
                const errorMsg = `Failed to expire order #${order.id}: ${orderErr.message}`;
                result.errors.push(errorMsg);
                logger.error({ orderId: order.id, err: orderErr }, "Failed to expire orphaned order");
            }
        }

    } catch (err: any) {
        const errorMsg = `Reconciliation job failed: ${err.message}`;
        result.errors.push(errorMsg);
        logger.error({ err }, "Payment reconciliation job failed");
    }

    logger.info({
        processed: result.processed,
        expired: result.expired,
        stockRestored: result.stockRestored,
        errors: result.errors.length,
    }, "Payment reconciliation job completed");

    return result;
}

/**
 * Start the reconciliation job as a recurring interval
 * Call this once at application startup
 */
export function startReconciliationJob(intervalMinutes = 15): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info({ intervalMinutes }, "Starting payment reconciliation scheduler");

    // Run immediately on startup (after a short delay)
    setTimeout(() => {
        reconcileOrphanedPayments().catch(err => {
            logger.error({ err }, "Initial reconciliation job failed");
        });
    }, 10000); // 10 second delay on startup

    // Then run on interval
    return setInterval(() => {
        reconcileOrphanedPayments().catch(err => {
            logger.error({ err }, "Scheduled reconciliation job failed");
        });
    }, intervalMs);
}

export default { reconcileOrphanedPayments, startReconciliationJob };
