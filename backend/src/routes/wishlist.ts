import { Router } from "express";
import { jwtAuth, AuthenticatedRequest } from "../middleware/jwtAuth";
import * as wishlistService from "../services/wishlist.service";

const router = Router();

/**
 * GET /api/wishlist
 * Get current user's wishlist with all items
 */
router.get("/", jwtAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const clerkId = req.userId;
        if (!clerkId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const wishlist = await wishlistService.getWishlistWithItems(clerkId);
        res.json({ wishlist: wishlist || { items: [] } });
    } catch (err: any) {
        console.error("Get wishlist error:", err);
        res.status(500).json({ error: err.message || "Failed to get wishlist" });
    }
});

/**
 * POST /api/wishlist/items
 * Add item to wishlist
 * 
 * Body: {
 *   productId: number,
 *   price: number,
 *   title: string,
 *   image?: string
 * }
 */
router.post("/items", jwtAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const clerkId = req.userId;
        if (!clerkId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { productId, price, title, image } = req.body;

        if (!productId || !title) {
            return res.status(400).json({ error: "productId and title are required" });
        }

        const item = await wishlistService.addWishlistItem(clerkId, {
            productId: Number(productId),
            priceAtAdd: price || 0,
            titleAtAdd: title,
            imageAtAdd: image || null,
        });

        // Return updated wishlist
        const wishlist = await wishlistService.getWishlistWithItems(clerkId);
        res.json({ item, wishlist });
    } catch (err: any) {
        console.error("Add wishlist item error:", err);
        res.status(500).json({ error: err.message || "Failed to add item" });
    }
});

/**
 * DELETE /api/wishlist/items/:id
 * Remove item from wishlist by item ID
 */
router.delete("/items/:id", jwtAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const clerkId = req.userId;
        if (!clerkId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const itemId = Number(req.params.id);

        await wishlistService.removeWishlistItem(itemId);

        // Return updated wishlist
        const wishlist = await wishlistService.getWishlistWithItems(clerkId);
        res.json({ success: true, wishlist });
    } catch (err: any) {
        console.error("Remove wishlist item error:", err);
        res.status(500).json({ error: err.message || "Failed to remove item" });
    }
});

/**
 * DELETE /api/wishlist/product/:productId
 * Remove item from wishlist by product ID
 */
router.delete("/product/:productId", jwtAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const clerkId = req.userId;
        if (!clerkId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const productId = Number(req.params.productId);

        await wishlistService.removeWishlistItemByProduct(clerkId, productId);

        // Return updated wishlist
        const wishlist = await wishlistService.getWishlistWithItems(clerkId);
        res.json({ success: true, wishlist });
    } catch (err: any) {
        console.error("Remove wishlist item by product error:", err);
        res.status(500).json({ error: err.message || "Failed to remove item" });
    }
});

/**
 * DELETE /api/wishlist/clear
 * Clear all items from wishlist
 */
router.delete("/clear", jwtAuth, async (req: AuthenticatedRequest, res) => {
    try {
        const clerkId = req.userId;
        if (!clerkId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        await wishlistService.clearWishlist(clerkId);

        res.json({ success: true, wishlist: { items: [] } });
    } catch (err: any) {
        console.error("Clear wishlist error:", err);
        res.status(500).json({ error: err.message || "Failed to clear wishlist" });
    }
});

export default router;
