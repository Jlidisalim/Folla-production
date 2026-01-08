/**
 * Me Routes - Current user information endpoints
 * 
 * Provides authenticated user's info from Employee table
 */
import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { jwtAuth, AuthenticatedRequest } from "../middleware/jwtAuth";
import { clerkClient } from "@clerk/express";

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/me/role
 * Returns the current user's role from the Employee table.
 * Uses JWT token to get user ID, then looks up in Employee table.
 * 
 * Response:
 * - { role: "ADMIN" | "PRODUCT_MANAGER" | "ORDER_MANAGER" | null, isActive: boolean }
 * - role is null if user is not found in Employee table (normal customer)
 */
router.get("/role", jwtAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required"
            });
        }

        // Get the Clerk user to find their email
        let clerkUser;
        try {
            clerkUser = await clerkClient.users.getUser(userId);
        } catch (clerkErr: any) {
            console.error("[me/role] Clerk user lookup failed:", clerkErr.message);
            return res.status(401).json({
                error: "Unauthorized",
                message: "User not found"
            });
        }

        const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

        if (!email) {
            // No email - treat as customer with no special role
            return res.json({ role: null, isActive: true });
        }

        // Look up user in Employee table by email
        const employee = await prisma.employee.findUnique({
            where: { email },
            select: { id: true, role: true, isActive: true, fullName: true },
        });

        if (!employee) {
            // Not in employee table - regular customer
            return res.json({ role: null, isActive: true });
        }

        // Return role info with employee ID
        return res.json({
            id: employee.id,
            role: employee.role,
            isActive: employee.isActive,
            fullName: employee.fullName,
        });
    } catch (err: any) {
        console.error("[me/role] Error:", err.message);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to get role"
        });
    }
});

export default router;
