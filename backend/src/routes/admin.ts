// server/src/routes/admin.ts
import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return value[0] ?? "";
  if (value === undefined || value === null) return "";
  return String(value);
}

/**
 * Dashboard route
 * Returns stats + recent orders
 */
router.get("/dashboard", async (req, res) => {
  try {
    const totalOrders = await prisma.order.count();
    const revenueAgg = await prisma.order.aggregate({ _sum: { total: true } });
    const totalRevenue = revenueAgg._sum?.total ?? 0;

    const totalClients = await prisma.client.count();
    const totalProducts = await prisma.product.count();

    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        client: true,
        items: {
          include: { product: true },
        },
      },
    });

    res.json({
      totalOrders,
      totalRevenue,
      totalClients,
      totalProducts,
      recentOrders,
    });
  } catch (err) {
    console.error("GET /admin/dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard stats" });
  }
});

/**
 * Existing routes
 */
router.get("/stats", async (req, res) => {
  const totalOrders = await prisma.order.count();
  const revenueAgg = await prisma.order.aggregate({ _sum: { total: true } });
  const totalRevenue = revenueAgg._sum?.total ?? 0;
  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { items: true },
  });

  res.json({ totalOrders, totalRevenue, recentOrders });
});

router.get("/clients", async (req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { id: "desc" } });
  res.json(clients);
});

router.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: "desc" } });
  res.json(products);
});

router.get("/search", async (req, res) => {
  const raw = firstQueryValue(req.query.q);
  const term = raw.trim();

  if (!term) {
    return res.json({
      products: [],
      orders: [],
      clients: [],
      employees: [],
    });
  }

  const contains = { contains: term, mode: "insensitive" as const };
  const numericId = Number(term.replace(/\D/g, ""));
  const shouldMatchId = Number.isFinite(numericId) && term.replace(/\D/g, "").length > 0;
  const upperTerm = term.toUpperCase();
  const roleFilter = Object.values(Role).includes(upperTerm as Role)
    ? (upperTerm as Role)
    : undefined;

  try {
    const [products, orders, clients, employees] = await Promise.all([
      prisma.product.findMany({
        where: {
          OR: [
            { title: contains },
            { category: contains },
            { subCategory: contains },
            { description: contains },
            { productId: contains },
            { tags: { has: term } },
          ],
        },
        select: {
          id: true,
          title: true,
          category: true,
          subCategory: true,
          productId: true,
          images: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.order.findMany({
        where: {
          OR: [
            shouldMatchId ? { id: numericId } : undefined,
            { name: contains },
            { email: contains },
            { phone: contains },
            { address: contains },
            {
              items: {
                some: {
                  product: { title: contains },
                },
              },
            },
          ].filter(Boolean) as any,
        },
        select: {
          id: true,
          status: true,
          total: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.client.findMany({
        where: {
          OR: [
            { name: contains },
            { email: contains },
            { phone: contains },
            { clerkId: contains },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.employee.findMany({
        where: {
          OR: [
            { fullName: contains },
            { email: contains },
            { phone: contains },
            roleFilter
              ? {
                  role: {
                    equals: roleFilter,
                  },
                }
              : undefined,
          ].filter(Boolean) as any,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    res.json({ products, orders, clients, employees });
  } catch (err) {
    console.error("GET /admin/search error:", err);
    res.status(500).json({ error: "Failed to search" });
  }
});

export default router;
