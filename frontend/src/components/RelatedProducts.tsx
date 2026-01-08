/* src/components/RelatedProducts.tsx */
/* "You may also like" section with modern design and smooth animations */
import React, { useEffect, useState, useMemo } from "react";
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
  const [currentIndex, setCurrentIndex] = useState(0);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  function normalizeImagePath(src?: string | null) {
    if (!src) return "/placeholder.png";
    const s = String(src).trim();
    if (s.length === 0) return "/placeholder.png";
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
        const res = await api.get("/products", {
          params: { category, limit: 12 },
        });
        const allProducts = (res.data?.products ?? res.data ?? []) as RelatedProduct[];
        // Filter out current product and limit to 8 products
        const filtered = allProducts
          .filter((p) => String(p.id) !== String(currentProductId))
          .slice(0, 8);
        if (mounted) {
          setProducts(filtered);
        }
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

  const visibleCount = useMemo(() => {
    if (typeof window === "undefined") return 4;
    const width = window.innerWidth;
    if (width < 640) return 2;
    if (width < 1024) return 3;
    return 4;
  }, []);

  const maxIndex = Math.max(0, products.length - visibleCount);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  if (loading) {
    return (
      <section className="py-16 px-4 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full" />
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-4 bg-gradient-to-b from-gray-50/50 to-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 text-orange-600 text-sm font-semibold shadow-sm animate-pulse">
            <Sparkles className="w-4 h-4" />
            <span>Découvrez plus</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            Vous aimerez aussi
          </h2>
          <p className="mt-3 text-gray-600 max-w-xl mx-auto">
            Découvrez d'autres produits artisanaux qui pourraient vous plaire
          </p>
          <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />
        </div>

        {/* Products Carousel */}
        <div className="relative">
          {/* Navigation Arrows */}
          {products.length > visibleCount && (
            <>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center text-gray-700 hover:text-orange-500 hover:border-orange-200 hover:shadow-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-700 disabled:hover:border-gray-100 disabled:hover:shadow-lg"
                aria-label="Produits précédents"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex >= maxIndex}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center text-gray-700 hover:text-orange-500 hover:border-orange-200 hover:shadow-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-gray-700 disabled:hover:border-gray-100 disabled:hover:shadow-lg"
                aria-label="Produits suivants"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Products Container */}
          <div className="overflow-hidden mx-8">
            <div
              className={`flex transition-transform duration-500 ease-out gap-6 ${products.length <= visibleCount ? 'justify-center' : ''}`}
              style={{
                transform: products.length > visibleCount ? `translateX(calc(-${currentIndex} * (100% / ${visibleCount} + 1.5rem)))` : undefined,
              }}
            >
              {products.map((product, idx) => {
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
                    product.flashDiscountValue !== undefined &&
                    product.flashDiscountValue !== null
                      ? Number(product.flashDiscountValue)
                      : null,
                  flashStartAt: product.flashStartAt,
                  flashEndAt: product.flashEndAt,
                };

                const resolvedPrice = resolveListingMinPriceWithFlash(
                  productForPricing,
                  purchaseUnit
                );
                const fallbackBase =
                  product.displayPrice !== undefined && product.displayPrice !== null
                    ? Number(product.displayPrice)
                    : null;
                const basePrice = resolvedPrice.basePrice ?? fallbackBase;
                const effectivePrice = resolvedPrice.price ?? basePrice ?? 0;
                const isVenteFlash =
                  resolvedPrice.flashApplied &&
                  basePrice !== null &&
                  effectivePrice < basePrice;
                const priceLabel = formatPriceTND(effectivePrice);
                const imageSrc = imageUrl(product.images?.[0]);

                return (
                  <Link
                    key={product.id}
                    to={buildProductPath({ id: product.id, title: product.title })}
                    className="group flex-shrink-0"
                    style={{ width: `calc(100% / ${visibleCount} - 1.125rem)` }}
                  >
                    <div
                      className="relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                      style={{
                        animationDelay: `${idx * 100}ms`,
                      }}
                    >
                      {/* Image Container */}
                      <div className="relative aspect-square overflow-hidden bg-gray-100">
                        <img
                          src={imageSrc}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                          loading="lazy"
                          decoding="async"
                        />
                        {/* Gradient Overlay on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        {/* Flash Sale Badge */}
                        {isVenteFlash && (
                          <span className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wide animate-pulse">
                            Vente flash
                          </span>
                        )}

                        {/* Quick View Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="px-6 py-2.5 bg-white/95 backdrop-blur-sm text-gray-900 font-semibold rounded-full shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
                            Voir le produit
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-5">
                        <h3 className="font-semibold text-gray-900 text-base line-clamp-2 group-hover:text-orange-600 transition-colors duration-300 min-h-[48px]">
                          {product.title}
                        </h3>
                        
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-lg font-bold ${isVenteFlash ? 'text-red-600' : 'text-gray-900'}`}>
                              {priceLabel}
                            </span>
                            {isVenteFlash && basePrice && (
                              <span className="text-sm text-gray-400 line-through">
                                {formatPriceTND(basePrice)}
                              </span>
                            )}
                          </div>
                          
                          {/* Rating Stars */}
                          {product.rating !== undefined && product.rating > 0 && (
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-4 h-4 text-amber-400 fill-amber-400"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.382 2.455a1 1 0 00-.364 1.118l1.287 3.97c.3.921-.755 1.688-1.54 1.118l-3.382-2.455a1 1 0 00-1.175 0l-3.382 2.455c-.784.57-1.838-.197-1.54-1.118l1.287-3.97a1 1 0 00-.364-1.118L1.049 9.397c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.287-3.97z" />
                              </svg>
                              <span className="text-sm text-gray-600">
                                {product.rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Accent Line */}
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Pagination Dots */}
          {products.length > visibleCount && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    idx === currentIndex
                      ? 'bg-gradient-to-r from-orange-500 to-amber-500 w-8'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Aller à la page ${idx + 1}`}
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
