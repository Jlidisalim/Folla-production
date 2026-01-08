/**
 * Custom JWT Authentication Middleware
 * 
 * This middleware handles Clerk JWT tokens sent as Bearer tokens in
 * cross-origin requests where session cookies don't work.
 * 
 * It uses Clerk's getAuth() for session-based auth, and falls back to
 * manually verifying JWT tokens for cross-origin Bearer token auth.
 */
import { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import * as jose from "jose";

export interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
}

// Get the JWKS URL from Clerk publishable key
function getJwksUrl(): string {
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
    // Extract the instance ID from the publishable key (format: pk_test_XXX or pk_live_XXX)
    const match = publishableKey.match(/pk_(?:test|live)_([a-zA-Z0-9]+)/);
    if (match) {
        // Decode the base64 part to get the clerk domain
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        return `https://${decoded}/.well-known/jwks.json`;
    }
    // Fallback to environment variable
    return process.env.CLERK_JWKS_URL || "";
}

// Cache JWKS for performance
let jwksCache: jose.JWTVerifyGetKey | null = null;

async function getJwks(): Promise<jose.JWTVerifyGetKey> {
    if (!jwksCache) {
        const jwksUrl = getJwksUrl();
        if (!jwksUrl) {
            throw new Error("CLERK_JWKS_URL not configured");
        }
        const JWKS = jose.createRemoteJWKSet(new URL(jwksUrl));
        jwksCache = JWKS;
    }
    return jwksCache;
}

/**
 * Middleware that extracts user ID from either:
 * 1. Clerk's session cookies (via getAuth)
 * 2. Bearer JWT token in Authorization header
 */
export async function jwtAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        // First, try Clerk's built-in getAuth (works with session cookies)
        const auth = getAuth(req);
        if (auth?.userId) {
            req.userId = auth.userId;
            return next();
        }

        // Fallback: Try to verify Bearer token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required"
            });
        }

        const token = authHeader.substring(7);

        try {
            // Verify the JWT token
            const JWKS = await getJwks();
            const { payload } = await jose.jwtVerify(token, JWKS);

            // Extract user ID from the token
            const userId = payload.sub;
            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorized",
                    message: "Invalid token: no subject"
                });
            }

            req.userId = userId;
            return next();
        } catch (jwtError: any) {
            console.error("[jwtAuth] JWT verification failed:", jwtError.message);
            return res.status(401).json({
                error: "Unauthorized",
                message: "Invalid or expired token"
            });
        }
    } catch (err: any) {
        console.error("[jwtAuth] Error:", err.message);
        return res.status(500).json({
            error: "Internal Server Error",
            message: "Authentication failed"
        });
    }
}

/**
 * Optional JWT auth - doesn't fail if no token provided.
 */
export async function optionalJwtAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        // First, try Clerk's built-in getAuth
        const auth = getAuth(req);
        if (auth?.userId) {
            req.userId = auth.userId;
            return next();
        }

        // Try Bearer token
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            try {
                const JWKS = await getJwks();
                const { payload } = await jose.jwtVerify(token, JWKS);
                if (payload.sub) {
                    req.userId = payload.sub;
                }
            } catch {
                // Token invalid but optional, continue without user
            }
        }

        return next();
    } catch (err) {
        // Error but optional, continue
        return next();
    }
}
