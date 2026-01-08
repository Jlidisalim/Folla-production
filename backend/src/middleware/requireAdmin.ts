/**
 * Admin Authorization Middleware
 * 
 * Requires clerkAuth to have run first (req.clerkUserId must be set).
 * Looks up user in database by Clerk userId or email.
 * Allows: ADMIN, PRODUCT_MANAGER, ORDER_MANAGER
 */
import { Response, NextFunction } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { ClerkAuthRequest } from "./clerkAuth";
import { clerkClient } from "@clerk/express";

const prisma = new PrismaClient();

// Roles that are considered "admin" (can access admin routes)
const ADMIN_ROLES: Role[] = [Role.ADMIN, Role.PRODUCT_MANAGER, Role.ORDER_MANAGER];

export interface AdminAuthRequest extends ClerkAuthRequest {
  dbUser?: {
    id: number;
    email: string | null;
    role: Role;
    name: string | null;
  };
}

/**
 * Requires the user to have an admin role (ADMIN, PRODUCT_MANAGER, or ORDER_MANAGER).
 * Must be used AFTER clerkAuth middleware.
 * 
 * Looks up the user in the Employee table by their Clerk email address.
 * If found, active, and role is admin-level, attaches dbUser to request and continues.
 * Otherwise returns 403 Forbidden.
 */
export async function requireAdmin(
  req: AdminAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.clerkUserId) {
      return res.status(401).json({ 
        error: "Unauthorized", 
        message: "Authentication required" 
      });
    }

    // Get the Clerk user to find their email
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.getUser(req.clerkUserId);
    } catch (clerkErr: any) {
      console.error("[requireAdmin] Clerk user lookup failed:", clerkErr.message);
      return res.status(401).json({ 
        error: "Unauthorized", 
        message: "User not found" 
      });
    }
    
    if (!clerkUser) {
      return res.status(401).json({ 
        error: "Unauthorized", 
        message: "User not found in Clerk" 
      });
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    
    if (!email) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "No email associated with account" 
      });
    }

    // Look up user in Employee table by email (instead of User table)
    const dbEmployee = await prisma.employee.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, fullName: true, isActive: true },
    });

    if (!dbEmployee) {
      // User exists in Clerk but not in our Employee table
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "Access denied - not registered as employee" 
      });
    }

    // Check if employee is active
    if (!dbEmployee.isActive) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "Account is deactivated" 
      });
    }

    if (!ADMIN_ROLES.includes(dbEmployee.role)) {
      return res.status(403).json({ 
        error: "Forbidden", 
        message: "Access denied - insufficient permissions" 
      });
    }

    // Attach database user info for downstream use (mapped to expected interface)
    req.dbUser = {
      id: dbEmployee.id,
      email: dbEmployee.email,
      role: dbEmployee.role,
      name: dbEmployee.fullName,
    };
    
    return next();
  } catch (err: any) {
    console.error("[requireAdmin] Error:", err.message);
    return res.status(500).json({ 
      error: "Internal Server Error", 
      message: "Failed to verify permissions" 
    });
  }
}

/**
 * Requires specific roles (more flexible version).
 * Must be used AFTER clerkAuth middleware.
 * Looks up the user in the Employee table by email.
 */
export function requireRole(...allowedRoles: Role[]) {
  return async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.clerkUserId) {
        return res.status(401).json({ 
          error: "Unauthorized", 
          message: "Authentication required" 
        });
      }

      let clerkUser;
      try {
        clerkUser = await clerkClient.users.getUser(req.clerkUserId);
      } catch (clerkErr: any) {
        console.error("[requireRole] Clerk user lookup failed:", clerkErr.message);
        return res.status(401).json({ 
          error: "Unauthorized", 
          message: "User not found" 
        });
      }

      const email = clerkUser?.emailAddresses?.[0]?.emailAddress;
      
      if (!email) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "No email associated with account" 
        });
      }

      // Look up user in Employee table by email
      const dbEmployee = await prisma.employee.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, fullName: true, isActive: true },
      });

      if (!dbEmployee) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "User not found in employee database" 
        });
      }

      // Check if employee is active
      if (!dbEmployee.isActive) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: "Account is deactivated" 
        });
      }

      if (!allowedRoles.includes(dbEmployee.role)) {
        return res.status(403).json({ 
          error: "Forbidden", 
          message: `Required roles: ${allowedRoles.join(", ")}` 
        });
      }

      // Attach database user info for downstream use (mapped to expected interface)
      req.dbUser = {
        id: dbEmployee.id,
        email: dbEmployee.email,
        role: dbEmployee.role,
        name: dbEmployee.fullName,
      };
      return next();
    } catch (err: any) {
      console.error("[requireRole] Error:", err.message);
      return res.status(500).json({ 
        error: "Internal Server Error", 
        message: "Failed to verify permissions" 
      });
    }
  };
}
