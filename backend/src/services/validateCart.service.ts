/**
 * Cart Validation Service
 * 
 * Validates cart items against the latest product data from the database.
 * This is the single source of truth for cart validation - frontend cart must never be trusted.
 */

import { PrismaClient } from "@prisma/client";
import {
    getEffectiveMinQty,
    validateCartQuantity,
    roundToValidMultiple,
    type MinQtyProduct,
    type MinQtyCombination,
    type PurchaseMode,
} from "../utils/minQtyValidation";

const prisma = new PrismaClient();

// Types
export interface CartItemInput {
    productId: number;
    combinationId?: string | null;
    quantity: number;
    unitType: "piece" | "quantity";
}

export interface ValidatedCartItem {
    productId: number;
    combinationId: string | null;
    quantity: number;
    originalQuantity: number;
    unitType: "piece" | "quantity";
    unitPrice: number;
    originalPrice?: number;
    subtotal: number;
    title: string;
    image: string | null;
    variantLabel: string | null;
    minQty: number;
    maxQty: number | null;
    inStock: boolean;
    isValid: boolean;
}

export interface CartIssue {
    type: 'removed' | 'quantity_adjusted' | 'price_changed' | 'out_of_stock' | 'invalid_combination' | 'below_min_qty';
    productId: number;
    combinationId?: string | null;
    message: string;
    details?: any;
}

export interface CartTotals {
    itemsTotal: number;
    shipping: number;
    grandTotal: number;
    freeShippingThreshold: number;
    isFreeShipping: boolean;
}

export interface ValidateCartResult {
    valid: boolean;
    normalizedItems: ValidatedCartItem[];
    totals: CartTotals;
    issues: CartIssue[];
    removedProductIds: number[];
}

/**
 * Check if flash sale is currently active within date range
 */
function isFlashActiveNow(product: any): boolean {
    if (!product?.venteFlashActive) return false;

    const now = Date.now();

    if (product.flashStartAt) {
        const startDate = new Date(product.flashStartAt);
        if (!isNaN(startDate.getTime()) && startDate.getTime() > now) {
            return false;
        }
    }

    if (product.flashEndAt) {
        const endDate = new Date(product.flashEndAt);
        if (!isNaN(endDate.getTime()) && endDate.getTime() < now) {
            return false;
        }
    }

    return true;
}

/**
 * Check if a combination is eligible for flash discount
 */
function isComboFlashEligible(product: any, combinationId: string | null): boolean {
    if (!combinationId) return false;

    const target = product?.flashApplyTarget ?? "product";
    if (target !== "combinations") return false;

    const applyAll = product?.flashApplyAllCombinations !== false;
    if (applyAll) return true;

    const eligibleIds: string[] = Array.isArray(product?.flashCombinationIds)
        ? product.flashCombinationIds.map((id: any) => String(id))
        : [];

    return eligibleIds.includes(String(combinationId));
}

/**
 * Apply flash discount to a price
 */
function applyFlashDiscount(basePrice: number, product: any): number {
    const flashDiscountType = product?.flashDiscountType ?? "percent";
    let discountValue: number | null = null;

    if (flashDiscountType === "percent") {
        discountValue = product?.venteFlashPercentage !== null
            ? Number(product.venteFlashPercentage)
            : (product?.flashDiscountValue !== null ? Number(product.flashDiscountValue) : null);
    } else {
        discountValue = product?.flashDiscountValue !== null
            ? Number(product.flashDiscountValue)
            : null;
    }

    if (discountValue === null || discountValue <= 0) {
        return basePrice;
    }

    if (flashDiscountType === "fixed") {
        return Math.max(0, Number((basePrice - discountValue).toFixed(3)));
    } else {
        return Number((basePrice - (basePrice * discountValue) / 100).toFixed(3));
    }
}

/**
 * Check if product is publicly visible
 */
function isProductPublic(product: any): boolean {
    if (!product) return false;
    if (product.visible === false) return false;
    if (product.status !== "Active") return false;

    // Check publishAt date
    if (product.publishAt) {
        const publishDate = new Date(product.publishAt);
        if (!isNaN(publishDate.getTime()) && publishDate.getTime() > Date.now()) {
            return false;
        }
    }

    return true;
}

/**
 * Get the correct price for unit type and combination
 */
function getPrice(product: any, combination: any | null, unitType: "piece" | "quantity"): number {
    let price = 0;

    // Try combination price first
    if (combination) {
        if (unitType === "quantity") {
            price = combination.priceQuantity ?? combination.pricePiece ?? 0;
        } else {
            price = combination.pricePiece ?? combination.priceQuantity ?? 0;
        }
    }

    // Fallback to product price
    if (price === 0) {
        if (unitType === "quantity") {
            price = product.priceQuantity ?? product.pricePiece ?? 0;
        } else {
            price = product.pricePiece ?? product.priceQuantity ?? 0;
        }
    }

    return Number(price) || 0;
}

/**
 * Get stock for product/combination
 */
function getStock(product: any, combination: any | null): number | null {
    if (combination && typeof combination.stock === "number") {
        return Math.max(0, Math.floor(combination.stock));
    }
    if (typeof product.availableQuantity === "number") {
        return Math.max(0, Math.floor(product.availableQuantity));
    }
    return null;
}

/**
 * Get shipping settings from database
 */
async function getShippingSettings(): Promise<{ shippingFee: number; freeShippingThreshold: number }> {
    try {
        const settings = await prisma.shopSettings.findFirst();
        return {
            shippingFee: settings?.defaultShippingFeeDt ?? 8,
            freeShippingThreshold: settings?.freeShippingThresholdDt ?? 200,
        };
    } catch {
        return { shippingFee: 8, freeShippingThreshold: 200 };
    }
}

/**
 * Main validation function - validates cart items against latest DB data
 */
export async function validateCart(items: CartItemInput[]): Promise<ValidateCartResult> {
    const normalizedItems: ValidatedCartItem[] = [];
    const issues: CartIssue[] = [];
    const removedProductIds: number[] = [];

    // Get unique product IDs
    const productIds = [...new Set(items.map(i => i.productId))];

    // Fetch all products at once
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
        const product = productMap.get(item.productId);

        // 1. Check product existence
        if (!product) {
            issues.push({
                type: 'removed',
                productId: item.productId,
                combinationId: item.combinationId,
                message: "Ce produit n'existe plus.",
            });
            removedProductIds.push(item.productId);
            continue;
        }

        // 2. Check product visibility/availability
        if (!isProductPublic(product)) {
            issues.push({
                type: 'removed',
                productId: item.productId,
                combinationId: item.combinationId,
                message: "Ce produit n'est plus disponible.",
            });
            removedProductIds.push(item.productId);
            continue;
        }

        // 3. Check combination validity
        let combination: any = null;
        if (item.combinationId && product.combinations) {
            const combinations = product.combinations as any[];
            combination = combinations.find((c: any) => c.id === item.combinationId);

            if (!combination) {
                issues.push({
                    type: 'invalid_combination',
                    productId: item.productId,
                    combinationId: item.combinationId,
                    message: "Cette variante n'existe plus.",
                });
                removedProductIds.push(item.productId);
                continue;
            }
        }

        // 4. Get latest price
        let basePrice = getPrice(product, combination, item.unitType);
        let finalPrice = basePrice;

        // Apply flash discount if applicable
        if (isFlashActiveNow(product)) {
            const flashTarget = product.flashApplyTarget ?? "product";
            let shouldApplyFlash = false;

            if (flashTarget === "product") {
                shouldApplyFlash = true;
            } else if (flashTarget === "combinations" && item.combinationId) {
                shouldApplyFlash = isComboFlashEligible(product, item.combinationId);
            }

            if (shouldApplyFlash) {
                finalPrice = applyFlashDiscount(basePrice, product);
            }
        }

        // 5. Check stock
        const stock = getStock(product, combination);
        const isInStock = product.inStock !== false && (stock === null || stock > 0);

        if (!isInStock) {
            issues.push({
                type: 'out_of_stock',
                productId: item.productId,
                combinationId: item.combinationId,
                message: "Ce produit est en rupture de stock.",
            });
            removedProductIds.push(item.productId);
            continue;
        }

        // 6. Validate and adjust quantity based on minQty/stock
        const productMinQty: MinQtyProduct = {
            saleType: product.saleType || "piece",
            minOrderQtyRetail: product.minOrderQtyRetail ?? 1,
            minOrderQtyWholesale: product.minOrderQtyWholesale ?? 1,
        };

        const combMinQty: MinQtyCombination | null = combination ? {
            id: combination.id,
            minOrderQtyRetail: combination.minOrderQtyRetail ?? null,
            minOrderQtyWholesale: combination.minOrderQtyWholesale ?? null,
            stock: combination.stock ?? null,
        } : null;

        const purchaseMode: PurchaseMode = item.unitType === "quantity" ? "quantity" : "piece";
        const effectiveMinQty = getEffectiveMinQty(productMinQty, combMinQty, purchaseMode);

        let adjustedQuantity = item.quantity;
        const originalQuantity = item.quantity;

        // Check minimum quantity
        if (adjustedQuantity < effectiveMinQty) {
            adjustedQuantity = effectiveMinQty;
            issues.push({
                type: 'quantity_adjusted',
                productId: item.productId,
                combinationId: item.combinationId,
                message: `Quantité minimum: ${effectiveMinQty}. Ajusté de ${originalQuantity} à ${adjustedQuantity}.`,
                details: { from: originalQuantity, to: adjustedQuantity, reason: 'min_qty' },
            });
        }

        // Check multiple of minQty
        if (adjustedQuantity % effectiveMinQty !== 0) {
            adjustedQuantity = roundToValidMultiple(adjustedQuantity, effectiveMinQty, true);
            if (adjustedQuantity !== originalQuantity) {
                issues.push({
                    type: 'quantity_adjusted',
                    productId: item.productId,
                    combinationId: item.combinationId,
                    message: `Quantité ajustée à ${adjustedQuantity} (multiple de ${effectiveMinQty}).`,
                    details: { from: originalQuantity, to: adjustedQuantity, reason: 'multiple' },
                });
            }
        }

        // Check stock limit
        if (stock !== null && adjustedQuantity > stock) {
            const maxValid = Math.floor(stock / effectiveMinQty) * effectiveMinQty;
            if (maxValid < effectiveMinQty) {
                // Can't order at all - not enough stock
                issues.push({
                    type: 'out_of_stock',
                    productId: item.productId,
                    combinationId: item.combinationId,
                    message: `Stock insuffisant. Disponible: ${stock}, minimum: ${effectiveMinQty}.`,
                });
                removedProductIds.push(item.productId);
                continue;
            }
            adjustedQuantity = maxValid;
            issues.push({
                type: 'quantity_adjusted',
                productId: item.productId,
                combinationId: item.combinationId,
                message: `Stock limité. Quantité ajustée de ${originalQuantity} à ${adjustedQuantity}.`,
                details: { from: originalQuantity, to: adjustedQuantity, reason: 'stock', available: stock },
            });
        }

        // Build variant label
        let variantLabel: string | null = null;
        if (combination && combination.options && typeof combination.options === 'object') {
            const opts = combination.options as Record<string, string>;
            variantLabel = Object.entries(opts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
        }

        // Create normalized item
        normalizedItems.push({
            productId: item.productId,
            combinationId: item.combinationId || null,
            quantity: adjustedQuantity,
            originalQuantity,
            unitType: item.unitType,
            unitPrice: finalPrice,
            originalPrice: basePrice !== finalPrice ? basePrice : undefined,
            subtotal: Number((finalPrice * adjustedQuantity).toFixed(2)),
            title: product.title,
            image: product.images?.[0] || null,
            variantLabel,
            minQty: effectiveMinQty,
            maxQty: stock,
            inStock: true,
            isValid: true,
        });
    }

    // Calculate totals
    const settings = await getShippingSettings();
    const itemsTotal = Number(normalizedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const isFreeShipping = itemsTotal >= settings.freeShippingThreshold;
    const shipping = isFreeShipping ? 0 : settings.shippingFee;
    const grandTotal = Number((itemsTotal + shipping).toFixed(2));

    const totals: CartTotals = {
        itemsTotal,
        shipping,
        grandTotal,
        freeShippingThreshold: settings.freeShippingThreshold,
        isFreeShipping,
    };

    // Determine if cart is valid (no major issues)
    const valid = issues.every(i => i.type === 'price_changed' || i.type === 'quantity_adjusted');

    return {
        valid,
        normalizedItems,
        totals,
        issues,
        removedProductIds,
    };
}

/**
 * Compare client cart with validated cart to detect price changes
 */
export function detectPriceChanges(
    clientItems: Array<{ productId: number; combinationId?: string | null; unitPrice: number }>,
    validatedItems: ValidatedCartItem[]
): CartIssue[] {
    const priceIssues: CartIssue[] = [];

    for (const clientItem of clientItems) {
        const validatedItem = validatedItems.find(
            v => v.productId === clientItem.productId &&
                v.combinationId === (clientItem.combinationId || null)
        );

        if (validatedItem && Math.abs(validatedItem.unitPrice - clientItem.unitPrice) > 0.01) {
            priceIssues.push({
                type: 'price_changed',
                productId: clientItem.productId,
                combinationId: clientItem.combinationId || null,
                message: `Prix mis à jour: ${clientItem.unitPrice} DT → ${validatedItem.unitPrice} DT`,
                details: {
                    oldPrice: clientItem.unitPrice,
                    newPrice: validatedItem.unitPrice
                },
            });
        }
    }

    return priceIssues;
}
