/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/pages/ProductDetail.tsx */
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import api from "@/lib/api";
import { buildProductPath, extractIdFromSlug } from "@/lib/utils";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/components/CartContext";
import { useWishlist } from "@/components/WishlistContext";
import { Heart } from "lucide-react";
import {
  resolveDisplayPriceWithFlash,
  formatPriceTND,
} from "@/lib/price";
import { trackViewItem, mapProductToGA4Item } from "@/lib/analytics";
import { ProductDetailSkeleton } from "@/components/skeletons";
// GEO + SEO imports
import SEOHead, { getProductSchema, getBreadcrumbSchema, getFAQSchema } from "@/components/SEOHead";
import { ProductShippingInfo, BackToCategoryLink } from "@/components/GEOContentBlocks";
import FAQSection, { productFAQs } from "@/components/FAQSection";
import RelatedProducts from "@/components/RelatedProducts";

type Variant = {
  id: string;
  type: string;
  values: string[];
};

type Combination = {
  id: string;
  options: Record<string, string>;
  price?: number | null; // legacy
  pricePiece?: number | null;
  priceQuantity?: number | null;
  stock?: number | null;
  images?: string[];
  // Minimum order quantity overrides
  minOrderQtyRetail?: number | null;
  minOrderQtyWholesale?: number | null;
};

type Product = {
  id: number | string;
  title: string;
  description?: string;
  category?: string;
  images?: string[];
  inStock: boolean;
  saleType: "piece" | "quantity" | "both";
  pricePiece?: number | null;
  priceQuantity?: number | null;
  displayPrice?: number | null;
  displayFlashPrice?: number | null;
  venteFlashActive?: boolean;
  venteFlashPercentage?: number | null;
  flashApplyTarget?: "product" | "combinations";
  flashApplyAllCombinations?: boolean;
  flashCombinationIds?: string[];
  flashDiscountType?: "percent" | "fixed";
  flashDiscountValue?: number | null;
  flashStartAt?: string | null;
  flashEndAt?: string | null;
  availableQuantity?: number | null;
  shippingPrice?: number | null;
  colors?: { name: string; hex: string }[];
  sizes?: string[];
  rating?: number;
  variants?: Variant[];
  combinations?: Combination[];
  // Minimum order quantity fields
  minOrderQtyRetail?: number | null;
  minOrderQtyWholesale?: number | null;
};

type Client = {
  id: number;
  purchaseUnit?: "piece" | "quantity";
  clerkId?: string;
  phone?: string;
  name?: string;
  email?: string;
};

type RatingEntry = {
  id: number;
  rating: number;
  comment?: string | null;
  authorName?: string | null;
  createdAt: string;
};

type RatingSummary = {
  average: number;
  total: number;
  recent: RatingEntry[];
};

const placeholderImg = "/placeholder.png";

const isVideo = (url: string) => /\.(mp4|mov|avi|webm)$/i.test(url);

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toHex(nameOrHex: string) {
  if (!nameOrHex) return "#e5e7eb";
  if (nameOrHex.startsWith("#")) return nameOrHex;
  const map: Record<string, string> = {
    black: "#000000",
    white: "#FFFFFF",
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#10b981",
    yellow: "#f59e0b",
    gray: "#6b7280",
    brown: "#8b5e3c",
    pink: "#ec4899",
    purple: "#6366f1",
    navy: "#1e3a8a",
  };
  const key = nameOrHex.toLowerCase().trim();
  return map[key] ?? "#d1d5db";
}

function normalizeImagePath(src?: string | null) {
  if (!src) return "/placeholder.png";
  const s = String(src).trim();
  if (s.length === 0) return "/placeholder.png";

  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/products/uploads/")) return s;
  if (s.startsWith("/uploads/")) return `/products${s}`;
  if (s.startsWith("uploads/")) return `/products/${s}`;
  if (s.startsWith("products/uploads/")) return `/${s}`;
  return `/products/uploads/${s.replace(/^\/+/, "")}`;
}

function findBestCombination(
  selected: Record<string, string>,
  combinations: Combination[]
): Combination | null {
  const entries = Object.entries(selected).filter(([, v]) => !!v);
  let best: Combination | null = null;
  let bestScore = -1;

  for (const combo of combinations) {
    let score = 0;
    let matches = true;
    for (const [vid, val] of entries) {
      const comboVal = combo.options?.[vid];
      if (!comboVal || comboVal !== val) {
        matches = false;
        break;
      }
      score += 1;
    }
    if (!matches) continue;
    if (score > bestScore) {
      best = combo;
      bestScore = score;
    }
  }

  return best;
}

function priceFromSources(
  combo?: Combination | null,
  product?: Product | null
): number {
  const numOrNull = (v: any) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const comboPiece = combo ? numOrNull(combo.pricePiece ?? combo.price) : null;
  const comboQty = combo ? numOrNull(combo.priceQuantity ?? combo.price) : null;
  const basePiece = product ? numOrNull(product.pricePiece) : null;
  const baseQty = product ? numOrNull(product.priceQuantity) : null;
  return (
    comboPiece ??
    comboQty ??
    basePiece ??
    baseQty ??
    0
  );
}

function Rating({ value }: { value: number }) {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {stars.map((s) => (
        <svg
          key={s}
          className={`w-4 h-4 ${s <= Math.round(value) ? "text-yellow-400" : "text-gray-300"
            }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.382 2.455a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.54 1.118l-3.382-2.455a1 1 0 00-1.175 0l-3.382 2.455c-.784.57-1.838-.197-1.54-1.118l1.287-3.97a1 1 0 00-.364-1.118L1.049 9.397c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.287-3.97z" />
        </svg>
      ))}
      <span className="sr-only">{value} sur 5</span>
    </div>
  );
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="cursor-pointer list-none font-semibold py-2 flex items-center justify-between">
        <span>{title}</span>
        <svg
          className="w-5 h-5 text-gray-400 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="text-gray-700 mt-2">{children}</div>
    </details>
  );
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug?: string }>();
  const slugParam = slug ?? "";
  const productIdParam = extractIdFromSlug(slugParam) ?? slugParam;
  const { userId, isLoaded: authLoaded } = useAuth();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  // Track if client data has been loaded (prevents price flicker for quantity buyers)
  // Start as false - we set to true after we know the auth state and fetch client if needed
  const [clientLoaded, setClientLoaded] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [mainImage, setMainImage] = useState<string>("");
  const [mainImageIndex, setMainImageIndex] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(
    null
  );
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingName, setRatingName] = useState("");
  const [ratingEmail, setRatingEmail] = useState("");
  const [viewerReview, setViewerReview] = useState<{
    rating: number;
    comment?: string | null;
  } | null>(null);
  const [ratingMessage, setRatingMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  const makeAbsolute = (p: string) => {
    if (!p) return p;
    if (/^https?:\/\//i.test(p)) return p;
    return `${baseURL.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  };

  const normalizeVariants = (raw: any[]): Variant[] => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v, idx) => {
        const id = String(v.id ?? v.type ?? `var-${idx}`);
        const type = v.type ?? `Option ${idx + 1}`;
        const values = Array.isArray(v.values)
          ? v.values.map((val: any) => String(val))
          : [];
        return { id, type, values };
      })
      .filter((v) => v.values.length > 0);
  };

  const normalizeCombinations = (
    raw: any[],
    normalizeImage: (s: string) => string
  ): Combination[] => {
    if (!Array.isArray(raw)) return [];
    const genId = () =>
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `combo-${Math.random().toString(36).slice(2)}`;
    return raw.map((c) => {
      const options: Record<string, string> =
        typeof c?.options === "object" && c.options !== null
          ? Object.entries(c.options).reduce<Record<string, string>>(
            (acc, [k, v]) => {
              if (v === undefined || v === null) return acc;
              acc[String(k)] = String(v);
              return acc;
            },
            {}
          )
          : {};
      return {
        id: String(c?.id ?? genId()),
        options,
        price:
          c?.price === undefined || c?.price === null ? null : Number(c.price),
        pricePiece:
          c?.pricePiece === undefined || c?.pricePiece === null
            ? c?.price ?? null
            : Number(c.pricePiece),
        priceQuantity:
          c?.priceQuantity === undefined || c?.priceQuantity === null
            ? null
            : Number(c.priceQuantity),
        stock:
          c?.stock === undefined || c?.stock === null ? null : Number(c.stock),
        images: Array.isArray(c?.images)
          ? c.images
            .filter(Boolean)
            .map((img: any) => normalizeImage(String(img)))
          : [],
      };
    });
  };

  // Reset clientLoaded when userId changes (login/logout)
  useEffect(() => {
    // If auth is loaded and there's no userId, mark client as loaded (no client to fetch)
    // If there's a userId, we'll set clientLoaded to true after fetching
    if (authLoaded && !userId) {
      setClientLoaded(true);
    } else if (!authLoaded) {
      setClientLoaded(false);
    }
  }, [authLoaded, userId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);

        let clientData: Client | null = null;
        if (userId) {
          const fetchClient = async () => {
            try {
              const res = await api.get("/clients/current", {
                params: { clerkId: userId },
              });
              return res.data as Client;
            } catch (err: any) {
              if (err?.response?.status !== 404) {
                console.warn(
                  "ProductDetail: /clients/current failed:",
                  err?.response?.data ?? err?.message ?? err
                );
              }
            }
            try {
              const res = await api.get("/clients/me");
              return res.data as Client;
            } catch (err: any) {
              console.warn(
                "ProductDetail: /clients/me failed (optional):",
                err?.response?.data ?? err?.message ?? err
              );
              return null;
            }
          };
          clientData = await fetchClient();
          if (mounted) {
            setClient(clientData);
            setClientLoaded(true);
          }
        }

        if (!productIdParam) return;

        const params = new URLSearchParams();
        if (clientData?.id) params.append("clientId", String(clientData.id));
        else if (userId) params.append("clerkId", userId);

        const res = await api.get(
          `/products/${productIdParam}?${params.toString()}`
        );
        const raw = res.data as any;

        const rawImages = Array.isArray(raw.images) ? raw.images : [];
        const normalizedImages = rawImages.length
          ? rawImages.map((img) => makeAbsolute(normalizeImagePath(img)))
          : [makeAbsolute(placeholderImg)];

        const variants = normalizeVariants(raw.variants ?? []);
        const combinations = normalizeCombinations(
          raw.combinations ?? [],
          (img) => makeAbsolute(normalizeImagePath(img))
        );

        let colors = raw.colors;
        let sizes = raw.sizes;
        const colorVar = variants.find(
          (v) => v.type.toLowerCase() === "color"
        );
        if (colorVar) {
          colors = colorVar.values.map((c) => ({ name: c, hex: toHex(c) }));
        }
        const sizeVar = variants.find((v) => v.type.toLowerCase() === "size");
        if (sizeVar) {
          sizes = sizeVar.values;
        }

        const normalizedProduct: Product = {
          id: raw.id,
          title: raw.title ?? "Produit",
          description: raw.description ?? "",
          category: raw.category ?? "",
          images: normalizedImages,
          inStock: raw.inStock ?? true,
          saleType: raw.saleType ?? "piece",
          pricePiece:
            raw.pricePiece === undefined ? null : Number(raw.pricePiece),
          priceQuantity:
            raw.priceQuantity === undefined ? null : Number(raw.priceQuantity),
          displayPrice:
            raw.displayPrice === undefined ? null : Number(raw.displayPrice),
          displayFlashPrice:
            raw.displayFlashPrice === undefined
              ? null
              : Number(raw.displayFlashPrice),
          venteFlashActive: raw.venteFlashActive ?? false,
          venteFlashPercentage:
            raw.venteFlashPercentage === undefined
              ? null
              : Number(raw.venteFlashPercentage),
          // Flash sale fields needed for price calculation
          flashApplyTarget: raw.flashApplyTarget ?? "product",
          flashApplyAllCombinations: raw.flashApplyAllCombinations ?? true,
          flashCombinationIds: raw.flashCombinationIds ?? [],
          flashDiscountType: raw.flashDiscountType ?? "percent",
          flashDiscountValue:
            raw.flashDiscountValue === undefined
              ? null
              : Number(raw.flashDiscountValue),
          flashStartAt: raw.flashStartAt ?? null,
          flashEndAt: raw.flashEndAt ?? null,
          availableQuantity:
            raw.availableQuantity === undefined
              ? null
              : Number(raw.availableQuantity),
          shippingPrice:
            raw.shippingPrice === undefined ? null : Number(raw.shippingPrice),
          colors,
          sizes,
          variants,
          combinations,
          // Load minQty fields
          minOrderQtyRetail: raw.minOrderQtyRetail ?? 1,
          minOrderQtyWholesale: raw.minOrderQtyWholesale ?? 1,
        };

        if (!mounted) return;

        const defaults: Record<string, string> = {};
        variants.forEach((v) => {
          if (v.values.length > 0) defaults[v.id] = v.values[0];
        });

        setProduct(normalizedProduct);
        setSelectedOptions(defaults);
        setMainImage(normalizedImages[0] ?? "");
        setMainImageIndex(0);
        const availableQty =
          typeof normalizedProduct.availableQuantity === "number"
            ? Math.max(0, Math.floor(normalizedProduct.availableQuantity))
            : null;
        const startQty = 1;
        setQuantity(
          availableQty !== null ? Math.min(startQty, availableQty) : startQty
        );
      } catch (err) {
        console.error("load product error", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Wait for auth to be loaded before starting data fetch
    // This ensures we know if the user is logged in and can fetch client data correctly
    if (authLoaded) {
      load();
    }
    return () => {
      mounted = false;
    };
  }, [productIdParam, userId, authLoaded]);

  useEffect(() => {
    if (!product) return;
    if (typeof window === "undefined") return;
    const canonicalPath = buildProductPath({
      id: product.id as number,
      title: product.title,
    });
    if (window.location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true });
    }
  }, [product?.id, product?.title, navigate]);

  const variantIdByType = useMemo(() => {
    const map = new Map<string, string>();
    (product?.variants ?? []).forEach((v) =>
      map.set(v.type.toLowerCase(), v.id)
    );
    return map;
  }, [product?.variants]);

  const variantTypeById = useMemo(() => {
    const map = new Map<string, string>();
    (product?.variants ?? []).forEach((v) => map.set(v.id, v.type));
    return map;
  }, [product?.variants]);

  const activeCombination = useMemo(
    () =>
      product
        ? findBestCombination(selectedOptions, product.combinations ?? [])
        : null,
    [product, selectedOptions]
  );

  const galleryImages = useMemo(() => {
    const base = product?.images ?? [];
    const comboImages = (product?.combinations ?? []).flatMap(
      (c) => c.images ?? []
    );
    const merged = [...base, ...comboImages];
    const seen = new Set<string>();
    const out: string[] = [];
    merged.forEach((img) => {
      if (!img) return;
      if (seen.has(img)) return;
      seen.add(img);
      out.push(img);
    });
    return out.length ? out : [placeholderImg];
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const comboImg = activeCombination?.images?.[0];
    if (comboImg) {
      setMainImage(comboImg);
      setMainImageIndex(0);
      return;
    }
    if (product.images && product.images.length) {
      setMainImage(product.images[0]);
      setMainImageIndex(0);
    } else if (galleryImages.length) {
      setMainImage(galleryImages[0]);
      setMainImageIndex(0);
    }
  }, [activeCombination, product, galleryImages]);

  useEffect(() => {
    if (client?.name) {
      setRatingName((prev) => (prev ? prev : client.name ?? ""));
    }
    if (client?.email) {
      setRatingEmail((prev) => (prev ? prev : client.email ?? ""));
    }
  }, [client]);

  const fetchRatings = useCallback(async () => {
    if (!productIdParam) return;
    setRatingsLoading(true);
    try {
      const res = await api.get(`/products/${productIdParam}/ratings`, {
        params: userId ? { clerkId: userId } : undefined,
      });
      const summary: RatingSummary = res.data?.summary ?? {
        average: 0,
        total: 0,
        recent: [],
      };
      setRatingSummary(summary);

      const viewer = res.data?.viewer ?? null;
      if (viewer) {
        setViewerReview({ rating: viewer.rating, comment: viewer.comment });
        setPendingRating(viewer.rating);
        setRatingComment(viewer.comment ?? "");
        if (viewer.authorName) {
          setRatingName((prev) =>
            prev?.trim().length ? prev : viewer.authorName ?? ""
          );
        }
        if (viewer.authorEmail) {
          setRatingEmail((prev) =>
            prev?.trim().length ? prev : viewer.authorEmail ?? ""
          );
        }
      } else {
        setViewerReview(null);
        if (!summary.total) {
          setPendingRating(0);
          setRatingComment("");
        }
      }
    } catch (err) {
      console.warn("Failed to load ratings", err);
      setRatingSummary(null);
    } finally {
      setRatingsLoading(false);
    }
  }, [productIdParam, userId]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  const handleSubmitRating = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!productIdParam) return;
    if (!pendingRating) {
      setRatingMessage({
        type: "error",
        text: "Sélectionnez une note avant d'envoyer.",
      });
      return;
    }

    setSubmittingRating(true);
    setRatingMessage(null);
    try {
      await api.post(`/products/${productIdParam}/ratings`, {
        rating: pendingRating,
        comment: ratingComment.trim() || undefined,
        authorName: ratingName.trim() || undefined,
        authorEmail: ratingEmail.trim() || undefined,
        clerkUserId: userId ?? undefined,
      });
      setRatingMessage({
        type: "success",
        text: viewerReview
          ? "Votre avis a été mis à jour."
          : "Merci pour votre avis !",
      });
      await fetchRatings();
    } catch (err: any) {
      const message =
        err?.response?.data?.error ??
        "Impossible d'enregistrer votre avis pour le moment.";
      setRatingMessage({ type: "error", text: message });
    } finally {
      setSubmittingRating(false);
    }
  };

  const isQuantityBuyer = client?.purchaseUnit === "quantity";
  const clientUnit: "piece" | "quantity" =
    client?.purchaseUnit === "quantity" ? "quantity" : "piece";
  const priceInfo = useMemo(
    () =>
      resolveDisplayPriceWithFlash(
        product,
        activeCombination,
        clientUnit
      ),
    [product, activeCombination, clientUnit]
  );
  const price = priceInfo.price ?? 0;
  const baseDisplayPrice = priceInfo.basePrice ?? price;
  const isFlashApplied =
    priceInfo.flashApplied && price !== null && price < baseDisplayPrice;

  // Ref to track if we've fired view_item for this product
  const hasTrackedViewItem = useRef(false);
  const lastTrackedProductId = useRef<number | string | null>(null);

  // GA4: Track view_item when product loads (no PII - only product identifiers)
  useEffect(() => {
    if (
      product &&
      !loading &&
      price > 0 &&
      (!hasTrackedViewItem.current || lastTrackedProductId.current !== product.id)
    ) {
      hasTrackedViewItem.current = true;
      lastTrackedProductId.current = product.id;

      const selectionLabel = Object.entries(selectedOptions)
        .filter(([, v]) => !!v)
        .map(([k, v]) => `${variantTypeById.get(k) ?? k}: ${v}`)
        .join(" / ");

      trackViewItem(
        mapProductToGA4Item(
          {
            id: product.id,
            title: product.title,
            category: product.category,
            displayPrice: price,
          },
          1,
          selectionLabel || undefined
        ),
        price
      );
    }
  }, [product, loading, price, selectedOptions]);

  // Dynamic minQty calculation: uses product's minOrderQty fields with combination overrides
  const minQty = useMemo(() => {
    // Base minQty from product level based on purchase mode
    const baseMin = isQuantityBuyer
      ? (product?.minOrderQtyWholesale ?? 1)
      : (product?.minOrderQtyRetail ?? 1);

    // Check for combination override
    if (activeCombination) {
      const comboMin = isQuantityBuyer
        ? activeCombination.minOrderQtyWholesale
        : activeCombination.minOrderQtyRetail;

      if (typeof comboMin === 'number' && comboMin >= 1) {
        return comboMin;
      }
    }

    return Math.max(1, baseMin);
  }, [product, activeCombination, isQuantityBuyer]);

  const comboStock =
    activeCombination?.stock === undefined || activeCombination?.stock === null
      ? null
      : Number(activeCombination.stock);
  const availableQty =
    comboStock !== null
      ? Math.max(0, Math.floor(comboStock))
      : typeof product?.availableQuantity === "number"
        ? Math.max(0, Math.floor(product.availableQuantity))
        : null;
  const hasFiniteStock = availableQty !== null;
  const numericAvailable = availableQty ?? 0;
  const insufficientForMinOrder =
    hasFiniteStock && numericAvailable > 0 && numericAvailable < minQty;
  const stockDepleted =
    !product?.inStock || (hasFiniteStock && numericAvailable === 0);
  const stockBlocked = stockDepleted || insufficientForMinOrder;
  const maxOrderableQty = hasFiniteStock
    ? numericAvailable
    : Number.MAX_SAFE_INTEGER;
  const cartMaxQty = hasFiniteStock ? numericAvailable : undefined;
  const lowStockMessage =
    hasFiniteStock && numericAvailable > 0 && numericAvailable <= 5
      ? `Plus que ${numericAvailable} en stock`
      : null;

  useEffect(() => {
    if (!product) return;

    if (!hasFiniteStock) {
      setStockWarning(null);
      setQuantity((prev) => Math.max(minQty, prev));
      return;
    }

    if (numericAvailable === 0) {
      setStockWarning("Ce produit est actuellement en rupture de stock.");
      setQuantity(minQty);
      return;
    }

    setQuantity((prev) => {
      const next = Math.min(Math.max(minQty, prev), maxOrderableQty);
      return next;
    });

    if (insufficientForMinOrder) {
      setStockWarning(
        `Stock insuffisant : minimum ${minQty} requis mais seulement ${numericAvailable} disponibles.`
      );
    } else {
      setStockWarning(null);
    }
  }, [
    product?.id,
    hasFiniteStock,
    numericAvailable,
    minQty,
    maxOrderableQty,
    insufficientForMinOrder,
  ]);

  // Format category name for SEO (moved before early return for hooks consistency)
  const formatCategoryName = (slug?: string): string => {
    if (!slug) return "Produits";
    const map: Record<string, string> = {
      'decoration': 'Décoration',
      'sacs': 'Sacs & accessoires',
      'art-de-la-table': 'Art de la table',
      'nouveautes': 'Nouveautés',
      'cuisine': 'Cuisine',
    };
    return map[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const displayCategoryName = formatCategoryName(product?.category);
  const productUrl = `https://follacouffin.tn/product/${slugParam}`;

  // JSON-LD schemas (must be called before early return to maintain consistent hook order)
  const productSchema = useMemo(() => {
    if (!product) return null;
    return getProductSchema({
      name: product.title,
      description: product.description || `${product.title} - Artisanat tunisien fait main par FollaCouffin.`,
      image: galleryImages.length > 0 ? galleryImages : [mainImage],
      price: price,
      currency: "TND",
      availability: product.inStock ? "InStock" : "OutOfStock",
      category: displayCategoryName,
      url: productUrl,
      ratingValue: (ratingSummary?.average ?? 0) > 0 ? ratingSummary?.average : undefined,
      reviewCount: (ratingSummary?.total ?? 0) > 0 ? ratingSummary?.total : undefined,
    });
  }, [product, price, galleryImages, mainImage, displayCategoryName, productUrl, ratingSummary]);

  const breadcrumbSchema = useMemo(() => {
    if (!product) return null;
    return getBreadcrumbSchema([
      { name: 'Accueil', url: 'https://follacouffin.tn/' },
      ...(product.category ? [{ name: displayCategoryName, url: `https://follacouffin.tn/category/${product.category}` }] : []),
      { name: product.title, url: productUrl }
    ]);
  }, [product, displayCategoryName, productUrl]);

  // Wait for auth to load, product, and client data (if user is logged in) before showing content
  // This prevents price flicker for quantity buyers
  if (!authLoaded || loading || !product || !clientLoaded) {
    return (
      <div className="min-h-screen flex flex-col" role="status" aria-busy="true">
        <Header products={[]} />
        <ProductDetailSkeleton />
        <Footer />
      </div>
    );
  }

  const handleSelectImage = (index: number) => {
    if (!galleryImages.length) return;
    const safeIndex = Math.max(0, Math.min(index, galleryImages.length - 1));
    setMainImage(galleryImages[safeIndex]);
    setMainImageIndex(safeIndex);
  };

  const handlePrevImage = () => {
    if (galleryImages.length <= 1) return;
    const nextIndex =
      (mainImageIndex - 1 + galleryImages.length) % galleryImages.length;
    setMainImage(galleryImages[nextIndex]);
    setMainImageIndex(nextIndex);
  };

  const handleNextImage = () => {
    if (galleryImages.length <= 1) return;
    const nextIndex = (mainImageIndex + 1) % galleryImages.length;
    setMainImage(galleryImages[nextIndex]);
    setMainImageIndex(nextIndex);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      let next = Math.max(minQty, prev + delta);
      if (hasFiniteStock) {
        next = Math.min(next, maxOrderableQty);
      }
      if (hasFiniteStock && delta > 0 && next >= maxOrderableQty) {
        setStockWarning(
          `Stock limité : ${maxOrderableQty} ${maxOrderableQty > 1 ? "unités" : "unité"
          } disponibles.`
        );
      } else if (!insufficientForMinOrder) {
        setStockWarning(null);
      }
      return next;
    });
  };

  const otherVariants =
    product.variants?.filter(
      (v: any) =>
        v?.type &&
        !["Color", "color", "Size", "size"].includes(String(v.type)) &&
        Array.isArray(v.values) &&
        v.values.length > 0
    ) ?? [];

  const needsColor =
    !!product.colors?.length ||
    (product.variants ?? []).some(
      (v) => v.type.toLowerCase() === "color" && v.values.length
    );
  const needsSize =
    !!product.sizes?.length ||
    (product.variants ?? []).some(
      (v) => v.type.toLowerCase() === "size" && v.values.length
    );

  const selectedColor = (() => {
    const vid = variantIdByType.get("color");
    return vid ? selectedOptions[vid] ?? null : null;
  })();
  const selectedSize = (() => {
    const vid = variantIdByType.get("size");
    return vid ? selectedOptions[vid] ?? null : null;
  })();

  const canAdd =
    product.inStock &&
    (!needsColor || !!selectedColor) &&
    (!needsSize || !!selectedSize) &&
    otherVariants.every((v) => {
      const vid = variantIdByType.get(String(v.type).toLowerCase());
      return vid ? selectedOptions[vid] : false;
    }) &&
    !stockBlocked;

  const doAddToCart = async (item: any) => {
    try {
      const result = addToCart(item);
      if (result && typeof (result as any).then === "function") {
        await result;
      } else {
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      console.error("addToCart failed", err);
      throw err;
    }
  };

  const selectionSummary = Object.entries(selectedOptions)
    .filter(([, v]) => !!v)
    .map(([k, v]) => `${variantTypeById.get(k) ?? k}: ${v}`)
    .join(" / ");

  const handleAddToCart = async () => {
    if (!canAdd) return;
    const item = {
      productId: product.id,
      title: product.title,
      unitPrice: price,
      pricingMode: "piece" as const,
      selectedOptions,
      combinationId: activeCombination?.id,
      image: mainImage || galleryImages[0],
      quantity,
      variantLabel: selectionSummary || undefined,
      minQty,
      maxQty: cartMaxQty,
      shippingPrice: product.shippingPrice ?? undefined,
      rating: ratingSummary?.average,
      ratingCount: ratingSummary?.total,
    };

    await doAddToCart(item);
  };

  const handleBuyNow = async () => {
    if (!canAdd) return;
    const item = {
      productId: product.id,
      title: product.title,
      unitPrice: price,
      pricingMode: "piece" as const,
      selectedOptions,
      combinationId: activeCombination?.id,
      image: mainImage || galleryImages[0],
      quantity,
      variantLabel: selectionSummary || undefined,
      minQty,
      maxQty: cartMaxQty,
      shippingPrice: product.shippingPrice ?? undefined,
      rating: ratingSummary?.average,
      ratingCount: ratingSummary?.total,
    };

    try {
      await doAddToCart(item);
      navigate("/checkout", { state: { buyNowItems: [item] } });
    } catch (err) {
      console.error("Buy now failed", err);
    }
  };

  const ratingAverage = ratingSummary?.average ?? 0;
  const ratingTotal = ratingSummary?.total ?? 0;
  const hasRatings = ratingTotal > 0;
  const displayedReviews = ratingSummary?.recent ?? [];
  const viewerPrompt = viewerReview
    ? "Vous avez déjà partagé un avis. Vous pouvez le mettre à jour ci-dessous."
    : "Partagez votre expérience avec cette pièce.";

  const saleTypeLabel =
    product.saleType === "piece"
      ? "À l'unité"
      : product.saleType === "quantity"
        ? "En gros"
        : "À l'unité et en gros";

  // Rating values for display (formatCategoryName, displayCategoryName, productUrl, productSchema, breadcrumbSchema moved before early return)

  return (
    <div className="bg-white min-h-screen">
      {/* SEO Head with Product + Breadcrumb JSON-LD */}
      <SEOHead
        title={`${product.title} \u2013 ${displayCategoryName} artisanal | FollaCouffin`}
        description={`${product.title} : ${(product.description || 'Produit artisanal tunisien fait main').substring(0, 120)}. Prix : ${formatPriceTND(price)}. Livraison partout en Tunisie.`}
        canonicalUrl={productUrl}
        ogImage={mainImage || undefined}
        type="product"
        jsonLd={[productSchema, breadcrumbSchema]}
      />

      <Header products={[]} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* GEO: Lien retour vers la cat\u00e9gorie */}
        {product.category && (
          <BackToCategoryLink
            categorySlug={product.category}
            categoryName={displayCategoryName}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start ">
          {/* IMAGES COLUMN */}
          <section className="flex flex-col lg:flex-row gap-6 p-4">
            <div className="hidden lg:flex flex-col gap-3 w-28 px-3 border-r border-gray-100 overflow-y-auto max-h-[560px] pt-3">
              {galleryImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => handleSelectImage(i)}
                  aria-label={`Afficher l'image ${i + 1}`}
                  className={`w-full flex-none p-1 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${mainImage === img ? "ring-2 ring-black" : "hover:shadow-sm"
                    }`}
                >
                  <div className="w-full h-20 overflow-hidden rounded-md">
                    {isVideo(img) ? (
                      <video
                        src={img}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={img}
                        alt={`${product.title} ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 relative flex items-center justify-center bg-gray-50 rounded-md p-6 shadow-sm">
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    aria-label="Image précédente"
                    className="flex absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2  z-10"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-5 w-5"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    aria-label="Image suivante"
                    className="flex absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2  z-10"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-5 w-5"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </>
              )}
              <div className="w-full h-full max-h-[560px] max-w-[720px] flex items-center justify-center overflow-hidden">
                {isVideo(mainImage) ? (
                  <video
                    src={mainImage}
                    controls
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <img
                    src={mainImage}
                    alt={product.title}
                    className="max-w-full max-h-full object-contain transition-transform duration-300 hover:scale-105"
                    loading="lazy"
                  />
                )}
              </div>
            </div>

            <div className="lg:hidden flex gap-3 overflow-x-auto pt-1 pb-2 px-1 -mx-1">
              {galleryImages.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  onClick={() => handleSelectImage(i)}
                  aria-label={`Afficher l'image ${i + 1}`}
                  className={`flex-none w-24 h-24 rounded-md border bg-white p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 ${mainImage === img
                    ? "ring-2 ring-black"
                    : "hover:shadow-sm border-gray-200"
                    }`}
                >
                  {isVideo(img) ? (
                    <video
                      src={img}
                      className="w-full h-full object-cover rounded-sm"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={img}
                      alt={`${product.title} ${i + 1}`}
                      className="w-full h-full object-cover rounded-sm"
                      loading="lazy"
                    />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900">
                  {product.title}
                </h1>
                <div className="mt-2 flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatPriceTND(price)}
                  </div>
                  {isFlashApplied && (
                    <span className="text-lg text-gray-400 line-through">
                      {formatPriceTND(baseDisplayPrice)}
                    </span>
                  )}
                  {isFlashApplied && (
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-orange-700">
                      Vente flash
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Catégorie : {product.category ?? "Non spécifiée"}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Rating value={ratingAverage} />
                  <span className="text-sm text-gray-600">
                    {hasRatings
                      ? `${ratingAverage.toFixed(1)} / 5 (${ratingTotal} avis)`
                      : "Pas encore d'avis"}
                  </span>
                </div>
                {product.venteFlashActive && (
                  <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold uppercase tracking-wide text-orange-600">
                        Vente flash en cours
                      </span>
                      {product.venteFlashPercentage !== null && (
                        <span className="text-base font-bold text-orange-600">
                          -{product.venteFlashPercentage}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      Prix spécial limité dans le temps. Ajoutez ce produit à
                      votre panier avant la fin de l'offre.
                    </p>
                    <p className="text-xs text-gray-500">
                      {hasFiniteStock && numericAvailable > 0
                        ? `${numericAvailable} ${numericAvailable > 1
                          ? "articles restants"
                          : "article restant"
                        }`
                        : "Quantités limitées pendant cette vente."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              {product.inStock ? (
                <div className="inline-flex items-center text-green-700 bg-green-50 px-3 py-1 rounded-full text-sm">
                  En stock
                </div>
              ) : (
                <div className="inline-flex items-center text-red-700 bg-red-50 px-3 py-1 rounded-full text-sm">
                  Rupture de stock
                </div>
              )}
            </div>

            {needsColor && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Couleur
                </div>
                <div className="flex items-center gap-3">
                  {(product.colors ?? []).map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        const vid = variantIdByType.get("color");
                        if (vid) setSelectedOptions((p) => ({ ...p, [vid]: c.name }));
                      }}
                      aria-pressed={selectedColor === c.name}
                      title={c.name}
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center focus:outline-none ${selectedColor === c.name
                        ? "ring-2 ring-offset-2 ring-black"
                        : "border-gray-200"
                        }`}
                      style={{ backgroundColor: toHex(c.hex) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {needsSize && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Taille
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(product.sizes ?? []).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        const vid = variantIdByType.get("size");
                        if (vid) setSelectedOptions((p) => ({ ...p, [vid]: s }));
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium border transition ${selectedSize === s
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      aria-pressed={selectedSize === s}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {otherVariants.length > 0 && (
              <div className="space-y-3">
                {otherVariants.map((v) => {
                  const vid = variantIdByType.get(String(v.type).toLowerCase());
                  const selectedVal = vid ? selectedOptions[vid] : null;
                  return (
                    <div key={v.type}>
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {v.type}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {v.values.map((val: string) => {
                          const selected = selectedVal === val;
                          return (
                            <button
                              key={val}
                              onClick={() =>
                                vid &&
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [vid]: val,
                                }))
                              }
                              className={`px-3 py-2 rounded-md text-sm border transition ${selected
                                ? "bg-black text-white border-black"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                }`}
                              aria-pressed={selected}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-6">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Quantité
                </div>
                <div className="flex items-center border border-gray-200 rounded-md overflow-hidden w-36">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    className="px-3 py-2 hover:bg-gray-100 disabled:opacity-40"
                    disabled={quantity <= minQty}
                    aria-label="Réduire la quantité"
                  >
                    -
                  </button>
                  <input
                    className="w-12 text-center border-0 focus:outline-none bg-transparent"
                    value={quantity}
                    readOnly
                    aria-label="Quantité"
                  />
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="px-3 py-2 hover:bg-gray-100 disabled:opacity-40"
                    disabled={hasFiniteStock && quantity >= maxOrderableQty}
                    aria-label="Augmenter la quantité"
                  >
                    +
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Commande minimale : {minQty}
                </div>
                {lowStockMessage && (
                  <div className="text-xs text-orange-500 mt-1">
                    {lowStockMessage}
                  </div>
                )}
                {insufficientForMinOrder && availableQty !== null && (
                  <div className="text-xs text-red-500 mt-1">
                    Minimum {minQty} requis mais seulement {availableQty} en
                    stock.
                  </div>
                )}
                {stockWarning && !insufficientForMinOrder && (
                  <div className="text-xs text-amber-600 mt-1">
                    {stockWarning}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!canAdd}
                className="flex-1 min-w-0 border border-gray-300 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-medium bg-white hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm whitespace-nowrap"
              >
                Ajouter au panier
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!canAdd}
                className="flex-1 min-w-0 bg-gradient-to-r from-gray-800 to-gray-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-medium hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md whitespace-nowrap"
              >
                Acheter maintenant
              </button>
              {/* Wishlist Heart Button */}
              <button
                onClick={() => {
                  const inWishlist = isInWishlist(String(product.id));
                  toggleWishlist({
                    productId: String(product.id),
                    title: product.title,
                    price: price,
                    image: mainImage || galleryImages[0],
                  });
                }}
                className={`p-3 border rounded-md transition-colors ${isInWishlist(String(product.id))
                  ? "bg-black text-white border-black"
                  : "border-gray-300 hover:border-black"
                  }`}
                aria-label={isInWishlist(String(product.id)) ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Heart
                  className={`w-5 h-5 ${isInWishlist(String(product.id)) ? "fill-white text-white" : "text-gray-600"
                    }`}
                />
              </button>
            </div>

            {/* GEO: Bloc Livraison en Tunisie */}
            <ProductShippingInfo />

            <div className="border-t border-gray-100 pt-6 space-y-4">
              <Accordion title="Description" defaultOpen>
                {product.description ? (
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                ) : (
                  <p>Aucune description disponible.</p>
                )}
              </Accordion>
              <Accordion title="Expédition & Logistique">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Poids du colis (kg)</span>
                    <span className="font-medium text-gray-900">
                      {(product as any).shippingWeight || "Non spécifié"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Dimensions du produit</span>
                    <span className="font-medium text-gray-900">
                      {(product as any).dimensions || "Non spécifié"}
                    </span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-gray-600">
                      Livraison standard offerte dès 100 DT d'achat. Retours acceptés sous 30 jours.
                    </p>
                  </div>
                </div>
              </Accordion>
              <Accordion title="Avis clients">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Rating value={ratingAverage} />
                    <div className="text-sm text-gray-600">
                      {hasRatings
                        ? `${ratingAverage.toFixed(1)} / 5 (${ratingTotal} avis)`
                        : "Pas encore d'avis pour ce produit"}
                    </div>
                  </div>
                  <div className="flex flex-col gap-8 lg:flex-row">
                    <div className="lg:w-1/2 space-y-4">
                      {ratingsLoading ? (
                        <p className="text-sm text-gray-500 mt-2">
                          Chargement des avis...
                        </p>
                      ) : hasRatings ? (
                        <div className="space-y-4 mt-4">
                          {displayedReviews.map((entry) => (
                            <div
                              key={entry.id}
                              className="border border-gray-100 rounded-lg p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-gray-800">
                                  {entry.authorName || "Client"}
                                </div>
                                <Rating value={entry.rating} />
                              </div>
                              {entry.comment && (
                                <p className="text-sm text-gray-600 mt-2">
                                  {entry.comment}
                                </p>
                              )}
                              <div className="text-xs text-gray-400 mt-2">
                                {formatReviewDate(entry.createdAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mt-2">
                          Aucun avis pour le moment. Soyez le premier à donner
                          votre avis !
                        </p>
                      )}
                    </div>

                    <div className="lg:w-1/2 border border-gray-100 rounded-lg p-4">
                      <h4 className="text-base font-semibold text-black">
                        Donnez votre avis
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {viewerPrompt}
                      </p>
                      <form
                        onSubmit={handleSubmitRating}
                        className="space-y-4 mt-4"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-700">
                            Votre note
                          </span>
                          <div className="flex items-center gap-1 mt-2">
                            {[1, 2, 3, 4, 5].map((value) => (
                              <button
                                type="button"
                                key={value}
                                onClick={() => {
                                  setPendingRating(value);
                                  setRatingMessage(null);
                                }}
                                className="p-1"
                                aria-label={`Donner ${value} etoile${value > 1 ? "s" : ""
                                  }`}
                              >
                                <svg
                                  className={`w-6 h-6 ${value <= pendingRating
                                    ? "text-amber-500"
                                    : "text-gray-300"
                                    }`}
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.382 2.455a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.54 1.118l-3.382-2.455a1 1 0 00-1.175 0l-3.382 2.455c-.784.57-1.838-.197-1.54-1.118l1.287-3.97a1 1 0 00-.364-1.118L1.049 9.397c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.287-3.97z" />
                                </svg>
                              </button>
                            ))}
                          </div>
                        </div>

                        {!userId && (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs text-gray-500">
                                Nom (optionnel)
                              </label>
                              <input
                                type="text"
                                value={ratingName}
                                onChange={(e) => setRatingName(e.target.value)}
                                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                                placeholder="Votre nom"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">
                                Email (optionnel)
                              </label>
                              <input
                                type="email"
                                value={ratingEmail}
                                onChange={(e) => setRatingEmail(e.target.value)}
                                className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                                placeholder="vous@email.com"
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-xs text-gray-500">
                            Commentaire
                          </label>
                          <textarea
                            value={ratingComment}
                            onChange={(e) => setRatingComment(e.target.value)}
                            rows={4}
                            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                            placeholder="Partagez plus de détails (optionnel)"
                          />
                        </div>

                        {ratingMessage && (
                          <div
                            className={`text-sm ${ratingMessage.type === "error"
                              ? "text-red-600"
                              : "text-green-600"
                              }`}
                          >
                            {ratingMessage.text}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submittingRating || pendingRating === 0}
                          className="w-full bg-black text-white py-2.5 rounded-md font-medium disabled:opacity-50"
                        >
                          {submittingRating
                            ? "Envoi..."
                            : viewerReview
                              ? "Mettre à jour mon avis"
                              : "Envoyer mon avis"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </Accordion>
            </div>
          </section>
        </div>

        {/* You May Also Like Section */}
        <RelatedProducts
          currentProductId={product.id}
          category={product.category}
          purchaseUnit={clientUnit}
        />

        {/* GEO: FAQ Produit */}
        <FAQSection
          title="Questions sur ce produit"
          faqs={productFAQs}
          includeSchema={true}
          className="border-t mt-8"
        />
      </main>

      <Footer />
    </div>
  );
}
