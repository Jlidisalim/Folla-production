/* src/components/RelatedProducts.tsx */
/* Centered slider (scroll-snap) — 2 cards mobile, 3 cards md/lg, custom xl basis (23.333%), Rupture badge bottom-right (responsive) */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { buildProductPath } from "@/lib/utils";
import {
  resolveListingMinPriceWithFlash,
  formatPriceTND,
  PurchaseUnit,
} from "@/lib/price";

interface RelatedProduct {
  id: number | string;
  title: string;
  images?: string[];
  displayPrice?: number | string;
  pricePiece?: number;
  priceQuantity?: number;
  combinations?: any[];
  venteFlashPercentage?: number | string;
  venteFlashActive?: boolean;
  flashApplyTarget?: "product" | "combinations";
  flashApplyAllCombinations?: boolean;
  flashCombinationIds?: string[];
  flashDiscountType?: "percent" | "fixed";
  flashDiscountValue?: number | string | null;
  flashStartAt?: string | Date | null;
  flashEndAt?: string | Date | null;
  saleType?: "piece" | "quantity" | "both";
  availableQuantity?: number;
  inStock?: boolean;
  rating?: number;
  ratingCount?: number;
}

interface RelatedProductsProps {
  currentProductId: number | string;
  category?: string;
  purchaseUnit?: PurchaseUnit;
}

const RelatedProducts: React.FC<RelatedProductsProps> = ({
  currentProductId,
  category,
  purchaseUnit = "piece",
}) => {
  const [products, setProducts] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Slider metrics
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  function normalizeImagePath(src?: string | null) {
    if (!src) return "/placeholder.png";
    const s = String(src).trim();
    if (!s) return "/placeholder.png";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/uploads/")) return `/products${s}`;
    if (s.startsWith("/products/uploads/")) return s;
    if (s.startsWith("uploads/")) return `/products/${s}`;
    if (s.startsWith("products/uploads/")) return `/${s}`;
    return `/products/uploads/${s.replace(/^\/+/, "")}`;
  }

  function makeAbsolute(p: string) {
    if (!p) return p;
    if (/^https?:\/\//i.test(p)) return p;
    return `${baseURL.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  }

  const imageUrl = (src?: string) => {
    if (!src) return "/placeholder.png";
    return makeAbsolute(normalizeImagePath(src));
  };

  useEffect(() => {
    let mounted = true;

    const fetchRelated = async () => {
      if (!category) {
        setProducts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.get("/products", { params: { category, limit: 18 } });
        const allProducts = (res.data?.products ?? res.data ?? []) as RelatedProduct[];

        const filtered = allProducts
          .filter((p) => String(p.id) !== String(currentProductId))
          .slice(0, 12);

        if (mounted) setProducts(filtered);
      } catch (err) {
        console.warn("Failed to load related products", err);
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRelated();
    return () => {
      mounted = false;
    };
  }, [category, currentProductId]);

  const updateMetrics = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const atStart = el.scrollLeft <= 2;
    const atEnd = el.scrollLeft >= maxScroll - 2;

    setIsScrollable(maxScroll > 2);

    // Pages based on viewport scroll width
    const pc =
      maxScroll === 0 ? 1 : Math.max(1, Math.ceil(el.scrollWidth / Math.max(1, el.clientWidth)));
    const current =
      maxScroll === 0 ? 0 : Math.min(pc - 1, Math.round(el.scrollLeft / el.clientWidth));

    setPageCount(pc);
    setPage(current);
    setCanPrev(!atStart);
    setCanNext(!atEnd);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateMetrics();

    const onScroll = () => updateMetrics();
    el.addEventListener("scroll", onScroll, { passive: true });

    let ro: ResizeObserver | null = null;
    const hasWindow = typeof window !== "undefined";
    if (hasWindow && "ResizeObserver" in window) {
      ro = new ResizeObserver(() => updateMetrics());
      ro.observe(el);
    } else if (hasWindow) {
      (window as Window).addEventListener("resize", updateMetrics);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect();
      if (hasWindow) (window as Window).removeEventListener("resize", updateMetrics);
    };
  }, [products.length, updateMetrics]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const goToPage = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const showNav = useMemo(() => products.length > 2, [products.length]);

  if (loading) {
    return (
      <section className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section className="py-10 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-7 sm:mb-9">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-3 rounded-full bg-orange-50 text-orange-700 text-sm font-semibold shadow-sm">
            <Sparkles className="w-4 h-4" />
            <span>Vous aimerez aussi</span>
            <Sparkles className="w-4 h-4" />
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Produits similaires
          </h2>

          <div className="mx-auto mt-4 h-1 w-16 sm:w-20 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />
        </div>

        {/* Slider */}
        <div className="relative">
          {showNav && isScrollable && (
            <>
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                disabled={!canPrev}
                className="
                  hidden sm:flex absolute -left-3 lg:-left-4 top-1/2 -translate-y-1/2 z-10
                  w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-white shadow-lg border border-gray-200/70
                  items-center justify-center text-gray-700 hover:text-orange-500 hover:border-orange-200 hover:shadow-xl
                  transition disabled:opacity-30 disabled:cursor-not-allowed
                "
                aria-label="Produits précédents"
              >
                <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>

              <button
                type="button"
                onClick={() => scrollByPage(1)}
                disabled={!canNext}
                className="
                  hidden sm:flex absolute -right-3 lg:-right-4 top-1/2 -translate-y-1/2 z-10
                  w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-white shadow-lg border border-gray-200/70
                  items-center justify-center text-gray-700 hover:text-orange-500 hover:border-orange-200 hover:shadow-xl
                  transition disabled:opacity-30 disabled:cursor-not-allowed
                "
                aria-label="Produits suivants"
              >
                <ChevronRight className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
            </>
          )}

          <div
            ref={scrollerRef}
            className={[
              "flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory",
              "px-1 pb-3",
              "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              isScrollable ? "justify-start" : "justify-center",
            ].join(" ")}
          >
            {products.map((product) => {
              const productForPricing = {
                pricePiece: product.pricePiece,
                priceQuantity: product.priceQuantity,
                combinations: product.combinations,
                venteFlashActive: product.venteFlashActive,
                venteFlashPercentage:
                  product.venteFlashPercentage !== undefined
                    ? Number(product.venteFlashPercentage)
                    : undefined,
                flashApplyTarget: product.flashApplyTarget,
                flashApplyAllCombinations: product.flashApplyAllCombinations,
                flashCombinationIds: product.flashCombinationIds,
                flashDiscountType: product.flashDiscountType,
                flashDiscountValue:
                  product.flashDiscountValue !== undefined && product.flashDiscountValue !== null
                    ? Number(product.flashDiscountValue)
                    : null,
                flashStartAt: product.flashStartAt,
                flashEndAt: product.flashEndAt,
              };

              const resolved = resolveListingMinPriceWithFlash(productForPricing, purchaseUnit);

              const fallbackBase =
                product.displayPrice !== undefined && product.displayPrice !== null
                  ? Number(product.displayPrice)
                  : null;

              const basePrice = resolved.basePrice ?? fallbackBase;
              const effectivePrice = resolved.price ?? basePrice ?? 0;

              const isVenteFlash =
                resolved.flashApplied && basePrice !== null && effectivePrice < basePrice;

              const hasMultiplePrices = (product.combinations?.length ?? 0) > 0;

              const isOutOfStock =
                product.inStock === false ||
                (typeof product.availableQuantity === "number" &&
                  product.availableQuantity <= 0);

              const img = imageUrl(product.images?.[0]);

              const ratingCount = product.ratingCount ?? 0;
              const hasRating = (product.rating ?? 0) > 0 && ratingCount > 0;

              return (
                <Link
                  key={product.id}
                  to={buildProductPath({ id: product.id, title: product.title })}
                  className="
                    snap-start shrink-0 min-w-0 group
                    basis-[calc(50%-0.375rem)]        /* mobile: 2 cards */
                    sm:basis-[calc(50%-0.5rem)]       /* sm: 2 cards */
                    md:basis-[calc(33.333%-0.75rem)]  /* md: 3 cards */
                    lg:basis-[calc(33.333%-0.85rem)]  /* lg: 3 cards */
                    xl:basis-[calc(23.333%-0.95rem)]  /* xl: your requested size */
                  "
                >
                  <article
                    className="
                      h-full bg-white border border-gray-200/70 shadow-sm
                      hover:shadow-md hover:-translate-y-0.5 transition
                      overflow-hidden rounded-t-[999px] rounded-b-2xl
                    "
                  >
                    <div className="relative bg-gray-100">
                      <div className="h-28 sm:h-32 md:h-38 lg:h-52 xl:h-56 w-full">
                        <img
                          src={img}
                          alt={product.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>

                      {/* Flash badge (top-left) */}
                      {resolved.flashApplied && !isOutOfStock && (
                        <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] sm:text-xs font-extrabold px-3 py-1.5 rounded-full shadow">
                          VENTE FLASH
                        </span>
                      )}

                      {/* Rupture badge (BOTTOM-RIGHT, responsive) */}
                      {isOutOfStock && (
                        <span
                          className="
                            absolute bottom-2 right-2
                            sm:bottom-3 sm:right-3
                            lg:bottom-4 lg:right-4
                            bg-red-500 text-white
                            text-[10px] sm:text-xs
                            font-extrabold
                            px-3 py-1.5
                            rounded-full shadow
                          "
                        >
                          Rupture
                        </span>
                      )}
                    </div>

                    <div className="px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 font-extrabold text-gray-900 text-sm sm:text-[15px] lg:text-base leading-snug line-clamp-2">
                          {product.title}
                        </h3>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full grid place-items-center hover:bg-gray-100 transition"
                          aria-label="Ajouter aux favoris"
                        >
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="mt-3 lg:mt-4 h-px bg-gray-100" />

                      <div className="mt-3 lg:mt-4 flex items-end justify-between gap-2">
                        <div className="flex items-center gap-2 text-gray-600 min-w-0">
                          <svg
                            className={`w-4 h-4 sm:w-5 sm:h-5 ${hasRating ? "text-amber-500" : "text-gray-300"
                              }`}
                            viewBox="0 0 20 20"
                            fill={hasRating ? "currentColor" : "none"}
                            stroke="currentColor"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.382 2.455a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.54 1.118l-3.382-2.455a1 1 0 00-1.175 0l-3.382 2.455c-.784.57-1.838-.197-1.54-1.118l1.287-3.97a1 1 0 00-.364-1.118L1.049 9.397c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.287-3.97z" />
                          </svg>

                          <span className="text-xs sm:text-sm font-medium truncate">
                            {hasRating
                              ? `${product.rating!.toFixed(1)} (${ratingCount})`
                              : "Pas d'avis"}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          {hasMultiplePrices && (
                            <span className="block text-[10px] sm:text-xs text-gray-500 leading-none mb-1">
                              À partir de
                            </span>
                          )}

                          {isVenteFlash && basePrice !== null ? (
                            <div className="leading-none">
                              <div className="text-[11px] sm:text-xs text-gray-400 line-through">
                                {formatPriceTND(basePrice)}
                              </div>
                              <div className="text-sm sm:text-base lg:text-lg font-extrabold text-red-600">
                                {formatPriceTND(effectivePrice)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm sm:text-base lg:text-lg font-extrabold text-gray-900">
                              {formatPriceTND(effectivePrice)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>

          {/* Dots */}
          {showNav && isScrollable && pageCount > 1 && (
            <div className="flex justify-center gap-2 mt-5">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goToPage(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${i === page
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 w-10"
                    : "bg-gray-300 hover:bg-gray-400 w-2.5"
                    }`}
                  aria-label={`Aller à la page ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RelatedProducts;
