/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/admin/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  DownloadCloud,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Users,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/skeletons";

type RevenueMonth = { month: string; total: number };
type TopProduct = {
  id?: number | string;
  title?: string;
  image?: string | null;
  pricePiece?: number | null;
  priceQuantity?: number | null;
  category?: string | null;
  quantitySold?: number;
  amount?: number;
};
type RegionStat = { region?: string; sales?: number; productsSold?: number };
type VisitorStat = { day: string; total: number };
type ChartMode = "sales" | "visitors" | "cancellations";
type CancelledSeries = {
  productId: number | string;
  title: string;
  image?: string | null;
  data: number[];
};
type CancelledChart = { days: string[]; series: CancelledSeries[] };

const COLORS = ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
const CANCELLATION_COLORS = ["#EF4444", "#F97316", "#8B5CF6", "#0EA5E9", "#10B981"];
const DEFAULT_CANCELLATION_WINDOW = 30;

function formatCurrency(value: number) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} DT`;
}

function monthLabel(key: string) {
  if (/^[A-Za-z]{3,}/.test(key)) return key;
  const m = key.match(/^(\d{4})-(\d{1,2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const d = new Date(year, month, 1);
    return d.toLocaleString(undefined, { month: "short" });
  }
  return key;
}

function parseDayKey(day: string) {
  if (!day) return null;
  const parts = day.split("-");
  if (parts.length < 3) return null;
  const [year, month, date] = parts;
  const y = Number(year);
  const m = Number(month) - 1;
  const d = Number(date);
  if (
    Number.isNaN(y) ||
    Number.isNaN(m) ||
    Number.isNaN(d) ||
    m < 0 ||
    m > 11 ||
    d < 1 ||
    d > 31
  ) {
    return null;
  }
  return new Date(y, m, d);
}

function dayLabel(day: string) {
  const date = parseDayKey(day);
  if (!date) return day;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [productReturns, setProductReturns] = useState<number>(0);
  const [growthWeekly, setGrowthWeekly] = useState<number>(0);
  const [growthMonthly, setGrowthMonthly] = useState<number>(0);
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueMonth[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [salesByRegion, setSalesByRegion] = useState<RegionStat[]>([]);
  const [visitorStats, setVisitorStats] = useState<VisitorStat[]>([]);
  const [visitorTotal, setVisitorTotal] = useState<number>(0);
  const [chartMode, setChartMode] = useState<ChartMode>("sales");
  const [cancelledChart, setCancelledChart] = useState<CancelledChart | null>(null);

  // baseURL for making absolute URLs to images
  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        dashRes,
        salesOverviewRes,
        visitorStatsRes,
        visitorTotalRes,
      ] = await Promise.allSettled([
        api.get("/dashboard"),
        api.get("/api/sales/overview"),
        api.get("/api/visitors/stats?days=30"),
        api.get("/api/visitors/total"),
      ]);

      const d: any =
        dashRes.status === "fulfilled" ? dashRes.value?.data ?? {} : {};
      const salesOverview: any =
        salesOverviewRes.status === "fulfilled"
          ? salesOverviewRes.value?.data ?? {}
          : {};
      const visitorStatsPayload =
        visitorStatsRes.status === "fulfilled"
          ? visitorStatsRes.value?.data ?? []
          : [];
      const visitorTotalPayload =
        visitorTotalRes.status === "fulfilled"
          ? visitorTotalRes.value?.data ?? {}
          : {};

      setTotalSales(
        Number(
          d.totalRevenue ??
            d.totalSales ??
            salesOverview.totalRevenue ??
            0
        )
      );
      setTotalOrders(
        Number(d.totalOrders ?? salesOverview.totalOrders ?? 0)
      );
      setCustomerCount(Number(d.totalClients ?? d.customerCount ?? 0));
      setProductReturns(Number(d.productReturns ?? d.returns ?? 0));
      setGrowthWeekly(Number(d.growth?.weekly ?? 0));
      setGrowthMonthly(Number(d.growth?.monthly ?? 0));

      // revenueByMonth normalization
      let rbm: RevenueMonth[] = [];
      const overviewMonths = Array.isArray(salesOverview.monthlyRevenue)
        ? salesOverview.monthlyRevenue
        : [];
      if (overviewMonths.length > 0) {
        rbm = overviewMonths.map((entry: any) => ({
          month: String(entry.month),
          total: Number(entry.total ?? entry.value ?? 0),
        }));
      } else if (Array.isArray(d.revenueByMonth)) {
        rbm = d.revenueByMonth.map((r: any) => ({
          month: String(r.month),
          total: Number(r.total ?? r.value ?? 0),
        }));
      } else {
        rbm = [];
      }
      if (!rbm || rbm.length === 0) {
        const now = new Date();
        rbm = Array.from({ length: 12 }).map((_, i) => {
          const dt = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
            2,
            "0"
          )}`;
          return { month: key, total: 0 };
        });
      }
      setRevenueByMonth(rbm);

      const visitorStatsNormalized: VisitorStat[] = Array.isArray(
        visitorStatsPayload
      )
        ? visitorStatsPayload.map((row: any) => ({
            day: String(row.day ?? row.date ?? row.label ?? ""),
            total: Number(row.total ?? row.count ?? row.value ?? 0),
          }))
        : [];
      const filteredVisitorStats = visitorStatsNormalized
        .filter((row) => {
          const normalized = row.day.trim().toLowerCase();
          return (
            normalized.length > 0 &&
            normalized !== "undefined" &&
            normalized !== "null"
          );
        })
        .sort((a, b) => {
          const da = parseDayKey(a.day)?.getTime() ?? 0;
          const db = parseDayKey(b.day)?.getTime() ?? 0;
          return da - db;
        });
      setVisitorStats(filteredVisitorStats);

      setVisitorTotal(
        Number(
          visitorTotalPayload.total ??
            d.totalVisitors ??
            salesOverview.totalVisitors ??
            0
        )
      );

      const cancellationChartPayload = d.cancelledProductsChart;
      if (
        cancellationChartPayload &&
        Array.isArray(cancellationChartPayload.days) &&
        cancellationChartPayload.days.length > 0 &&
        Array.isArray(cancellationChartPayload.series)
      ) {
        const normalizedDays = cancellationChartPayload.days
          .map((day: any) => String(day ?? "").slice(0, 10))
          .filter((day: string) => day.length > 0);

        if (normalizedDays.length === 0) {
          setCancelledChart(null);
        } else {
          const normalizedSeries: CancelledSeries[] =
            cancellationChartPayload.series.map((series: any, idx: number) => {
              const rawId = series.productId ?? series.id ?? idx;
              const productId =
                typeof rawId === "number" || typeof rawId === "string" ? rawId : idx;

              const baseTitle =
                series.title ?? series.name ?? `Produit ${String(productId)}`;
              const sourceData = Array.isArray(series.data) ? series.data : [];

              return {
                productId,
                title: String(baseTitle),
                image: series.image ?? null,
                data: normalizedDays.map((_, dayIdx) =>
                  Number(sourceData[dayIdx] ?? 0)
                ),
              };
            });

          setCancelledChart({ days: normalizedDays, series: normalizedSeries });
        }

      } else {
        setCancelledChart(null);
      }

      // top products normalization
      const topRaw = Array.isArray(d.topProducts) ? d.topProducts : [];
      const tnorm: TopProduct[] = topRaw.map((p: any) => ({
        id: p.id ?? p.productId ?? p.product?.id,
        title: p.title ?? p.name ?? p.product?.title ?? "Unknown",
        image: p.image ?? p.images?.[0] ?? p.product?.images?.[0] ?? null,
        pricePiece:
          p.pricePiece ??
          p.price ??
          p.product?.pricePiece ??
          p.product?.price ??
          null,
        priceQuantity:
          p.priceQuantity ??
          p.product?.priceQuantity ??
          (p.amount && p.quantitySold
            ? Number(p.amount) / Number(p.quantitySold)
            : null) ??
          null,
        category: p.category ?? p.product?.category ?? null,
        quantitySold:
          Number(p.quantitySold ?? p._sum?.quantity ?? p.quantity ?? 0) || 0,
        amount:
          Number(p.amount ?? p.totalSales ?? p.total ?? p._sum?.total ?? 0) ||
          0,
      }));
      setTopProducts(tnorm);

      const mapRegionData = (regs: any[]) =>
        regs.map((r: any) => ({
          region: r.region ?? r.name ?? r.label ?? "Unknown",
          sales: Number(r.sales ?? r.value ?? 0),
          productsSold: Number(r.productsSold ?? r.count ?? 0),
        }));

      if (Array.isArray(d.salesByRegion) && d.salesByRegion.length > 0) {
        setSalesByRegion(mapRegionData(d.salesByRegion));
      } else {
        try {
          const regRes = await api.get("/api/sales/regions");
          const regs = Array.isArray(regRes.data) ? regRes.data : [];
          setSalesByRegion(mapRegionData(regs));
        } catch {
          try {
            const regRes = await api.get("/sales/regions");
            const regs = Array.isArray(regRes.data) ? regRes.data : [];
            setSalesByRegion(mapRegionData(regs));
          } catch {
            setSalesByRegion([]);
          }
        }
      }
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      setError(
        err?.response?.data?.error ?? err?.message ?? "Failed to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salesChartData = useMemo(
    () =>
      revenueByMonth.map((r) => ({
        ...r,
        label: monthLabel(r.month),
      })),
    [revenueByMonth]
  );

  const visitorChartData = useMemo(() => {
    const statsSource =
      visitorStats.length > 0
        ? visitorStats
        : Array.from({ length: 14 }).map((_, idx) => {
            const d = new Date();
            d.setDate(d.getDate() - (13 - idx));
            return { day: d.toISOString().slice(0, 10), total: 0 };
          });

    return statsSource.map((stat) => ({
      label: dayLabel(stat.day),
      total: Number(stat.total ?? 0),
    }));
  }, [visitorStats]);

  const cancellationSeriesDefs = useMemo(() => {
    if (
      !cancelledChart ||
      !Array.isArray(cancelledChart.series) ||
      cancelledChart.series.length === 0 ||
      !Array.isArray(cancelledChart.days) ||
      cancelledChart.days.length === 0
    ) {
      return [];
    }
    return cancelledChart.series.map((series, idx) => {
      const key =
        typeof series.productId === "number" || typeof series.productId === "string"
          ? `cancel-${series.productId}`
          : `cancel-${idx}`;
      return {
        key,
        productId: series.productId,
        title: series.title ?? `Produit ${series.productId ?? idx}`,
        image: series.image ?? null,
        color: CANCELLATION_COLORS[idx % CANCELLATION_COLORS.length],
        data: cancelledChart.days.map(
          (_, dayIdx) => Number(series.data?.[dayIdx] ?? 0)
        ),
      };
    });
  }, [cancelledChart]);

  const cancellationLineData = useMemo(() => {
    if (!cancelledChart?.days?.length || cancellationSeriesDefs.length === 0) {
      return [];
    }
    return cancelledChart.days.map((day, idx) => {
      const row: Record<string, any> = {
        day,
        label: dayLabel(day),
      };
      cancellationSeriesDefs.forEach((series) => {
        row[series.key] = Number(series.data[idx] ?? 0);
      });
      return row;
    });
  }, [cancelledChart, cancellationSeriesDefs]);

  const cancellationLegend = useMemo(
    () =>
      cancellationSeriesDefs.map((series) => {
        const total = series.data.reduce(
          (sum, value) => sum + (Number(value) || 0),
          0
        );
        const latest = series.data[series.data.length - 1] ?? 0;
        return {
          key: series.key,
          title: series.title,
          color: series.color,
          total,
          latest,
        };
      }),
    [cancellationSeriesDefs]
  );

  const isCancellationMode = chartMode === "cancellations";
  const areaChartData =
    chartMode === "sales"
      ? salesChartData
      : chartMode === "visitors"
      ? visitorChartData
      : [];
  const chartGradientId =
    chartMode === "sales" ? "salesGradient" : "visitorsGradient";
  const chartStroke =
    chartMode === "sales" ? "#2563EB" : "#F97316";
  const cancellationWindowDays =
    cancelledChart?.days?.length ?? DEFAULT_CANCELLATION_WINDOW;
  const chartTitle = (() => {
    switch (chartMode) {
      case "sales":
        return "Vue des ventes (12 derniers mois)";
      case "visitors":
        return "Nombre de visiteurs (30 derniers jours)";
      case "cancellations":
        return `Produits annulés (derniers ${cancellationWindowDays} jours)`;
      default:
        return "";
    }
  })();
  const chartSubtitle = (() => {
    switch (chartMode) {
      case "sales":
        return "Revenu net mensuel";
      case "visitors":
        return "Visiteurs uniques quotidiens";
      case "cancellations":
        return "Produits les plus annulés avec volumes quotidiens";
      default:
        return "";
    }
  })();
  const chartTooltipFormatter = (value: number) =>
    chartMode === "sales"
      ? formatCurrency(Number(value ?? 0))
      : `${Number(value ?? 0).toLocaleString()} visitors`;

  const regionPieData = useMemo(
    () =>
      salesByRegion.map((r) => ({
        name: r.region || "Unknown",
        value: r.sales || 0,
      })),
    [salesByRegion]
  );
  const totalRegionSales = useMemo(
    () => salesByRegion.reduce((s, r) => s + (r.sales || 0), 0) || 1,
    [salesByRegion]
  );

  // ---------------- Image helpers ----------------
  // Normalize various image path shapes returned from the DB into the correct server path
  function normalizeImagePath(src?: string | null) {
    if (!src) return null;
    const s = String(src).trim();
    if (!s) return null;

    // absolute url -> return as-is
    if (/^https?:\/\//i.test(s)) return s;

    // If the server stores "/uploads/..." but static route is under "/products/uploads/..."
    if (s.startsWith("/uploads/")) return `/products${s}`;

    // already correct
    if (s.startsWith("/products/uploads/")) return s;

    // "uploads/xxx" -> /products/uploads/xxx
    if (s.startsWith("uploads/")) return `/products/${s}`;

    if (s.startsWith("products/uploads/")) return `/${s}`;

    // any other root-relative path
    if (s.startsWith("/")) return s;

    // fallback -> assume an uploads filename
    return `/products/uploads/${s.replace(/^\/+/, "")}`;
  }

  // produce absolute URL for <img src=...>
  function getImageUrl(src?: string | null) {
    const normalized = normalizeImagePath(src);
    if (!normalized) {
      return `${baseURL.replace(/\/$/, "")}/placeholder.png`;
    }
    // if normalized is already absolute (starts with http) use it, otherwise attach baseURL
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `${baseURL.replace(/\/$/, "")}${
      normalized.startsWith("/") ? "" : "/"
    }${normalized}`;
  }

  // CSV export helper
  const exportCSV = () => {
    const rows = [
      [
        "id",
        "title",
        "category",
        "pricePiece",
        "priceQuantity",
        "quantitySold",
        "amount",
      ],
      ...topProducts.map((p) => [
        String(p.id ?? ""),
        p.title ?? "",
        p.category ?? "",
        String(p.pricePiece ?? ""),
        String(p.priceQuantity ?? ""),
        String(p.quantitySold ?? 0),
        String(p.amount ?? 0),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `top-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading)
    return <DashboardSkeleton />;
  if (error)
    return (
      <div className="p-6 text-red-600">
        Erreur de chargement des données : {error}
      </div>
    );

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString()}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">
            Vue d'ensemble admin
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-md border bg-white hover:bg-gray-100 text-sm w-full sm:w-auto"
            title="Exporter en CSV"
          >
            <DownloadCloud className="w-4 h-4" />
            Exporter CSV
          </button>

          <a
            href="/admin/products/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm shadow hover:opacity-95 w-full sm:w-auto"
            title="Ajouter un produit"
          >
            <Plus className="w-4 h-4" />
            Ajouter un produit
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <Card className="rounded-xl border border-transparent">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Ventes totales</p>
                <div className="text-2xl font-bold mt-2">
                  {formatCurrency(totalSales)}
                </div>
                <div
                  className={`mt-2 text-xs font-medium ${
                    growthMonthly >= 0 ? "text-green-600" : "text-red-600"
                  } flex items-center gap-2`}
                >
                  {growthMonthly >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {(growthMonthly * 100).toFixed(0)}%
                </div>
              </div>
              <div className="w-20 h-12 flex items-center">
                <svg viewBox="0 0 40 20" className="w-full h-full">
                  <path
                    d="M0 14 C6 10, 12 6, 18 8 C24 10, 30 6, 40 4"
                    stroke="#F59E0B"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Commandes totales</p>
                <div className="text-2xl font-bold mt-2">
                  {totalOrders.toLocaleString()}
                </div>
                <div
                  className={`mt-2 text-xs font-medium ${
                    growthWeekly >= 0 ? "text-green-600" : "text-red-600"
                  } flex items-center gap-2`}
                >
                  {growthWeekly >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {(growthWeekly * 100).toFixed(0)}%
                </div>
              </div>
              <div className="w-20 h-12 flex items-center">
                <svg viewBox="0 0 40 20" className="w-full h-full">
                  <path
                    d="M0 12 L6 8 L12 10 L18 6 L24 10 L30 8 L40 12"
                    stroke="#2563EB"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Revenu total</p>
                <div className="text-2xl font-bold mt-2">
                  {formatCurrency(totalSales)}
                </div>
                <div className="mt-2 text-xs text-green-600">
                  +{(growthMonthly * 100).toFixed(0)}%
                </div>
              </div>
              <div className="w-20 h-12 flex items-center">
                <svg viewBox="0 0 40 20" className="w-full h-full">
                  <path
                    d="M0 14 C8 10, 16 8, 24 12 C32 16, 40 12, 40 12"
                    stroke="#10B981"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Retours produits</p>
                <div className="text-2xl font-bold mt-2">{productReturns}</div>
                <div className="mt-2 text-xs text-gray-500">
                  Commandes retournées / annulées
                </div>
              </div>
              <div className="w-20 h-12 flex items-center">
                <svg viewBox="0 0 40 20" className="w-full h-full">
                  <path
                    d="M40 6 C32 10, 24 12, 16 8 C8 4, 0 6, 0 6"
                    stroke="#EF4444"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">Visiteurs totaux</p>
                <div className="text-2xl font-bold mt-2">
                  {visitorTotal.toLocaleString()}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Suivi automatique sur la page d'accueil
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-xl">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
              <CardTitle>{chartTitle}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">{chartSubtitle}</p>
            </div>
            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setChartMode("sales")}
                className={`px-3 py-1.5 rounded-full border transition-all ${
                  chartMode === "sales"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                Ventes
              </button>
              <button
                onClick={() => setChartMode("visitors")}
                className={`px-3 py-1.5 rounded-full border transition-all ${
                  chartMode === "visitors"
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                Visiteurs
              </button>
              <button
                onClick={() => setChartMode("cancellations")}
                className={`px-3 py-1.5 rounded-full border transition-all ${
                  chartMode === "cancellations"
                    ? "bg-rose-500 text-white border-rose-500"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                Produits annulés
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              {isCancellationMode ? (
                cancellationLineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={cancellationLineData}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" allowDecimals={false} />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${Number(value ?? 0)} cancels`,
                          name,
                        ]}
                      />
                      {cancellationSeriesDefs.map((series) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          stroke={series.color}
                          strokeWidth={2}
                          dot={false}
                          name={series.title}
                          isAnimationActive
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-500">
                    No cancelled orders recorded for this period.
                  </div>
                )
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    key={chartMode}
                    data={areaChartData}
                    margin={{ top: 8, right: 16, left: -8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#2563EB"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#2563EB"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                      <linearGradient
                        id="visitorsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#F97316"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#F97316"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      formatter={(value: number) =>
                        chartTooltipFormatter(Number(value ?? 0))
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={chartStroke}
                      fill={`url(#${chartGradientId})`}
                      strokeWidth={2}
                      isAnimationActive
                      animationDuration={800}
                    />
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      vertical={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {isCancellationMode && cancellationLegend.length > 0 && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {cancellationLegend.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm font-medium">
                        {entry.title}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-800">
                        {entry.total.toLocaleString()} au total
                      </div>
                      <div className="text-xs text-gray-500">
                        Dernier jour : {entry.latest.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Produits les plus vendus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-sm text-gray-500">
                    <tr>
                      <th className="py-3">Produit</th>
                      <th className="py-3">Prix</th>
                      <th className="py-3">Catégorie</th>
                      <th className="py-3">Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.length > 0 ? (
                      topProducts.map((p) => {
                        const qty = Number(p.quantitySold ?? 0);
                        const piece = p.pricePiece;
                        const quantity = p.priceQuantity;
                        const imgUrl = getImageUrl(p.image ?? null);

                        return (
                          <tr
                            key={String(p.id ?? p.title)}
                            className="border-t hover:bg-gray-50"
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">
                                  {p.image ? (
                                    <img
                                      src={imgUrl}
                                      alt={p.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (
                                          e.currentTarget as HTMLImageElement
                                        ).src = `${baseURL.replace(
                                          /\/$/,
                                          ""
                                        )}/placeholder.png`;
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                                      Pas d'image
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm">{p.title}</div>
                              </div>
                            </td>

                            <td className="py-3 text-sm">
                              <div>
                                Pièce :{" "}
                                {piece !== null && piece !== undefined
                                  ? formatCurrency(Number(piece))
                                  : "-"}
                              </div>
                              <div>
                                Quantité :{" "}
                                {quantity !== null && quantity !== undefined
                                  ? formatCurrency(Number(quantity))
                                  : "-"}
                              </div>
                            </td>

                            <td className="py-3 text-sm text-gray-600">
                              {p.category ?? "-"}
                            </td>
                            <td className="py-3">{qty}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-sm text-gray-500"
                        >
                          Aucune donnée produit
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle>Ventes par région</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div style={{ width: 100, height: 80 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={regionPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={28}
                        outerRadius={40}
                        paddingAngle={2}
                      >
                        {regionPieData.map((_, i) => (
                          <Cell
                            key={`cell-${i}`}
                            fill={COLORS[i % COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <div className="text-sm text-gray-500">Régions</div>
                  <div className="text-2xl font-bold">
                    {salesByRegion.length}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatCurrency(totalRegionSales)} de ventes
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {salesByRegion.length > 0 ? (
                  salesByRegion.map((r, idx) => {
                    const pct = ((r.sales || 0) / totalRegionSales) * 100;
                    return (
                      <div
                        key={r.region ?? idx}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium">{r.region}</div>
                          <div className="text-xs text-gray-500">
                            {r.productsSold ?? 0} produits
                          </div>
                        </div>

                        <div className="w-36 text-right">
                          <div className="text-sm font-semibold">
                            {formatCurrency(r.sales || 0)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pct.toFixed(1)}%
                          </div>
                          <div className="w-full mt-1 h-2 bg-gray-100 rounded">
                            <div
                              className="h-2 rounded"
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                background: COLORS[idx % COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500">
                    Aucune donnée par région
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


