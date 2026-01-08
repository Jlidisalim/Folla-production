// server/src/routes/dashboard.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

const TZ_REGEX = /^[A-Za-z0-9_/+\-]+$/;
function sanitizeTimezone(tz?: string | null) {
  if (!tz) return null;
  const trimmed = tz.trim();
  if (!trimmed) return null;
  return TZ_REGEX.test(trimmed) ? trimmed : null;
}

const cancellationTimezone =
  sanitizeTimezone(process.env.CANCELLATION_TZ) ||
  sanitizeTimezone(process.env.VISITOR_TZ) ||
  sanitizeTimezone(process.env.TZ) ||
  sanitizeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) ||
  "UTC";

const cancellationDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: cancellationTimezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatCancellationDay(date: Date) {
  return cancellationDayFormatter.format(date);
}

const CANCELLED_CHART_DAYS = (() => {
  const raw = Number(process.env.CANCELLED_CHART_DAYS);
  if (Number.isFinite(raw)) {
    return Math.max(7, Math.min(60, Math.trunc(raw)));
  }
  return 30;
})();
const CANCELLED_CHART_SERIES_LIMIT = 4;

/**
 * Dashboard Summary Endpoint
 * - Product return count = orders with status "returned" OR "cancelled"
 * - Excludes cancelled from revenue, growth, and top-selling
 * - Top products include pricePiece and priceQuantity and compute total amount from orderItems
 */
router.get("/", async (req, res) => {
  try {
    const now = new Date();

    const SALES_STATUSES = ["completed", "delivered"];
    const CANCELLED_STATUSES = ["cancelled", "canceled"];
    const RETURN_STATUSES = ["returned", ...CANCELLED_STATUSES]; // count both for returns
    const EXCLUDE_STATUSES = CANCELLED_STATUSES; // exclude cancelled from revenue/growth/top-selling (but still counted in returns)

    // Total Orders (exclude cancelled)
    const totalOrders = await prisma.order.count({
      where: { status: { notIn: EXCLUDE_STATUSES } },
    });

    // Unique Customers (by order email, exclude cancelled)
    const uniqueCustomerEmails = await prisma.order.findMany({
      where: {
        email: { not: null },
        status: { notIn: EXCLUDE_STATUSES },
      },
      distinct: ["email"],
      select: { email: true },
    });
    const totalCustomers = uniqueCustomerEmails.length;

    // Total Products in catalog
    const totalProducts = await prisma.product.count();

    // Total Revenue (completed/delivered)
    const revenueAgg = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: SALES_STATUSES } },
    });
    const totalRevenue = revenueAgg._sum.total ?? 0;

    // Product Returns (returned + cancelled)
    const productReturns = await prisma.order.count({
      where: { status: { in: RETURN_STATUSES } },
    });

    // Time windows
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 14);

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(now.getMonth() - 2);

    // Weekly Growth (only count SALES_STATUSES)
    const thisWeekRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: SALES_STATUSES }, createdAt: { gte: oneWeekAgo } },
    });
    const lastWeekRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { in: SALES_STATUSES },
        createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
      },
    });
    const weeklyGrowth =
      (lastWeekRevenue._sum.total ?? 0) > 0
        ? ((thisWeekRevenue._sum.total ?? 0) -
            (lastWeekRevenue._sum.total ?? 0)) /
          (lastWeekRevenue._sum.total ?? 1)
        : 0;

    // Monthly Growth
    const thisMonthRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { in: SALES_STATUSES },
        createdAt: { gte: oneMonthAgo },
      },
    });
    const lastMonthRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: {
        status: { in: SALES_STATUSES },
        createdAt: { gte: twoMonthsAgo, lt: oneMonthAgo },
      },
    });
    const monthlyGrowth =
      (lastMonthRevenue._sum.total ?? 0) > 0
        ? ((thisMonthRevenue._sum.total ?? 0) -
            (lastMonthRevenue._sum.total ?? 0)) /
          (lastMonthRevenue._sum.total ?? 1)
        : 0;

    // Revenue by Month (last 12 months) using only SALES_STATUSES
    const salesOrders = await prisma.order.findMany({
      where: { status: { in: SALES_STATUSES } },
      select: { createdAt: true, total: true },
    });

    const revenueByMonth: Record<string, number> = {};
    for (const order of salesOrders) {
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      revenueByMonth[key] = (revenueByMonth[key] || 0) + (order.total ?? 0);
    }

    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      return { month: key, total: revenueByMonth[key] ?? 0 };
    });

    // Top Selling Products by quantity (only count orders in SALES_STATUSES)
    const topSales = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      where: { order: { status: { in: SALES_STATUSES } } },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });

    // Build topProducts array with both pricePiece and priceQuantity + computed amount
    const topProducts = await Promise.all(
      topSales.map(async (s) => {
        const product = await prisma.product.findUnique({
          where: { id: s.productId },
          select: {
            id: true,
            title: true,
            images: true,
            category: true,
            pricePiece: true,
            priceQuantity: true,
          },
        });

        // compute total amount for this product across orderItems with SALES_STATUSES
        const items = await prisma.orderItem.findMany({
          where: {
            productId: s.productId,
            order: { status: { in: SALES_STATUSES } },
          },
          select: { price: true, quantity: true },
        });

        const amount = items.reduce(
          (acc, it) => acc + Number(it.price ?? 0) * Number(it.quantity ?? 0),
          0
        );

        return {
          id: product?.id ?? s.productId,
          title: product?.title ?? "Unknown Product",
          image: product?.images?.[0] ?? null,
          category: product?.category ?? "Unknown",
          pricePiece: product?.pricePiece ?? null,
          priceQuantity: product?.priceQuantity ?? null,
          quantitySold: s._sum.quantity ?? 0,
          amount,
        };
      })
    );

    // Sales by Region (only orders with a region value and completed/delivered)
    const regionOrders = await prisma.order.findMany({
      where: {
        status: { in: SALES_STATUSES },
        region: { not: null },
      },
      select: {
        region: true,
        total: true,
        items: {
          select: {
            quantity: true,
          },
        },
      },
    });

    const regionMap: Record<string, { sales: number; productsSold: number }> =
      {};

    for (const order of regionOrders) {
      const key = (order.region || "Unknown").trim() || "Unknown";
      if (!regionMap[key]) {
        regionMap[key] = { sales: 0, productsSold: 0 };
      }
      regionMap[key].sales += Number(order.total ?? 0);
      const qty = order.items.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0
      );
      regionMap[key].productsSold += qty;
    }

    const salesByRegion = Object.entries(regionMap)
      .map(([region, stats]) => ({
        region,
        sales: stats.sales,
        productsSold: stats.productsSold,
      }))
      .sort((a, b) => b.sales - a.sales);

    // Cancelled products chart (top products by cancelled quantity over recent days)
    const cancellationWindowStart = new Date(now);
    cancellationWindowStart.setDate(now.getDate() - (CANCELLED_CHART_DAYS - 1));

    const cancelledItems = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: CANCELLED_STATUSES },
          updatedAt: { gte: cancellationWindowStart },
        },
      },
      select: {
        productId: true,
        quantity: true,
        product: {
          select: {
            id: true,
            title: true,
            images: true,
          },
        },
        order: {
          select: {
            updatedAt: true,
            createdAt: true,
          },
        },
      },
    });

    type CancellationAggregate = {
      productId: number;
      title: string;
      image: string | null;
      days: Record<string, number>;
      total: number;
    };

    const cancellationMap = new Map<number, CancellationAggregate>();

    for (const item of cancelledItems) {
      const productId = item.productId;
      const entry =
        cancellationMap.get(productId) ??
        {
          productId,
          title: item.product?.title ?? `Product #${productId}`,
          image: item.product?.images?.[0] ?? null,
          days: {},
          total: 0,
        };

      const orderDate =
        item.order?.updatedAt ?? item.order?.createdAt ?? new Date();
      const dayKey = formatCancellationDay(orderDate);
      const qty = 1; // count each cancelled order once regardless of quantity

      entry.days[dayKey] = (entry.days[dayKey] ?? 0) + qty;
      entry.total += qty;
      cancellationMap.set(productId, entry);
    }

    const cancellationDayKeys: string[] = [];
    for (let i = CANCELLED_CHART_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      cancellationDayKeys.push(formatCancellationDay(d));
    }

    const cancelledSeries = Array.from(cancellationMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, CANCELLED_CHART_SERIES_LIMIT)
      .map((aggregate) => ({
        productId: aggregate.productId,
        title: aggregate.title,
        image: aggregate.image,
        data: cancellationDayKeys.map((day) => aggregate.days[day] ?? 0),
      }));

    const cancelledProductsChart = {
      days: cancellationDayKeys,
      series: cancelledSeries,
    };

    // Send Dashboard Response
    res.json({
      totalOrders,
      totalClients: totalCustomers,
      totalProducts,
      totalRevenue,
      productReturns, // counts returned + cancelled orders
      growth: { weekly: weeklyGrowth, monthly: monthlyGrowth },
      revenueByMonth: last12Months,
      topProducts,
      salesByRegion,
      cancelledProductsChart,
    });
  } catch (err) {
    console.error("❌ Error loading dashboard:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
