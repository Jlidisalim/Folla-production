import { NextFunction, Request, Response } from "express";
import { incrementVisitorCounter } from "../lib/visitorService";

const COOKIE_NAME = "folla_visitor_tracked";
const DEFAULT_TTL = 1000 * 60 * 60 * 6; // 6 hours

export default async function visitorTracker(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { method, path } = req;
  const isRootPageRequest =
    method === "GET" && (path === "/" || path === "/index.html");
  const requestedManualTracking = req.headers["x-track-visitor"] === "1";
  const shouldSkip =
    req.path.startsWith("/api/visitors") || req.path.startsWith("/products");

  if (shouldSkip) {
    return next();
  }

  try {
    const ttl =
      Number(process.env.VISITOR_TRACK_TTL_MS) > 0
        ? Number(process.env.VISITOR_TRACK_TTL_MS)
        : DEFAULT_TTL;
    const alreadyTracked = req.cookies?.[COOKIE_NAME] === "1";

    if ((isRootPageRequest || requestedManualTracking) && !alreadyTracked) {
      await incrementVisitorCounter();
      res.cookie(COOKIE_NAME, "1", {
        maxAge: ttl,
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
  } catch (err) {
    console.error("Visitor tracker middleware error:", err);
  } finally {
    next();
  }
}
