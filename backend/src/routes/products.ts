import { Router } from "express";
import { PrismaClient, Role } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import { clerkAuth } from "../middleware/clerkAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { getClientVisibilityFilter, getProductVisibilityStatus, isProductPublic } from "../utils/productVisibility";

const prisma = new PrismaClient();
const router = Router();

const NOUVEAUTES_CATEGORY = "nouveautes";
const NOUVEAUTES_LIFETIME_DAYS = 15;

function computeNouveautesUntil(): Date {
  const until = new Date();
  until.setDate(until.getDate() + NOUVEAUTES_LIFETIME_DAYS);
  return until;
}

// âœ… Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Global shipping price config stored on disk (default 7 DT)
const shippingConfigPath = path.join(process.cwd(), "shipping-config.json");
function readShippingConfig(): number {
  try {
    const raw = fs.readFileSync(shippingConfigPath, "utf-8");
    const parsed = JSON.parse(raw);
    const val =
      typeof parsed?.shippingPrice === "number"
        ? parsed.shippingPrice
        : Number(parsed?.shippingPrice);
    if (Number.isFinite(val) && val >= 0) return Number(val);
  } catch {
    // ignore; will use default
  }
  return 7;
}

function writeShippingConfig(value: number) {
  try {
    fs.writeFileSync(
      shippingConfigPath,
      JSON.stringify({ shippingPrice: value }, null, 2),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to persist shipping config", err);
  }
}

// âœ… Multer setup for image uploads
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// âœ… Serve static images
router.use("/uploads", require("express").static(uploadDir));

// âœ… Helper: Slugify title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-");
}

type ProductWithTimeline = {
  category: string;
  createdAt: Date;
  nouveautesUntil: Date | null;
};

function normalizeCategoryTerm(value: any): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function computeNouveautesWindowStart(reference: Date): Date {
  const start = new Date(reference);
  start.setDate(start.getDate() - NOUVEAUTES_LIFETIME_DAYS);
  return start;
}

function isNouveauteActive(
  product: ProductWithTimeline,
  reference: Date
): boolean {
  if (product?.nouveautesUntil) {
    return product.nouveautesUntil > reference;
  }
  if (!product?.createdAt) return false;
  const fallback = new Date(product.createdAt);
  fallback.setDate(fallback.getDate() + NOUVEAUTES_LIFETIME_DAYS);
  return fallback > reference;
}

function buildProductCategories(
  product: ProductWithTimeline,
  reference: Date
): string[] {
  const categories: string[] = [];
  if (product?.category) categories.push(product.category);
  if (isNouveauteActive(product, reference)) {
    categories.push(NOUVEAUTES_CATEGORY);
  }
  return categories;
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return undefined;
  return String(value);
}

type ViewerFilter = { clerkUserId?: string } | { authorEmail?: string };

function buildViewerFilters(
  clerkId?: unknown,
  email?: unknown
): ViewerFilter[] {
  const filters: ViewerFilter[] = [];
  if (typeof clerkId === "string" && clerkId.trim().length > 0) {
    filters.push({ clerkUserId: clerkId.trim() });
  }
  if (typeof email === "string" && email.trim().length > 0) {
    filters.push({ authorEmail: email.trim().toLowerCase() });
  }
  return filters;
}

async function fetchRatingSummary(
  productId: number,
  viewerFilters: ViewerFilter[] = []
) {
  const [aggregate, recent, viewer] = await Promise.all([
    prisma.productRating.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.productRating.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        rating: true,
        comment: true,
        authorName: true,
        createdAt: true,
      },
    }),
    viewerFilters.length
      ? prisma.productRating.findFirst({
        where: { productId, OR: viewerFilters },
        select: {
          id: true,
          rating: true,
          comment: true,
          authorName: true,
          authorEmail: true,
        },
      })
      : Promise.resolve(null),
  ]);

  return {
    summary: {
      average: Number(aggregate._avg.rating ?? 0),
      total: Number(aggregate._count.rating ?? 0),
      recent: recent.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        authorName: row.authorName,
        createdAt: row.createdAt,
      })),
    },
    viewer: viewer
      ? {
        id: viewer.id,
        rating: viewer.rating,
        comment: viewer.comment ?? "",
        authorName: viewer.authorName ?? "",
        authorEmail: viewer.authorEmail ?? "",
      }
      : null,
  };
}

function parseBooleanValue(input: any) {
  if (typeof input === "boolean") return input;
  if (typeof input === "string") {
    return ["true", "1", "on", "yes"].includes(input.toLowerCase());
  }
  if (typeof input === "number") {
    return input === 1;
  }
  return false;
}

function toNumberOrNull(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanUndefined<T extends Record<string, any>>(obj: T) {
  const copy: Record<string, any> = { ...obj };
  Object.keys(copy).forEach((k) => {
    if (copy[k] === undefined) delete copy[k];
  });
  return copy as T;
}

function cleanProductPayload(data: Record<string, any>) {
  const copy = cleanUndefined(data);
  // strip fields not present in Prisma schema (derived only)
  delete (copy as any).isNovelty;
  // defensive: these get removed separately, keep consistent
  delete (copy as any).originalPrice;
  delete (copy as any).salePercentage;
  return copy;
}

type VariantDef = { id?: string; type: string; values: string[] };
type CombinationPayload = {
  id?: string;
  options?: Record<string, string>;
  price?: number | null; // legacy single price (retained for backward parsing)
  pricePiece?: number | null;
  priceQuantity?: number | null;
  stock?: number | null;
  images?: string[] | null;
};

function ensureVariantIds(raw: any): VariantDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v: any, idx: number) => {
    const cleanId =
      typeof v?.id === "string" && v.id.trim().length > 0
        ? v.id.trim()
        : `variant_${idx}_${Date.now()}`;
    return {
      id: cleanId,
      type: typeof v?.type === "string" ? v.type : "",
      values: Array.isArray(v?.values)
        ? v.values.map((val: any) => String(val))
        : [],
    };
  });
}

function normalizeCombinations(
  raw: any,
  variants: VariantDef[]
): CombinationPayload[] {
  if (!Array.isArray(raw)) return [];
  const variantMap: Record<string, VariantDef> = {};
  variants.forEach((v) => {
    if (v.id) variantMap[v.id] = v;
  });
  return raw
    .map((combo: any, idx: number) => {
      const opts: Record<string, string> = {};
      variants.forEach((v) => {
        const val =
          combo?.options?.[v.id as string] ??
          combo?.options?.[v.type] ??
          combo?.options?.[String(v.type).toLowerCase()];
        const normalized = typeof val === "string" ? val : "";
        opts[v.id as string] = v.values.includes(normalized)
          ? normalized
          : "";
      });
      const price =
        combo?.price === null || combo?.price === undefined
          ? null
          : Number(combo.price);
      const pricePiece =
        combo?.pricePiece === null || combo?.pricePiece === undefined
          ? null
          : Number(combo.pricePiece);
      const priceQuantity =
        combo?.priceQuantity === null || combo?.priceQuantity === undefined
          ? null
          : Number(combo.priceQuantity);
      const stock =
        combo?.stock === null || combo?.stock === undefined
          ? null
          : Number(combo.stock);
      const images = Array.isArray(combo?.images)
        ? combo.images.map((i: any) => String(i)).filter(Boolean)
        : [];
      return {
        id:
          typeof combo?.id === "string" && combo.id.trim()
            ? combo.id.trim()
            : `combo_${idx}_${Date.now()}`,
        options: opts,
        // if only legacy `price` is provided, map it to pricePiece
        price: Number.isFinite(price) ? Number(price) : null,
        pricePiece: Number.isFinite(pricePiece)
          ? Number(pricePiece)
          : Number.isFinite(price)
            ? Number(price)
            : null,
        priceQuantity: Number.isFinite(priceQuantity)
          ? Number(priceQuantity)
          : null,
        stock: Number.isFinite(stock) ? Number(stock) : null,
        images,
      };
    })
    .filter((c: any) => !!c);
}

function deriveStockFromCombinations(
  combinations: CombinationPayload[],
  fallbackQty: number | null
) {
  if (!Array.isArray(combinations) || combinations.length === 0) {
    const qty = toNumberOrNull(fallbackQty);
    const available = qty ?? 0;
    return {
      availableQuantity: available,
      inStock: available > 0,
    };
  }
  const stocks = combinations
    .map((c) => toNumberOrNull(c.stock))
    .filter((s): s is number => s !== null);
  const total = stocks.reduce((sum, v) => sum + v, 0);
  const anyStock = stocks.some((s) => s > 0);
  return {
    availableQuantity: stocks.length ? total : 0,
    inStock: anyStock,
  };
}

function minCombinationPrice(combinations: CombinationPayload[]): number | null {
  if (!Array.isArray(combinations) || combinations.length === 0) return null;
  const prices = combinations
    .flatMap((c) => [
      toNumberOrNull(c.pricePiece),
      toNumberOrNull(c.priceQuantity),
      toNumberOrNull(c.price), // legacy
    ])
    .filter((p): p is number => p !== null);
  if (!prices.length) return null;
  return Math.min(...prices);
}

function minCombinationPriceForMode(
  mode: "piece" | "quantity",
  combinations: CombinationPayload[]
): number | null {
  if (!Array.isArray(combinations) || combinations.length === 0) return null;
  const prices = combinations
    .map((c) => {
      if (mode === "piece") {
        return (
          toNumberOrNull(c.pricePiece) ??
          toNumberOrNull(c.priceQuantity) ??
          toNumberOrNull(c.price)
        );
      }
      return (
        toNumberOrNull(c.priceQuantity) ??
        toNumberOrNull(c.pricePiece) ??
        toNumberOrNull(c.price)
      );
    })
    .filter((p): p is number => p !== null);
  if (!prices.length) return null;
  return Math.min(...prices);
}

// -----------------------------------------------------------
// Global shipping price (single value used by checkout)
// -----------------------------------------------------------
router.get("/shipping-price", async (_, res) => {
  const current = readShippingConfig();
  res.json({ shippingPrice: current });
});

router.patch(
  "/shipping-price",
  clerkAuth,
  requireAdmin,
  async (req, res) => {
    const price = toNumberOrNull(req.body?.shippingPrice);
    if (price === null || price < 0) {
      return res
        .status(400)
        .json({ error: "shippingPrice must be a non-negative number" });
    }
    const normalized = Number(price.toFixed(3));
    writeShippingConfig(normalized);
    res.json({ shippingPrice: normalized });
  }
);

function resolveFlashBasePrice(options: {
  saleType?: string | null;
  pricePiece?: number | null;
  priceQuantity?: number | null;
}) {
  const normalized = (options.saleType || "").toLowerCase();
  if (normalized === "quantity") {
    return options.priceQuantity ?? options.pricePiece ?? null;
  }
  if (normalized === "piece") {
    return options.pricePiece ?? options.priceQuantity ?? null;
  }
  // both or undefined: prefer piece price first
  return options.pricePiece ?? options.priceQuantity ?? null;
}

function calculateVenteFlashPrice(
  basePrice: number | null,
  discountValue: number | null,
  isActive: boolean,
  discountType: "percent" | "fixed" = "percent"
) {
  if (!isActive || basePrice === null || discountValue === null) {
    return null;
  }
  const val = Number(discountValue);
  if (!Number.isFinite(val) || val <= 0) return null;
  if (discountType === "fixed") {
    return Number(Math.max(0, basePrice - val).toFixed(2));
  }
  return Number((basePrice - (basePrice * val) / 100).toFixed(2));
}

/* -----------------------------------------------------------
 * Helper: Normalize and fetch client purchase unit
 * ----------------------------------------------------------*/
function normalizePurchaseUnit(val: any): "piece" | "quantity" {
  if (!val) return "piece";
  const s = String(val).toLowerCase().trim();
  if (["quantity", "qty", "bulk"].includes(s)) return "quantity";
  return "piece";
}

async function getClientPurchaseUnit(
  clientId?: any,
  clerkId?: any
): Promise<"piece" | "quantity"> {
  try {
    if (clerkId) {
      const byClerk = await prisma.client.findFirst({
        where: { clerkId: String(clerkId) },
        select: { purchaseUnit: true },
      });
      if (byClerk?.purchaseUnit)
        return normalizePurchaseUnit(byClerk.purchaseUnit);
    }
    if (clientId) {
      const byId = await prisma.client.findUnique({
        where: { id: Number(clientId) },
        select: { purchaseUnit: true },
      });
      if (byId?.purchaseUnit) return normalizePurchaseUnit(byId.purchaseUnit);
    }
  } catch (e) {
    console.error("getClientPurchaseUnit error:", e);
  }
  return "piece";
}

/* -----------------------------------------------------------
 * ðŸ“¦ GET /products
 * - Admin: show all products
 * - Client: filter by purchaseUnit and adjust price
 * ----------------------------------------------------------*/
router.get("/", async (req, res) => {
  try {
    const { category, subCategory, title, clientId, clerkId } = req.query;

    // Check if this is an admin request that should bypass visibility filter
    // Admin requests come from admin panel with x-admin-request header
    const isAdminRequest = req.headers["x-admin-request"] === "true";

    // Apply visibility filter for everyone EXCEPT admin requests
    const isClient = !isAdminRequest;

    const now = new Date();

    // ðŸ§± Filter
    const where: any = {};
    const categoryValue = firstQueryValue(category);
    if (categoryValue) {
      const normalizedCategory = normalizeCategoryTerm(categoryValue);
      if (normalizedCategory === NOUVEAUTES_CATEGORY) {
        const nouveautesStart = computeNouveautesWindowStart(now);
        where.OR = [
          { nouveautesUntil: { gt: now } },
          {
            AND: [
              { nouveautesUntil: null },
              { createdAt: { gt: nouveautesStart } },
            ],
          },
        ];
      } else {
        where.category = { equals: categoryValue, mode: "insensitive" };
      }
    }
    const subCategoryValue = firstQueryValue(subCategory);
    if (subCategoryValue)
      where.subCategory = { equals: subCategoryValue, mode: "insensitive" };
    const titleValue = firstQueryValue(title);
    if (titleValue) where.title = { contains: titleValue, mode: "insensitive" };
    const venteFlashValue = firstQueryValue(req.query.venteFlash);
    if (
      venteFlashValue &&
      ["1", "true", "yes"].includes(venteFlashValue.toLowerCase())
    ) {
      where.venteFlashActive = true;
    }

    const limitValue = Number(firstQueryValue(req.query.limit));
    const skipValue = Number(firstQueryValue(req.query.skip));

    // 🔒 Apply visibility filter for client mode
    // Clients only see products where visible=true AND (publishAt is null OR publishAt <= now)
    if (isClient) {
      const visibilityFilter = getClientVisibilityFilter(now);
      where.visible = visibilityFilter.visible;
      // Handle OR conditions carefully - merge with existing OR if present
      if (where.OR) {
        // Wrap existing OR in AND with visibility OR
        where.AND = [
          { OR: where.OR },
          { OR: visibilityFilter.OR }
        ];
        delete where.OR;
      } else {
        where.OR = visibilityFilter.OR;
      }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { id: "desc" },
      ...(Number.isFinite(limitValue) && limitValue > 0
        ? { take: limitValue }
        : {}),
      ...(Number.isFinite(skipValue) && skipValue > 0 ? { skip: skipValue } : {}),
    });

    // Aggregate ratings (average + count) for all fetched products
    const ratingMap: Record<
      number,
      { average: number; count: number }
    > = {};
    if (products.length > 0) {
      const ratingAgg = await prisma.productRating.groupBy({
        by: ["productId"],
        where: { productId: { in: products.map((p) => p.id) } },
        _avg: { rating: true },
        _count: { rating: true },
      });
      ratingAgg.forEach((row) => {
        ratingMap[row.productId] = {
          average: Number(row._avg.rating ?? 0),
          count: Number(row._count.rating ?? 0),
        };
      });
    }

    // ðŸ§‘â€ðŸ’¼ ADMIN MODE â†’ return all
    if (!isClient) {
      return res.json(
        products.map((p) => {
          const isNouveaute = isNouveauteActive(p, now);
          const comboMin = minCombinationPrice((p as any).combinations ?? []);
          const basePrice = comboMin ?? resolveFlashBasePrice({
            saleType: p.saleType,
            pricePiece: p.pricePiece,
            priceQuantity: p.priceQuantity,
          });
          return {
            ...p,
            categories: buildProductCategories(p, now),
            isNouveaute,
            displayPriceAll: {
              piece: p.pricePiece ?? null,
              quantity: p.priceQuantity ?? null,
            },
            displayFlashPrice: calculateVenteFlashPrice(
              basePrice,
              p.venteFlashPercentage ?? null,
              p.venteFlashActive
            ),
            rating: ratingMap[p.id]?.average ?? null,
            ratingCount: ratingMap[p.id]?.count ?? 0,
          };
        })
      );
    }

    // ðŸ§â€â™‚ï¸ CLIENT MODE â†’ personalized view
    const purchaseUnit = await getClientPurchaseUnit(clientId, clerkId);

    const visible = products
      .filter((p) => {
        if (p.saleType === "both") return true;
        if (p.saleType === "piece" && purchaseUnit === "piece") return true;
        if (p.saleType === "quantity" && purchaseUnit === "quantity")
          return true;
        return false;
      })
      .map((p) => {
        const pricePiece = p.pricePiece ?? null;
        const priceQuantity = p.priceQuantity ?? null;
        const canBuyWithPiece = p.saleType === "piece" || p.saleType === "both";
        const canBuyWithQuantity =
          p.saleType === "quantity" || p.saleType === "both";
        const isNouveaute = isNouveauteActive(p, now);
        const categories = buildProductCategories(p, now);

        const combos = (p as any).combinations ?? [];
        const comboMinForUnit = minCombinationPriceForMode(
          purchaseUnit,
          combos
        );
        const comboMinOverall = minCombinationPrice(combos);
        const preferredPrice =
          comboMinForUnit ??
          (purchaseUnit === "quantity"
            ? priceQuantity ?? pricePiece
            : pricePiece ?? priceQuantity);
        const fallbackPrice =
          purchaseUnit === "quantity" ? pricePiece : priceQuantity;
        const displayPrice = preferredPrice ?? fallbackPrice ?? null;
        const displayFlashPrice = calculateVenteFlashPrice(
          displayPrice,
          p.venteFlashPercentage ?? null,
          p.venteFlashActive
        );

        return {
          ...p,
          clientPurchaseUnit: purchaseUnit,
          canBuyWithPiece,
          canBuyWithQuantity,
          displayPriceAll: { piece: pricePiece, quantity: priceQuantity },
          minCombinationPrice: comboMinOverall,
          displayPrice,
          displayFlashPrice,
          categories,
          isNouveaute,
          rating: ratingMap[p.id]?.average ?? null,
          ratingCount: ratingMap[p.id]?.count ?? 0,
        };
      });

    res.json(visible);
  } catch (err: any) {
    console.error("âŒ Error fetching products:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------------------------------
 * ðŸ§¾ GET /products/:id â€” single product by ID
 * ----------------------------------------------------------*/
/* -----------------------------------------------------------
 * 🪫 GET /products/low-stock — admin alert list
 * IMPORTANT: Must be BEFORE /:id to prevent route conflict
 * ----------------------------------------------------------*/
router.get(
  "/low-stock",
  clerkAuth,
  requireAdmin,
  async (_req, res) => {
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          title: true,
          availableQuantity: true,
          minStockAlert: true,
          variants: true,
          combinations: true,
        },
      });

      const alerts: Array<{
        productId: number;
        productTitle: string;
        combinationId: string | null;
        combinationLabel: string;
        stock: number;
        minStockAlert: number;
      }> = [];

      const numOrNull = (v: any): number | null => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      products.forEach((p) => {
        const threshold = numOrNull(p.minStockAlert) ?? 0;
        if (threshold <= 0) return;

        const variants = Array.isArray(p.variants) ? (p.variants as any[]) : [];
        const combos = Array.isArray(p.combinations)
          ? (p.combinations as any[])
          : [];

        const comboLabel = (combo: any): string => {
          const opts = combo?.options ?? {};
          const parts = variants
            .map((v: any, idx: number) => {
              const key =
                (v?.id as string) ||
                (typeof v?.type === "string" && v.type) ||
                `variant_${idx}`;
              const val = opts[key];
              if (!val) return null;
              return `${v?.type ?? "Variante"}: ${val}`;
            })
            .filter(Boolean);
          return parts.length
            ? parts.join(" / ")
            : combo?.id
              ? `Combinaison ${String(combo.id).slice(0, 6)}`
              : "Combinaison";
        };

        if (combos.length > 0) {
          combos.forEach((c: any) => {
            const stock = numOrNull(c?.stock);
            if (stock === null) return;
            if (stock <= threshold) {
              alerts.push({
                productId: p.id,
                productTitle: p.title,
                combinationId: c?.id ?? null,
                combinationLabel: comboLabel(c),
                stock,
                minStockAlert: threshold,
              });
            }
          });
        } else {
          const stock = numOrNull(p.availableQuantity) ?? 0;
          if (stock <= threshold) {
            alerts.push({
              productId: p.id,
              productTitle: p.title,
              combinationId: null,
              combinationLabel: "Produit principal",
              stock,
              minStockAlert: threshold,
            });
          }
        }
      });

      return res.json(alerts);
    } catch (err: any) {
      console.error("low-stock endpoint error", err);
      res.status(500).json({ error: err.message ?? "Low stock error" });
    }
  }
);

/* -----------------------------------------------------------
 * 🧾 GET /products/:id — single product by ID
 * ----------------------------------------------------------*/
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { clientId, clerkId } = req.query;
    const isClient = !!clientId || !!clerkId;
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const now = new Date();

    // 🔒 For client mode: check if product is public, return 404 if not
    // This prevents direct URL access to hidden/scheduled products
    if (isClient && !isProductPublic(product, now)) {
      return res.status(404).json({ error: "Product not found" });
    }

    let purchaseUnit: "piece" | "quantity" = await getClientPurchaseUnit(
      clientId,
      clerkId
    );

    const combos = (product as any).combinations ?? [];
    const comboMin = minCombinationPrice(combos);
    const comboMinForUnit = minCombinationPriceForMode(
      purchaseUnit,
      combos
    );
    let displayPrice =
      comboMinForUnit ??
      (purchaseUnit === "quantity"
        ? product.priceQuantity ?? product.pricePiece
        : product.pricePiece ?? product.priceQuantity);
    const isNouveaute = isNouveauteActive(product, now);
    const categories = buildProductCategories(product, now);

    const displayFlashPrice = calculateVenteFlashPrice(
      displayPrice,
      product.venteFlashPercentage ?? null,
      product.venteFlashActive
    );

    // rating summary for quick display
    const ratingSummary = await fetchRatingSummary(id);

    res.json({
      ...product,
      clientPurchaseUnit: purchaseUnit,
      displayPrice,
      displayFlashPrice,
      displayPriceAll: {
        piece: product.pricePiece ?? null,
        quantity: product.priceQuantity ?? null,
      },
      categories,
      isNouveaute,
      rating: ratingSummary.summary.average,
      ratingCount: ratingSummary.summary.total,
    });
  } catch (err: any) {
    console.error("âŒ Error fetching product:", err);
    res.status(500).json({ error: err.message });
  }
});

/* -----------------------------------------------------------
 * â­ Ratings endpoints
 * ----------------------------------------------------------*/
router.get("/:id/ratings", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const viewerFilters = buildViewerFilters(req.query.clerkId, req.query.email);
    const payload = await fetchRatingSummary(id, viewerFilters);
    res.json(payload);
  } catch (err: any) {
    console.error("Error loading ratings:", err);
    res
      .status(500)
      .json({ error: err.message ?? "Failed to load ratings" });
  }
});

router.post("/:id/ratings", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const ratingValue = Number(req.body?.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const comment =
      typeof req.body?.comment === "string"
        ? req.body.comment.trim().slice(0, 1000)
        : null;
    const authorName =
      typeof req.body?.authorName === "string"
        ? req.body.authorName.trim().slice(0, 120)
        : null;
    const authorEmail =
      typeof req.body?.authorEmail === "string"
        ? req.body.authorEmail.trim().toLowerCase()
        : null;
    const clerkUserId =
      typeof req.body?.clerkUserId === "string" &&
        req.body.clerkUserId.trim().length > 0
        ? req.body.clerkUserId.trim()
        : null;

    const ratingData = {
      rating: Math.round(ratingValue),
      comment,
      authorName,
      authorEmail,
      clerkUserId,
    };

    let existing = null;
    if (clerkUserId) {
      existing = await prisma.productRating.findFirst({
        where: { productId: id, clerkUserId },
      });
    }
    if (!existing && authorEmail) {
      existing = await prisma.productRating.findFirst({
        where: { productId: id, authorEmail },
      });
    }

    if (existing) {
      await prisma.productRating.update({
        where: { id: existing.id },
        data: ratingData,
      });
    } else {
      await prisma.productRating.create({
        data: { ...ratingData, productId: id },
      });
    }

    const viewerFilters = buildViewerFilters(clerkUserId, authorEmail);
    const payload = await fetchRatingSummary(id, viewerFilters);
    res.json({ ok: true, ...payload });
  } catch (err: any) {
    console.error("Error saving rating:", err);
    res.status(500).json({ error: err.message ?? "Failed to save rating" });
  }
});

/* -----------------------------------------------------------
 * ðŸ–¼ï¸ POST /products/upload
 * ----------------------------------------------------------*/
router.post(
  "/upload",
  clerkAuth,
  requireAdmin,
  upload.array("files", 10),
  (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const urls = files.map((f) => `/uploads/${f.filename}`);
      res.json({ urls });
    } catch {
      res.status(500).json({ error: "Failed to upload images" });
    }
  }
);

/* -----------------------------------------------------------
 * ðŸ†• POST /products â€” create product
 * ----------------------------------------------------------*/
router.post(
  "/",
  clerkAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const data = { ...(req.body ?? {}) };
      delete (data as any).nouveautesUntil;

      const tags =
        typeof data.tags === "string" ? JSON.parse(data.tags) : data.tags;
      const variantsRaw =
        typeof data.variants === "string"
          ? JSON.parse(data.variants)
          : data.variants;
      const combinationsRaw =
        typeof data.combinations === "string"
          ? JSON.parse(data.combinations)
          : data.combinations;
      const variants = ensureVariantIds(variantsRaw);
      const combinations = normalizeCombinations(combinationsRaw, variants);
      const images =
        typeof data.images === "string" ? JSON.parse(data.images) : data.images;
      const shippingPrice = toNumberOrNull(data.shippingPrice);
      const pricePiece = toNumberOrNull(data.pricePiece);
      const priceQuantity = toNumberOrNull(data.priceQuantity);
      const availableQuantity = toNumberOrNull(data.availableQuantity) ?? 0;
      const saleType = data.saleType || "piece";
      // Parse minOrderQty fields with validation
      const minOrderQtyRetail = Math.max(1, toNumberOrNull(data.minOrderQtyRetail) ?? 1);
      const minOrderQtyWholesale = Math.max(1, toNumberOrNull(data.minOrderQtyWholesale) ?? 1);
      const venteFlashActive = parseBooleanValue(data.venteFlashActive);
      const venteFlashPercentage = toNumberOrNull(data.venteFlashPercentage);
      const flashApplyTarget =
        data.flashApplyTarget === "combinations" ? "combinations" : "product";
      const flashApplyAllCombinations = parseBooleanValue(
        data.flashApplyAllCombinations ?? true
      );
      const flashCombinationIds =
        typeof data.flashCombinationIds === "string"
          ? JSON.parse(data.flashCombinationIds)
          : Array.isArray(data.flashCombinationIds)
            ? data.flashCombinationIds
            : [];
      const flashDiscountType =
        data.flashDiscountType === "fixed" ? "fixed" : "percent";
      const flashDiscountValue = toNumberOrNull(data.flashDiscountValue);
      const flashStartAt = data.flashStartAt ? new Date(data.flashStartAt) : null;
      const flashEndAt = data.flashEndAt ? new Date(data.flashEndAt) : null;
      if (
        venteFlashActive &&
        flashApplyTarget === "combinations" &&
        !flashApplyAllCombinations &&
        (!Array.isArray(flashCombinationIds) || flashCombinationIds.length === 0)
      ) {
        return res
          .status(400)
          .json({ error: "Select au moins une combinaison pour la vente flash." });
      }
      if (
        venteFlashActive &&
        flashApplyTarget === "combinations" &&
        !flashApplyAllCombinations &&
        (!Array.isArray(flashCombinationIds) || flashCombinationIds.length === 0)
      ) {
        return res
          .status(400)
          .json({ error: "Select au moins une combinaison pour la vente flash." });
      }
      const comboMinPrice = minCombinationPrice(combinations);
      const flashBase = comboMinPrice ?? resolveFlashBasePrice({
        saleType,
        pricePiece,
        priceQuantity,
      });
      const venteFlashPrice = calculateVenteFlashPrice(
        flashBase,
        flashDiscountType === "fixed" ? flashDiscountValue : venteFlashPercentage,
        venteFlashActive,
        flashDiscountType
      );

      const stockDerived = deriveStockFromCombinations(
        combinations,
        availableQuantity
      );

      const newProduct = await prisma.product.create({
        data: {
          title: data.title,
          slug: slugify(data.title),
          productId: data.productId || null,
          category: data.category,
          subCategory: data.subCategory || null,
          description: data.description,
          status: data.status || "Active",
          pricePiece,
          priceQuantity,
          saleType,
          availableQuantity: stockDerived.availableQuantity,
          minStockAlert: Number(data.minStockAlert || 0),
          shippingWeight: data.shippingWeight?.trim() || null,
          shippingPrice: shippingPrice ?? 7,
          dimensions: data.dimensions?.trim() || null,
          visible: data.visible !== undefined ? parseBooleanValue(data.visible) : true,
          publishAt: data.publishAt ? new Date(data.publishAt) : null,
          tags: tags || [],
          variants: variants || [],
          combinations: combinations || [],
          images: images || [],
          inStock: stockDerived.inStock,
          nouveautesUntil: computeNouveautesUntil(),
          venteFlashActive,
          venteFlashPercentage: venteFlashActive ? venteFlashPercentage : null,
          venteFlashPrice: venteFlashActive ? venteFlashPrice : null,
          flashApplyTarget,
          flashApplyAllCombinations,
          flashCombinationIds,
          flashDiscountType,
          flashDiscountValue,
          flashStartAt,
          flashEndAt,
          minOrderQtyRetail,
          minOrderQtyWholesale,
        },
      });

      res.status(201).json(newProduct);
    } catch (err: any) {
      console.error("âŒ Error creating product:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* -----------------------------------------------------------
 * âœï¸ PATCH /products/:id â€” update
 * ----------------------------------------------------------*/
router.patch(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = { ...(req.body ?? {}) };
      delete (data as any).nouveautesUntil;

      const tags =
        typeof data.tags === "string" ? JSON.parse(data.tags) : data.tags;
      const variantsRaw =
        typeof data.variants === "string"
          ? JSON.parse(data.variants)
          : data.variants;
      const combinationsRaw =
        typeof data.combinations === "string"
          ? JSON.parse(data.combinations)
          : data.combinations;
      const variants = ensureVariantIds(variantsRaw);
      const combinations = normalizeCombinations(combinationsRaw, variants);
      const images =
        typeof data.images === "string" ? JSON.parse(data.images) : data.images;
      const shippingPrice = toNumberOrNull(data.shippingPrice);
      const pricePiece = toNumberOrNull(data.pricePiece);
      const priceQuantity = toNumberOrNull(data.priceQuantity);
      const availableQuantity = toNumberOrNull(data.availableQuantity);
      const saleType = data.saleType;
      const venteFlashActive = parseBooleanValue(data.venteFlashActive);
      const venteFlashPercentage = toNumberOrNull(data.venteFlashPercentage);
      const flashApplyTarget =
        data.flashApplyTarget === "combinations" ? "combinations" : "product";
      const flashApplyAllCombinations = parseBooleanValue(
        data.flashApplyAllCombinations ?? true
      );
      const flashCombinationIds =
        typeof data.flashCombinationIds === "string"
          ? JSON.parse(data.flashCombinationIds)
          : Array.isArray(data.flashCombinationIds)
            ? data.flashCombinationIds
            : [];
      const flashDiscountType =
        data.flashDiscountType === "fixed" ? "fixed" : "percent";
      const flashDiscountValue = toNumberOrNull(data.flashDiscountValue);
      const flashStartAt = data.flashStartAt ? new Date(data.flashStartAt) : null;
      const flashEndAt = data.flashEndAt ? new Date(data.flashEndAt) : null;
      const comboMinPrice = minCombinationPrice(combinations);
      const flashBase = comboMinPrice ?? resolveFlashBasePrice({
        saleType,
        pricePiece,
        priceQuantity,
      });
      const venteFlashPrice = calculateVenteFlashPrice(
        flashBase,
        flashDiscountType === "fixed" ? flashDiscountValue : venteFlashPercentage,
        venteFlashActive,
        flashDiscountType
      );

      const stockDerived = deriveStockFromCombinations(
        combinations,
        availableQuantity
      );

      // Build payload with only explicitly provided fields
      // This prevents partial updates (like visibility toggle) from resetting other fields
      const payload: any = {};

      // Copy only explicitly sent fields from data (cleaned of undefined values)
      const cleanedData = cleanProductPayload(data);

      // Simple text/boolean fields - only include if explicitly provided
      if (data.title !== undefined) {
        payload.title = data.title;
        payload.slug = slugify(data.title);
      }
      if (data.productId !== undefined) payload.productId = data.productId || null;
      if (data.category !== undefined) payload.category = data.category;
      if (data.subCategory !== undefined) payload.subCategory = data.subCategory || null;
      if (data.description !== undefined) payload.description = data.description;
      if (data.status !== undefined) payload.status = data.status;
      if (data.shippingWeight !== undefined) payload.shippingWeight = data.shippingWeight || null;
      if (data.dimensions !== undefined) payload.dimensions = data.dimensions || null;

      // Visibility - only include if explicitly provided
      if (data.visible !== undefined) {
        payload.visible = parseBooleanValue(data.visible);
      }

      // Prices - only include if explicitly provided
      if (data.pricePiece !== undefined) payload.pricePiece = pricePiece;
      if (data.priceQuantity !== undefined) payload.priceQuantity = priceQuantity;
      if (data.shippingPrice !== undefined) payload.shippingPrice = shippingPrice;
      if (data.saleType !== undefined) payload.saleType = saleType;

      // Stock - only recalculate if combinations or quantity were provided
      const stockWasProvided = data.combinations !== undefined || data.availableQuantity !== undefined;
      if (stockWasProvided) {
        payload.availableQuantity = stockDerived.availableQuantity;
        payload.inStock = stockDerived.inStock;
      } else if (data.inStock !== undefined) {
        // Allow direct inStock override
        payload.inStock = parseBooleanValue(data.inStock);
      }

      // Arrays - only include if explicitly provided
      if (data.tags !== undefined) payload.tags = tags || [];
      if (data.variants !== undefined) payload.variants = variants || [];
      if (data.combinations !== undefined) payload.combinations = combinations || [];
      if (data.images !== undefined) payload.images = images || [];

      // Vente Flash - only include if any flash field was provided
      const flashWasProvided = data.venteFlashActive !== undefined
        || data.venteFlashPercentage !== undefined
        || data.flashDiscountType !== undefined
        || data.flashDiscountValue !== undefined
        || data.flashApplyTarget !== undefined
        || data.flashCombinationIds !== undefined
        || data.flashStartAt !== undefined
        || data.flashEndAt !== undefined;

      if (flashWasProvided) {
        payload.venteFlashActive = venteFlashActive;
        payload.venteFlashPercentage = venteFlashActive ? venteFlashPercentage : null;
        payload.venteFlashPrice = venteFlashActive ? venteFlashPrice : null;
        payload.flashApplyTarget = flashApplyTarget;
        payload.flashApplyAllCombinations = flashApplyAllCombinations;
        payload.flashCombinationIds = flashCombinationIds;
        payload.flashDiscountType = flashDiscountType;
        payload.flashDiscountValue = flashDiscountValue;
        payload.flashStartAt = flashStartAt;
        payload.flashEndAt = flashEndAt;
      }

      // Handle publishAt field
      if (data.publishAt !== undefined) {
        payload.publishAt = data.publishAt ? new Date(data.publishAt) : null;
      } else if (data.availableFromDate !== undefined) {
        // Backward compatibility: support old field name during transition
        payload.publishAt = data.availableFromDate ? new Date(data.availableFromDate) : null;
      }

      // MinOrderQty fields - only include if explicitly provided
      if (data.minOrderQtyRetail !== undefined) {
        payload.minOrderQtyRetail = Math.max(1, toNumberOrNull(data.minOrderQtyRetail) ?? 1);
      }
      if (data.minOrderQtyWholesale !== undefined) {
        payload.minOrderQtyWholesale = Math.max(1, toNumberOrNull(data.minOrderQtyWholesale) ?? 1);
      }

      const updated = await prisma.product.update({
        where: { id },
        data: payload,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("❌ Error updating product:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

/* -----------------------------------------------------------
 * 🗑️ DELETE /products/:id — delete
 * ----------------------------------------------------------*/
router.delete(
  "/:id",
  clerkAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      await prisma.product.delete({ where: { id } });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("âŒ Error deleting product:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// /low-stock route moved before /:id to fix route matching

export default router;
