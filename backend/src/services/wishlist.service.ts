import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AddWishlistItemData {
    productId: number;
    priceAtAdd: number;
    titleAtAdd: string;
    imageAtAdd?: string | null;
}

/**
 * Get or create a wishlist for the given Clerk user ID
 */
export async function getOrCreateWishlist(clerkId: string) {
    let wishlist = await prisma.wishlist.findUnique({
        where: { clerkId },
        include: { items: true },
    });

    if (!wishlist) {
        wishlist = await prisma.wishlist.create({
            data: { clerkId },
            include: { items: true },
        });
    }

    return wishlist;
}

/**
 * Get wishlist with all items for a user
 */
export async function getWishlistWithItems(clerkId: string) {
    return prisma.wishlist.findUnique({
        where: { clerkId },
        include: {
            items: {
                orderBy: { createdAt: "desc" },
            },
        },
    });
}

/**
 * Add item to wishlist (if not already present)
 */
export async function addWishlistItem(
    clerkId: string,
    itemData: AddWishlistItemData
) {
    const wishlist = await getOrCreateWishlist(clerkId);

    // Check if item already exists
    const existingItem = await prisma.wishlistItem.findUnique({
        where: {
            wishlistId_productId: {
                wishlistId: wishlist.id,
                productId: itemData.productId,
            },
        },
    });

    if (existingItem) {
        // Update existing item with latest data
        return prisma.wishlistItem.update({
            where: { id: existingItem.id },
            data: {
                priceAtAdd: itemData.priceAtAdd,
                titleAtAdd: itemData.titleAtAdd,
                imageAtAdd: itemData.imageAtAdd,
            },
        });
    }

    // Create new item
    return prisma.wishlistItem.create({
        data: {
            wishlistId: wishlist.id,
            productId: itemData.productId,
            priceAtAdd: itemData.priceAtAdd,
            titleAtAdd: itemData.titleAtAdd,
            imageAtAdd: itemData.imageAtAdd,
        },
    });
}

/**
 * Remove a specific wishlist item by ID
 */
export async function removeWishlistItem(wishlistItemId: number) {
    return prisma.wishlistItem.delete({
        where: { id: wishlistItemId },
    });
}

/**
 * Remove wishlist item by productId for a user
 */
export async function removeWishlistItemByProduct(
    clerkId: string,
    productId: number
) {
    const wishlist = await prisma.wishlist.findUnique({
        where: { clerkId },
    });

    if (!wishlist) return null;

    return prisma.wishlistItem.deleteMany({
        where: {
            wishlistId: wishlist.id,
            productId: productId,
        },
    });
}

/**
 * Clear all items from user's wishlist
 */
export async function clearWishlist(clerkId: string) {
    const wishlist = await prisma.wishlist.findUnique({
        where: { clerkId },
    });

    if (!wishlist) return;

    await prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id },
    });
}

/**
 * Check if product is in user's wishlist
 */
export async function isInWishlist(clerkId: string, productId: number) {
    const wishlist = await prisma.wishlist.findUnique({
        where: { clerkId },
        include: {
            items: {
                where: { productId },
            },
        },
    });

    return wishlist?.items && wishlist.items.length > 0;
}
