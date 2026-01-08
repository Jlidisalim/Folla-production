/**
 * Shop Settings API Routes
 *
 * GET  /api/settings        - Public: returns shop settings
 * PUT  /api/admin/settings  - Admin only: update settings
 * 
 * Store Locations:
 * GET  /api/settings/store-locations       - Public: get active store locations
 * GET  /api/settings/admin/store-locations - Admin: get all store locations
 * POST /api/settings/admin/store-locations - Admin: create store location
 * PUT  /api/settings/admin/store-locations/:id - Admin: update store location
 * DELETE /api/settings/admin/store-locations/:id - Admin: delete store location
 */
import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { clerkAuth, ClerkAuthRequest } from "../middleware/clerkAuth";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();
const prisma = new PrismaClient();

// Default settings values
const DEFAULT_FREE_SHIPPING_THRESHOLD = 200;
const DEFAULT_SHIPPING_FEE = 8;

/**
 * Helper: Get or create settings (singleton pattern)
 */
async function getOrCreateSettings() {
    let settings = await prisma.shopSettings.findUnique({
        where: { id: 1 },
    });

    if (!settings) {
        settings = await prisma.shopSettings.create({
            data: {
                id: 1,
                freeShippingThresholdDt: DEFAULT_FREE_SHIPPING_THRESHOLD,
                defaultShippingFeeDt: DEFAULT_SHIPPING_FEE,
            },
        });
    }

    return settings;
}

/**
 * GET /api/settings
 * Public endpoint - returns shop settings for frontend
 */
router.get("/", async (_req: Request, res: Response) => {
    try {
        const settings = await getOrCreateSettings();

        res.json({
            freeShippingThresholdDt: settings.freeShippingThresholdDt,
            defaultShippingFeeDt: settings.defaultShippingFeeDt,
            updatedAt: settings.updatedAt,
        });
    } catch (err: any) {
        console.error("[Settings] GET error:", err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

/**
 * PUT /api/admin/settings
 * Admin-only endpoint - update shop settings
 */
router.put(
    "/admin",
    clerkAuth,
    requireAdmin,
    async (req: ClerkAuthRequest, res: Response) => {
        try {
            const { freeShippingThresholdDt, defaultShippingFeeDt } = req.body;

            // Validate inputs
            const threshold = parseFloat(freeShippingThresholdDt);
            const shippingFee = parseFloat(defaultShippingFeeDt);

            if (isNaN(threshold) || threshold < 0) {
                return res.status(400).json({
                    error: "freeShippingThresholdDt must be a non-negative number",
                });
            }

            if (isNaN(shippingFee) || shippingFee < 0) {
                return res.status(400).json({
                    error: "defaultShippingFeeDt must be a non-negative number",
                });
            }

            // Upsert settings (create if doesn't exist, update if exists)
            const settings = await prisma.shopSettings.upsert({
                where: { id: 1 },
                create: {
                    id: 1,
                    freeShippingThresholdDt: threshold,
                    defaultShippingFeeDt: shippingFee,
                },
                update: {
                    freeShippingThresholdDt: threshold,
                    defaultShippingFeeDt: shippingFee,
                },
            });

            console.log(
                `[Settings] Updated by admin: threshold=${threshold} DT, fee=${shippingFee} DT`
            );

            res.json({
                freeShippingThresholdDt: settings.freeShippingThresholdDt,
                defaultShippingFeeDt: settings.defaultShippingFeeDt,
                updatedAt: settings.updatedAt,
            });
        } catch (err: any) {
            console.error("[Settings] PUT error:", err);
            res.status(500).json({ error: "Failed to update settings" });
        }
    }
);

// ============================================================
// Store Location Routes
// ============================================================

/**
 * GET /api/settings/store-locations
 * Public endpoint - returns active store locations for footer
 */
router.get("/store-locations", async (_req: Request, res: Response) => {
    try {
        const locations = await prisma.storeLocation.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
        });

        res.json(locations);
    } catch (err: any) {
        console.error("[StoreLocations] GET error:", err);
        res.status(500).json({ error: "Failed to fetch store locations" });
    }
});

/**
 * GET /api/settings/admin/store-locations
 * Admin endpoint - returns all store locations (including inactive)
 */
router.get(
    "/admin/store-locations",
    clerkAuth,
    requireAdmin,
    async (_req: ClerkAuthRequest, res: Response) => {
        try {
            const locations = await prisma.storeLocation.findMany({
                orderBy: { sortOrder: "asc" },
            });

            res.json(locations);
        } catch (err: any) {
            console.error("[StoreLocations] Admin GET error:", err);
            res.status(500).json({ error: "Failed to fetch store locations" });
        }
    }
);

/**
 * POST /api/settings/admin/store-locations
 * Admin endpoint - create a new store location
 */
router.post(
    "/admin/store-locations",
    clerkAuth,
    requireAdmin,
    async (req: ClerkAuthRequest, res: Response) => {
        try {
            const { name, address, phone, isActive = true, sortOrder = 0 } = req.body;

            // Validation
            if (!name || typeof name !== "string" || name.trim().length === 0) {
                return res.status(400).json({ error: "Le nom est requis" });
            }
            if (!address || typeof address !== "string" || address.trim().length === 0) {
                return res.status(400).json({ error: "L'adresse est requise" });
            }
            if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
                return res.status(400).json({ error: "Le téléphone est requis" });
            }

            const location = await prisma.storeLocation.create({
                data: {
                    name: name.trim(),
                    address: address.trim(),
                    phone: phone.trim(),
                    isActive: Boolean(isActive),
                    sortOrder: Number(sortOrder) || 0,
                },
            });

            console.log(`[StoreLocations] Created: ${location.name}`);
            res.status(201).json(location);
        } catch (err: any) {
            console.error("[StoreLocations] POST error:", err);
            res.status(500).json({ error: "Failed to create store location" });
        }
    }
);

/**
 * PUT /api/settings/admin/store-locations/:id
 * Admin endpoint - update a store location
 */
router.put(
    "/admin/store-locations/:id",
    clerkAuth,
    requireAdmin,
    async (req: ClerkAuthRequest, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid ID" });
            }

            const { name, address, phone, isActive, sortOrder } = req.body;

            // Build update data
            const updateData: any = {};
            if (name !== undefined) updateData.name = name.trim();
            if (address !== undefined) updateData.address = address.trim();
            if (phone !== undefined) updateData.phone = phone.trim();
            if (isActive !== undefined) updateData.isActive = Boolean(isActive);
            if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder) || 0;

            const location = await prisma.storeLocation.update({
                where: { id },
                data: updateData,
            });

            console.log(`[StoreLocations] Updated: ${location.name}`);
            res.json(location);
        } catch (err: any) {
            if (err.code === "P2025") {
                return res.status(404).json({ error: "Store location not found" });
            }
            console.error("[StoreLocations] PUT error:", err);
            res.status(500).json({ error: "Failed to update store location" });
        }
    }
);

/**
 * DELETE /api/settings/admin/store-locations/:id
 * Admin endpoint - delete a store location
 */
router.delete(
    "/admin/store-locations/:id",
    clerkAuth,
    requireAdmin,
    async (req: ClerkAuthRequest, res: Response) => {
        try {
            const id = parseInt(req.params.id, 10);
            if (isNaN(id)) {
                return res.status(400).json({ error: "Invalid ID" });
            }

            await prisma.storeLocation.delete({
                where: { id },
            });

            console.log(`[StoreLocations] Deleted ID: ${id}`);
            res.json({ success: true });
        } catch (err: any) {
            if (err.code === "P2025") {
                return res.status(404).json({ error: "Store location not found" });
            }
            console.error("[StoreLocations] DELETE error:", err);
            res.status(500).json({ error: "Failed to delete store location" });
        }
    }
);

export default router;

