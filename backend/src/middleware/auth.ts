import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { PrismaClient, Role, User } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: User;
}

/**
 * Authentication middleware.
 * Verifies JWT token and loads user from database.
 * Returns 401 if no token, invalid token, or user not found.
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Only accept authentication via JWT token (cookie or Authorization header)
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = verifyToken(token);
    const userId = Number(payload.sub);

    if (Number.isNaN(userId)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

/**
 * Role-based authorization middleware factory.
 * Returns 401 if user not authenticated, 403 if user doesn't have required role.
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

/**
 * Admin-only authorization middleware.
 * Returns 401 if not authenticated, 403 if not admin.
 */
export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  return requireRole(Role.ADMIN)(req, res, next);
}
