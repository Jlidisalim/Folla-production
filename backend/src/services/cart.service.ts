import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AddCartItemData {
  productId: number;
  combinationId?: string | null;
  quantity: number;
  unitType: "piece" | "quantity";
  priceAtAdd: number;
  titleAtAdd: string;
  imageAtAdd?: string | null;
  variantLabel?: string | null;  // Human-readable variant (e.g. "Size: M, Color: Blue")
  optionsAtAdd?: Record<string, any> | null;
  minQty?: number | null;
  maxQty?: number | null;
}

/**
 * Get or create a cart for the given Clerk user ID
 */
export async function getOrCreateCart(clerkId: string) {
  let cart = await prisma.cart.findUnique({
    where: { clerkId },
    include: { items: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { clerkId },
      include: { items: true },
    });
  }

  return cart;
}

/**
 * Get cart with all items for a user
 */
export async function getCartWithItems(clerkId: string) {
  return prisma.cart.findUnique({
    where: { clerkId },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

/**
 * Add or update a cart item
 * If item with same productId + combinationId exists, update quantity
 * Otherwise create new item
 */
export async function addOrUpdateCartItem(
  clerkId: string,
  itemData: AddCartItemData
) {
  const cart = await getOrCreateCart(clerkId);

  // Check if item already exists
  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId: itemData.productId,
      combinationId: itemData.combinationId || null,
      unitType: itemData.unitType,
    },
  });

  if (existingItem) {
    // Update existing item - add to quantity
    return prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: existingItem.quantity + itemData.quantity,
        // Update price snapshot to latest
        priceAtAdd: itemData.priceAtAdd,
        titleAtAdd: itemData.titleAtAdd,
        imageAtAdd: itemData.imageAtAdd,
        variantLabel: itemData.variantLabel || null,
        optionsAtAdd: itemData.optionsAtAdd as any,
        minQty: itemData.minQty,
        maxQty: itemData.maxQty,
        updatedAt: new Date(),
      },
    });
  }

  // Create new item
  return prisma.cartItem.create({
    data: {
      cartId: cart.id,
      productId: itemData.productId,
      combinationId: itemData.combinationId || null,
      quantity: itemData.quantity,
      unitType: itemData.unitType,
      priceAtAdd: itemData.priceAtAdd,
      titleAtAdd: itemData.titleAtAdd,
      imageAtAdd: itemData.imageAtAdd,
      variantLabel: itemData.variantLabel || null,
      optionsAtAdd: itemData.optionsAtAdd as any,
      minQty: itemData.minQty,
      maxQty: itemData.maxQty,
    },
  });
}

/**
 * Update cart item quantity
 */
export async function updateCartItemQuantity(
  cartItemId: number,
  quantity: number
) {
  return prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity, updatedAt: new Date() },
  });
}

/**
 * Remove a specific cart item
 */
export async function removeCartItem(cartItemId: number) {
  return prisma.cartItem.delete({
    where: { id: cartItemId },
  });
}

/**
 * Clear all items from user's cart
 */
export async function clearCart(clerkId: string) {
  const cart = await prisma.cart.findUnique({
    where: { clerkId },
  });

  if (!cart) return;

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });
}

/**
 * Validate stock availability for cart item
 * Returns true if stock is sufficient, false otherwise
 */
export async function validateCartItemStock(
  productId: number,
  combinationId: string | null,
  requestedQuantity: number
): Promise<{ valid: boolean; available?: number; message?: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return { valid: false, message: "Product not found" };
  }

  if (!product.inStock) {
    return { valid: false, message: "Product out of stock" };
  }

  // Check combination stock if applicable
  if (combinationId && product.combinations) {
    const combinations = product.combinations as any[];
    const combo = combinations.find((c: any) => c.id === combinationId);
    
    if (combo && typeof combo.stock === "number") {
      const available = Math.max(0, Math.floor(combo.stock));
      if (requestedQuantity > available) {
        return {
          valid: false,
          available,
          message: `Only ${available} units available`,
        };
      }
    }
  }

  // Check product-level stock
  if (typeof product.availableQuantity === "number") {
    const available = Math.max(0, Math.floor(product.availableQuantity));
    if (requestedQuantity > available) {
      return {
        valid: false,
        available,
        message: `Only ${available} units available`,
      };
    }
  }

  return { valid: true };
}
