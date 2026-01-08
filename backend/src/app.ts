/**
 * Legacy app.ts file
 * 
 * NOTE: This file exists for backward compatibility.
 * The main server configuration is in index.ts.
 * 
 * If this file is being imported, it should now use Clerk auth.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import productsRoutes from "./routes/products";
import ordersRoutes from "./routes/orders";
import adminRoutes from "./routes/admin";
import notificationsRoutes from "./routes/notifications";
import visitorRoutes from "./routes/visitors";
import salesRoutes from "./routes/sales";
import employeesRoutes from "./routes/employees";
import visitorTracker from "./middleware/visitorTracker";
import calendarRoutes from "./routes/calendar";
import { clerkAuth } from "./middleware/clerkAuth";
import { requireAdmin } from "./middleware/requireAdmin";

const app = express();

const origins = (
  process.env.CORS_ORIGINS || "http://localhost:8080,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Clerk middleware - REQUIRED for getAuth() to work
app.use(clerkMiddleware());

app.use(visitorTracker);

app.use("/products", productsRoutes);
app.use("/orders", ordersRoutes);
app.use("/admin", clerkAuth, requireAdmin, adminRoutes);
app.use("/notifications", clerkAuth, requireAdmin, notificationsRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/sales", clerkAuth, requireAdmin, salesRoutes);
app.use("/sales", clerkAuth, requireAdmin, salesRoutes);
app.use("/api/employees", employeesRoutes); // Auth handled within routes
app.use("/api/calendar", calendarRoutes); // Auth handled within routes

app.get("/orders/notifications", clerkAuth, requireAdmin, async (_req, res) => {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const notifs = await prisma.notification.findMany({
      include: { order: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(notifs);
  } catch (err) {
    console.error("Fallback /orders/notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

export default app;
