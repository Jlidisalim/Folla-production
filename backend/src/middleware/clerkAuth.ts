/**
 * Clerk Authentication Middleware
 * 
 * Uses the official @clerk/express pattern with getAuth().
 * Requires clerkMiddleware() to be applied at app level first.
 */
import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

export interface ClerkAuthRequest extends Request {
  clerkUserId?: string;
}

/**
 * Clerk authentication middleware.
 * Uses getAuth(req) to check if user is authenticated.
 * Returns 401 if no userId (not signed in).
 * 
 * IMPORTANT: Requires clerkMiddleware() to be applied at app level before this.
 */
export async function clerkAuth(
  req: ClerkAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required"
      });
    }

    // Attach userId for downstream middleware
    req.clerkUserId = auth.userId;

    return next();
  } catch (err: any) {
    console.error("[clerkAuth] Error:", err.message);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication failed"
    });
  }
}

/**
 * Optional Clerk auth - doesn't fail if no token provided.
 * Useful for routes where auth is optional but affects response.
 */
export async function optionalClerkAuth(
  req: ClerkAuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = getAuth(req);

    if (auth?.userId) {
      req.clerkUserId = auth.userId;
    }

    return next();
  } catch (err) {
    // Token invalid but optional, continue
    return next();
  }
}
