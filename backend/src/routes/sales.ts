import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const SALES_STATUSES = ["completed", "delivered"];

router.get("/overview", async (_req, res) => {
  try {
    const [ordersCount, revenueAggregate, salesOrders] = await Promise.all([
      prisma.order.count({
        where: { status: { in: SALES_STATUSES } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { in: SALES_STATUSES } },
      }),
      prisma.order.findMany({
        where: { status: { in: SALES_STATUSES } },
        select: { createdAt: true, total: true },
      }),
    ]);

    const totalRevenue = revenueAggregate._sum.total ?? 0;

    const revenueByMonth: Record<string, number> = {};
    for (const order of salesOrders) {
      const dt = new Date(order.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(order.total);
    }

    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      return {
        month: key,
        total: Number(revenueByMonth[key] ?? 0),
      };
    });

    res.json({
      totalRevenue,
      totalOrders: ordersCount,
      monthlyRevenue: last12Months,
    });
  } catch (err) {
    console.error("Error building sales overview:", err);
    res.status(500).json({ error: "Failed to build sales overview" });
  }
});

router.get("/regions", async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: SALES_STATUSES }, region: { not: null } },
      select: {
        region: true,
        total: true,
        items: { select: { quantity: true } },
      },
    });

    const regionMap: Record<
      string,
      { sales: number; productsSold: number }
    > = {};

    for (const order of orders) {
      const regionName = (order.region || "Unknown").trim() || "Unknown";
      if (!regionMap[regionName]) {
        regionMap[regionName] = { sales: 0, productsSold: 0 };
      }
      regionMap[regionName].sales += Number(order.total ?? 0);
      const qty = order.items.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0
      );
      regionMap[regionName].productsSold += qty;
    }

    const data = Object.entries(regionMap)
      .map(([region, stats]) => ({
        region,
        sales: stats.sales,
        productsSold: stats.productsSold,
      }))
      .sort((a, b) => b.sales - a.sales);

    res.json(data);
  } catch (err) {
    console.error("Error building region sales:", err);
    res.status(500).json({ error: "Failed to load region stats" });
  }
});

export default router;
