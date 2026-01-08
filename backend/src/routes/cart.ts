import { Router } from "express";
import { jwtAuth, AuthenticatedRequest } from "../middleware/jwtAuth";
import * as cartService from "../services/cart.service";
import { PrismaClient } from "@prisma/client";
import { getEffectiveMinQty, validateCartQuantity, type MinQtyProduct, type MinQtyCombination, type PurchaseMode } from "../utils/minQtyValidation";

const router = Router();
const prisma = new PrismaClient();

/**
 * Helper function to check if flash sale is currently active within date range
 */
function isFlashActiveNow(product: any): boolean {
  if (!product?.venteFlashActive) return false;

  const now = Date.now();

  // Check start date
  if (product.flashStartAt) {
    const startDate = new Date(product.flashStartAt);
    if (!isNaN(startDate.getTime()) && startDate.getTime() > now) {
      return false; // Flash sale hasn't started yet
    }
  }

  // Check end date
  if (product.flashEndAt) {
    const endDate = new Date(product.flashEndAt);
    if (!isNaN(endDate.getTime()) && endDate.getTime() < now) {
      return false; // Flash sale has ended
    }
  }

  return true;
}

/**
 * Helper function to check if a combination is eligible for flash discount
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
 * Helper function to apply flash discount to a price
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
    // percent
    return Number((basePrice - (basePrice * discountValue) / 100).toFixed(3));
  }
}

/**
 * GET /api/cart
 * Get current user's cart with all items
 */
router.get("/", jwtAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkId = req.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cart = await cartService.getCartWithItems(clerkId);

    if (!cart) {
      return res.json({ cart: { items: [] } });
    }

    res.json({ cart });
  } catch (err: any) {
    console.error("Get cart error:", err);
    res.status(500).json({ error: err.message || "Failed to get cart" });
  }
});

/**
 * POST /api/cart/items
 * Add item to cart or update existing item
 * 
 * Body: {
 *   productId: number,
 *   combinationId?: string,
 *   quantity: number,
 *   unitType: "piece" | "quantity"
 * }
 */
router.post("/items", jwtAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkId = req.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { productId, combinationId, quantity, unitType, priceFromClient } = req.body;

    // Validate required fields
    if (!productId || !quantity || !unitType) {
      return res.status(400).json({
        error: "Missing required fields: productId, quantity, unitType",
      });
    }

    // Validate quantity
    if (quantity < 1) {
      return res.status(400).json({ error: "Quantity must be at least 1" });
    }

    // Fetch product to get current price and details
    const product = await prisma.product.findUnique({
      where: { id: Number(productId) },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Determine price based on unit type and combination
    let price: number = 0;
    let usedClientPrice = false;

    // If frontend provided a pre-calculated price (with flash sale applied), use it
    if (typeof priceFromClient === 'number' && priceFromClient > 0) {
      price = priceFromClient;
      usedClientPrice = true;
      console.log(`[Cart] Using client-provided price: ${price}`);
    }

    // Only calculate price from product/combination if client didn't provide a price
    if (!usedClientPrice) {
      // First, try to get price from combination if combinationId is provided
      if (combinationId && product.combinations) {
        const combinations = product.combinations as any[];
        const combination = combinations.find((c: any) => c.id === combinationId);

        if (combination) {
          console.log(`[Cart] Found combination ${combinationId} for product ${product.id}`);

          // Check combination-level prices based on unit type
          if (unitType === "quantity") {
            price = combination.priceQuantity !== null && combination.priceQuantity !== undefined
              ? Number(combination.priceQuantity)
              : (combination.pricePiece !== null && combination.pricePiece !== undefined
                ? Number(combination.pricePiece)
                : 0);
          } else {
            price = combination.pricePiece !== null && combination.pricePiece !== undefined
              ? Number(combination.pricePiece)
              : (combination.priceQuantity !== null && combination.priceQuantity !== undefined
                ? Number(combination.priceQuantity)
                : 0);
          }

          console.log(`[Cart] Using combination price: ${price} (unitType: ${unitType})`);
        } else {
          console.warn(`[Cart] Combination ${combinationId} not found in product ${product.id}`);
        }
      }

      // If no combination price found, use product-level price
      if (price === 0) {
        if (unitType === "quantity") {
          price = product.priceQuantity !== null ? product.priceQuantity : (product.pricePiece !== null ? product.pricePiece : 0);
        } else {
          price = product.pricePiece !== null ? product.pricePiece : (product.priceQuantity !== null ? product.priceQuantity : 0);
        }
        console.log(`[Cart] Using product-level price: ${price} (unitType: ${unitType})`);
      }

      if (price === 0) {
        console.warn(`[Cart] WARNING: Price is 0 for product ${product.id}, combination ${combinationId || 'none'}, unitType ${unitType}`);
      }

      // Apply vente flash discount if active and within date range
      if (price > 0 && isFlashActiveNow(product)) {
        const flashTarget = (product as any).flashApplyTarget ?? "product";
        let shouldApplyFlash = false;

        if (flashTarget === "product") {
          shouldApplyFlash = true;
        } else if (flashTarget === "combinations" && combinationId) {
          shouldApplyFlash = isComboFlashEligible(product, combinationId);
        }

        if (shouldApplyFlash) {
          const basePrice = price;
          price = applyFlashDiscount(basePrice, product);
          console.log(`[Cart] Applied vente flash discount. Price: ${basePrice} -> ${price}`);
        } else {
          console.log(`[Cart] Flash sale active but not applicable for this item (target: ${flashTarget}, comboId: ${combinationId || 'none'})`);
        }
      }
    }

    // Validate stock
    const stockCheck = await cartService.validateCartItemStock(
      Number(productId),
      combinationId || null,
      quantity
    );

    if (!stockCheck.valid) {
      return res.status(400).json({
        error: stockCheck.message,
        available: stockCheck.available,
      });
    }

    // === MinQty Validation ===
    let selectedCombination: MinQtyCombination | null = null;
    if (combinationId && product.combinations) {
      const combinations = product.combinations as any[];
      const combo = combinations.find((c: any) => c.id === combinationId);
      if (combo) {
        selectedCombination = {
          id: combo.id,
          minOrderQtyRetail: combo.minOrderQtyRetail ?? null,
          minOrderQtyWholesale: combo.minOrderQtyWholesale ?? null,
          stock: combo.stock ?? null,
        };
      }
    }

    const productMinQty: MinQtyProduct = {
      saleType: product.saleType || "piece",
      minOrderQtyRetail: product.minOrderQtyRetail ?? 1,
      minOrderQtyWholesale: product.minOrderQtyWholesale ?? 1,
    };

    const purchaseMode: PurchaseMode = unitType === "quantity" ? "quantity" : "piece";
    const effectiveMinQty = getEffectiveMinQty(productMinQty, selectedCombination, purchaseMode);

    const itemStock = selectedCombination?.stock ?? (typeof product.availableQuantity === "number" ? product.availableQuantity : null);

    const qtyValidation = validateCartQuantity(quantity, effectiveMinQty, itemStock);
    if (!qtyValidation.valid) {
      return res.status(400).json({
        error: qtyValidation.message,
        suggestedQty: qtyValidation.suggestedQty,
        minQty: effectiveMinQty,
      });
    }

    const image = product.images?.[0] || null;

    const item = await cartService.addOrUpdateCartItem(clerkId, {
      productId: Number(productId),
      combinationId: combinationId || null,
      quantity,
      unitType,
      priceAtAdd: price,
      titleAtAdd: product.title,
      imageAtAdd: image,
      variantLabel: req.body.variantLabel || null,
      optionsAtAdd: null,
      minQty: effectiveMinQty,
      maxQty: itemStock !== null && itemStock > 0 ? itemStock : null,
    });

    const cart = await cartService.getCartWithItems(clerkId);
    res.json({ item, cart });
  } catch (err: any) {
    console.error("Add cart item error:", err);
    res.status(500).json({ error: err.message || "Failed to add item" });
  }
});

/**
 * PATCH /api/cart/items/:id
 * Update cart item quantity
 * 
 * Body: { quantity: number }
 */
router.patch("/items/:id", jwtAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkId = req.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const itemId = Number(req.params.id);
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: "Invalid quantity" });
    }

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.clerkId !== clerkId) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let selectedCombination: MinQtyCombination | null = null;
    if (item.combinationId && product.combinations) {
      const combinations = product.combinations as any[];
      const combo = combinations.find((c: any) => c.id === item.combinationId);
      if (combo) {
        selectedCombination = {
          id: combo.id,
          minOrderQtyRetail: combo.minOrderQtyRetail ?? null,
          minOrderQtyWholesale: combo.minOrderQtyWholesale ?? null,
          stock: combo.stock ?? null,
        };
      }
    }

    const productMinQty: MinQtyProduct = {
      saleType: product.saleType || "piece",
      minOrderQtyRetail: product.minOrderQtyRetail ?? 1,
      minOrderQtyWholesale: product.minOrderQtyWholesale ?? 1,
    };

    const purchaseMode: PurchaseMode = item.unitType === "quantity" ? "quantity" : "piece";
    const effectiveMinQty = getEffectiveMinQty(productMinQty, selectedCombination, purchaseMode);
    const itemStock = selectedCombination?.stock ?? (typeof product.availableQuantity === "number" ? product.availableQuantity : null);

    const qtyValidation = validateCartQuantity(quantity, effectiveMinQty, itemStock);
    if (!qtyValidation.valid) {
      return res.status(400).json({
        error: qtyValidation.message,
        suggestedQty: qtyValidation.suggestedQty,
        minQty: effectiveMinQty,
      });
    }

    const stockCheck = await cartService.validateCartItemStock(
      item.productId,
      item.combinationId,
      quantity
    );

    if (!stockCheck.valid) {
      return res.status(400).json({
        error: stockCheck.message,
        available: stockCheck.available,
      });
    }

    const updatedItem = await cartService.updateCartItemQuantity(itemId, quantity);

    const cart = await cartService.getCartWithItems(clerkId);
    res.json({ item: updatedItem, cart });
  } catch (err: any) {
    console.error("Update cart item error:", err);
    res.status(500).json({ error: err.message || "Failed to update item" });
  }
});

/**
 * DELETE /api/cart/items/:id
 * Remove item from cart
 */
router.delete("/items/:id", jwtAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkId = req.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const itemId = Number(req.params.id);

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.clerkId !== clerkId) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    await cartService.removeCartItem(itemId);

    const cart = await cartService.getCartWithItems(clerkId);
    res.json({ success: true, cart });
  } catch (err: any) {
    console.error("Remove cart item error:", err);
    res.status(500).json({ error: err.message || "Failed to remove item" });
  }
});

/**
 * DELETE /api/cart/clear
 * Clear all items from cart
 */
router.delete("/clear", jwtAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clerkId = req.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await cartService.clearCart(clerkId);

    res.json({ success: true, cart: { items: [] } });
  } catch (err: any) {
    console.error("Clear cart error:", err);
    res.status(500).json({ error: err.message || "Failed to clear cart" });
  }
});

export default router;
