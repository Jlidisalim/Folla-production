import { Prisma } from "@prisma/client";

/**
 * Stock Service - Centralized stock management for order lifecycle
 *
 * Rule 1: consumeStockForItems - called ONLY at order creation
 * Rule 2: restoreStockForOrder - called on cancel/refund
 */

type TransactionClient = Prisma.TransactionClient;

interface OrderItemInput {
  productId: number;
  quantity: number;
  combinationId?: string | null;
}

interface OrderItemWithProduct {
  productId: number;
  quantity: number;
  attributes?: { combinationId?: string; combination_id?: string } | null;
  product?: {
    id: number;
    availableQuantity: number;
    combinations?: any;
  } | null;
}

const toNumber = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Aggregates order items by (productId, combinationId) to handle
 * multiple items of the same product/variant in one order.
 */
function aggregateItems(
  items: OrderItemInput[]
): Map<string, OrderItemInput> {
  const map = new Map<string, OrderItemInput>();

  for (const item of items) {
    const key = `${item.productId}:${item.combinationId ?? "main"}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, { ...item });
    }
  }

  return map;
}

/**
 * Consume (decrement) stock for order items during order creation.
 * Must be called inside a Prisma transaction.
 *
 * For each item:
 * - If combinationId exists → decrement that combination's stock in JSON
 * - Else → decrement Product.availableQuantity using atomic check
 *
 * Throws "Stock insuffisant" if any item has insufficient stock.
 */
export async function consumeStockForItems(
  tx: TransactionClient,
  items: OrderItemInput[]
): Promise<void> {
  // Aggregate items by (productId, combinationId) to handle duplicates
  const aggregated = aggregateItems(items);

  for (const item of aggregated.values()) {
    const { productId, quantity, combinationId } = item;
    const qty = Math.max(1, toNumber(quantity));

    // Lock the product row to prevent race conditions
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, availableQuantity: true, combinations: true },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    const combinations: any[] = Array.isArray(product.combinations)
      ? (product.combinations as any[])
      : [];

    let consumed = false;

    // Handle combination stock
    if (combinations.length > 0 && combinationId) {
      const idx = combinations.findIndex(
        (c) => String(c?.id ?? c?.combinationId ?? "") === String(combinationId)
      );

      if (idx !== -1 && combinations[idx]) {
        const currentStock = toNumber(combinations[idx].stock);

        if (currentStock < qty) {
          throw new Error("Stock insuffisant");
        }

        // Decrement combination stock
        combinations[idx].stock = currentStock - qty;

        // Recalculate total stock from all combinations
        const totalComboStock = combinations.reduce((acc, c) => {
          const s = toNumber(c?.stock);
          return acc + Math.max(0, Math.floor(s));
        }, 0);

        await tx.product.update({
          where: { id: productId },
          data: {
            combinations,
            availableQuantity: totalComboStock,
            inStock: totalComboStock > 0,
          },
        });

        consumed = true;
      }
    }

    // Fallback to main product stock (no combinations or combinationId not found)
    if (!consumed) {
      const current = toNumber(product.availableQuantity);

      if (current < qty) {
        throw new Error("Stock insuffisant");
      }

      const nextQty = current - qty;

      // Single atomic update (FOR UPDATE already locks the row)
      await tx.product.update({
        where: { id: productId },
        data: {
          availableQuantity: nextQty,
          inStock: nextQty > 0,
        },
      });
    }
  }
}

/**
 * Restore (increment) stock for order items during cancel/refund.
 * Must be called inside a Prisma transaction.
 *
 * Only call this when stockConsumed === true.
 * For each item:
 * - If combinationId exists → increment that combination's stock in JSON
 * - Else → increment Product.availableQuantity
 */
export async function restoreStockForItems(
  tx: TransactionClient,
  items: OrderItemWithProduct[]
): Promise<void> {
  // Aggregate items by (productId, combinationId)
  const aggregated = new Map<string, { productId: number; qty: number; combinationId: string | null }>();

  for (const item of items) {
    const qty = Math.max(1, toNumber(item.quantity));
    const productId = item.productId;

    if (!productId || qty <= 0) continue;

    const combinationId =
      (item.attributes as any)?.combinationId ||
      (item.attributes as any)?.combination_id ||
      null;

    const key = `${productId}:${combinationId ?? "main"}`;
    const existing = aggregated.get(key);

    if (existing) {
      existing.qty += qty;
    } else {
      aggregated.set(key, { productId, qty, combinationId });
    }
  }

  for (const { productId, qty, combinationId } of aggregated.values()) {
    // Lock product row
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;

    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, availableQuantity: true, combinations: true },
    });

    if (!product) continue;

    const combinations: any[] = Array.isArray(product.combinations)
      ? (product.combinations as any[])
      : [];

    let restored = false;

    // Handle combination stock restore
    if (combinations.length > 0 && combinationId) {
      const idx = combinations.findIndex(
        (c) => String(c?.id ?? c?.combinationId ?? "") === String(combinationId)
      );

      if (idx !== -1 && combinations[idx]) {
        const currentStock = toNumber(combinations[idx].stock);
        combinations[idx].stock = currentStock + qty;

        // Recalculate total stock from all combinations
        const totalComboStock = combinations.reduce((acc, c) => {
          const s = toNumber(c?.stock);
          return acc + Math.max(0, Math.floor(s));
        }, 0);

        await tx.product.update({
          where: { id: productId },
          data: {
            combinations,
            availableQuantity: totalComboStock,
            inStock: totalComboStock > 0,
          },
        });

        restored = true;
      }
    }

    // Fallback to main product stock
    if (!restored) {
      const current = toNumber(product.availableQuantity);
      const nextQty = current + qty;

      await tx.product.update({
        where: { id: productId },
        data: {
          availableQuantity: nextQty,
          inStock: true, // Any stock > 0 means in stock
        },
      });
    }
  }
}
