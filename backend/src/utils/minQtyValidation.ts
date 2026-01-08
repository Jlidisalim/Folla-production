/**
 * Minimum Order Quantity Validation Utilities
 * 
 * Provides helper functions for validating and enforcing minimum order quantity
 * rules for retail and wholesale purchases.
 */

// Type definitions for product and combination data
export interface MinQtyProduct {
    saleType: string; // "piece" | "quantity" | "both"
    minOrderQtyRetail: number;
    minOrderQtyWholesale: number;
}

export interface MinQtyCombination {
    id: string;
    minOrderQtyRetail?: number | null;
    minOrderQtyWholesale?: number | null;
    stock?: number | null;
}

export type PurchaseMode = "piece" | "quantity";

/**
 * Get the effective minimum order quantity for a product/combination
 * considering the purchase mode (retail vs wholesale)
 * 
 * @param product - Product with minQty fields
 * @param combination - Optional combination that may override product-level minQty
 * @param mode - Purchase mode: "piece" (retail) or "quantity" (wholesale)
 * @returns The effective minimum order quantity
 */
export function getEffectiveMinQty(
    product: MinQtyProduct | null | undefined,
    combination: MinQtyCombination | null | undefined,
    mode: PurchaseMode
): number {
    // Default to 1 if no product
    if (!product) return 1;

    const isWholesale = mode === "quantity";

    // Check combination override first
    if (combination) {
        const comboOverride = isWholesale
            ? combination.minOrderQtyWholesale
            : combination.minOrderQtyRetail;

        if (typeof comboOverride === "number" && comboOverride >= 1) {
            return comboOverride;
        }
    }

    // Fallback to product-level minQty
    const productMinQty = isWholesale
        ? product.minOrderQtyWholesale
        : product.minOrderQtyRetail;

    return typeof productMinQty === "number" && productMinQty >= 1 ? productMinQty : 1;
}

/**
 * Validate minQty fields based on the product's saleType
 * 
 * @param saleType - Product sale type: "piece", "quantity", or "both"
 * @param minRetail - Minimum retail quantity
 * @param minWholesale - Minimum wholesale quantity
 * @returns Validation result with errors
 */
export function validateMinQtyRules(
    saleType: string,
    minRetail: number | null | undefined,
    minWholesale: number | null | undefined
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const normalizedSaleType = (saleType || "piece").toLowerCase();

    const retailValue = typeof minRetail === "number" ? minRetail : 1;
    const wholesaleValue = typeof minWholesale === "number" ? minWholesale : 1;

    // Validate retail min (required for "piece" and "both")
    if (normalizedSaleType === "piece" || normalizedSaleType === "both") {
        if (retailValue < 1) {
            errors.push("Minimum retail quantity must be at least 1");
        }
    }

    // Validate wholesale min (required for "quantity" and "both")
    if (normalizedSaleType === "quantity" || normalizedSaleType === "both") {
        if (wholesaleValue < 1) {
            errors.push("Minimum wholesale quantity must be at least 1");
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate cart quantity against minQty and stock rules
 * 
 * @param quantity - Requested quantity
 * @param minQty - Minimum order quantity
 * @param stock - Available stock (optional)
 * @returns Validation result with error message if invalid
 */
export function validateCartQuantity(
    quantity: number,
    minQty: number,
    stock?: number | null
): { valid: boolean; message?: string; suggestedQty?: number } {
    const effectiveMin = Math.max(1, minQty);

    // Check minimum quantity
    if (quantity < effectiveMin) {
        return {
            valid: false,
            message: `Minimum order is ${effectiveMin} units. Please choose at least ${effectiveMin}.`,
            suggestedQty: effectiveMin,
        };
    }

    // Check multiple-of rule
    if (quantity % effectiveMin !== 0) {
        const nextValidMultiple = Math.ceil(quantity / effectiveMin) * effectiveMin;
        const examples = [effectiveMin, effectiveMin * 2, effectiveMin * 3]
            .filter((v) => v <= Math.max(nextValidMultiple, effectiveMin * 3))
            .join(", ");

        return {
            valid: false,
            message: `Quantity must be a multiple of ${effectiveMin}. Please choose ${examples}...`,
            suggestedQty: nextValidMultiple,
        };
    }

    // Check stock availability
    if (typeof stock === "number" && stock >= 0 && quantity > stock) {
        const maxValidMultiple = Math.floor(stock / effectiveMin) * effectiveMin;

        if (maxValidMultiple < effectiveMin) {
            return {
                valid: false,
                message: `Insufficient stock. Only ${stock} available, but minimum order is ${effectiveMin}.`,
            };
        }

        return {
            valid: false,
            message: `Only ${stock} units available. Maximum you can order is ${maxValidMultiple}.`,
            suggestedQty: maxValidMultiple,
        };
    }

    return { valid: true };
}

/**
 * Round a quantity to the nearest valid multiple of minQty
 * 
 * @param quantity - Input quantity
 * @param minQty - Minimum order quantity (and step size)
 * @param roundUp - Whether to round up (default) or down
 * @returns Rounded quantity
 */
export function roundToValidMultiple(
    quantity: number,
    minQty: number,
    roundUp: boolean = true
): number {
    const effectiveMin = Math.max(1, minQty);

    if (quantity < effectiveMin) {
        return effectiveMin;
    }

    if (quantity % effectiveMin === 0) {
        return quantity;
    }

    if (roundUp) {
        return Math.ceil(quantity / effectiveMin) * effectiveMin;
    } else {
        return Math.floor(quantity / effectiveMin) * effectiveMin;
    }
}

/**
 * Check if purchase is possible given minQty and stock
 * Used to disable purchase UI when stock < minQty
 * 
 * @param minQty - Minimum order quantity
 * @param stock - Available stock
 * @returns Whether purchase is possible
 */
export function canPurchase(minQty: number, stock: number | null | undefined): boolean {
    if (typeof stock !== "number") return true; // No stock limit
    return stock >= Math.max(1, minQty);
}

/**
 * Generate user-friendly message about minimum order requirements
 * 
 * @param minQty - Minimum order quantity
 * @param mode - Purchase mode for label
 * @returns Formatted message string
 */
export function formatMinQtyMessage(minQty: number, mode: PurchaseMode): string {
    const modeLabel = mode === "quantity" ? "gros" : "détail";

    if (minQty <= 1) {
        return "";
    }

    return `Commande minimum: ${minQty} unités (${modeLabel}). Vendu par lots de ${minQty}.`;
}
