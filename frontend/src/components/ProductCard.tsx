/* src/components/ProductCard.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* ProductCard — uses parent-provided client (no per-card fetch) */
import React from "react";
import { Link } from "react-router-dom";
import { Star, Heart } from "lucide-react";
import { useWishlist } from "@/components/WishlistContext";
import api from "@/lib/api";
import {
  resolveListingMinPriceWithFlash,
  formatPriceTND,
  PurchaseUnit,
} from "@/lib/price";
import { buildProductPath, cn } from "@/lib/utils";

export type Client = {
  id: number;
  purchaseUnit?: PurchaseUnit;
  clerkId?: string;
  phone?: string;
};

interface ProductCardProps {
  id: number | string;
  title: string;
  image: string;
  currentPrice?: number | string;
  pricePiece?: number | string;
  priceQuantity?: number | string;
  flashPrice?: number | string;
  flashPercentage?: number | string;
  venteFlashActive?: boolean;
  inStock?: boolean;
  client?: Client;
  purchaseUnit?: PurchaseUnit;
  saleType?: "piece" | "quantity" | "both";
  combinations?: any[];
  availableQuantity?: number;
  shippingPrice?: number;
  rating?: number;
  ratingCount?: number;
  minStockAlert?: number;
  variant?: "card" | "minimal";
  flashApplyTarget?: "product" | "combinations";
  flashApplyAllCombinations?: boolean;
  flashCombinationIds?: string[];
  flashDiscountType?: "percent" | "fixed";
  flashDiscountValue?: number | string | null;
  flashStartAt?: string | Date | null;
  flashEndAt?: string | Date | null;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  title,
  image,
  currentPrice,
  pricePiece,
  priceQuantity,
  combinations,
  flashPrice,
  flashPercentage,
  venteFlashActive,
  flashApplyTarget,
  flashApplyAllCombinations,
  flashCombinationIds,
  flashDiscountType,
  flashDiscountValue,
  flashStartAt,
  flashEndAt,
  inStock = true,
  client,
  purchaseUnit,
  saleType,
  availableQuantity,
  rating,
  ratingCount,
  minStockAlert,
  variant = "card",
}) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const inWishlist = isInWishlist(String(id));
  // image resolver
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
  const imageUrl = (src: string) => {
    if (!src) return "/placeholder.png";
    return makeAbsolute(normalizeImagePath(src));
  };

  // Decide purchase unit
  const decidePurchaseUnit = (): PurchaseUnit => {
    if (
      client?.purchaseUnit === "quantity" ||
      client?.purchaseUnit === "piece"
    ) {
      console.debug(
        `[ProductCard ${id}] using client.purchaseUnit:`,
        client.purchaseUnit
      );
      return client.purchaseUnit!;
    }
    if (purchaseUnit === "quantity" || purchaseUnit === "piece") {
      console.debug(
        `[ProductCard ${id}] using prop purchaseUnit:`,
        purchaseUnit
      );
      return purchaseUnit;
    }
    if (saleType === "quantity") {
      console.debug(`[ProductCard ${id}] using saleType fallback:`, saleType);
      return "quantity";
    }
    console.debug(`[ProductCard ${id}] default to "piece"`);
    return "piece";
  };

  const decidedUnit = decidePurchaseUnit();
  const isQuantityBuyer = decidedUnit === "quantity";
  const minQty = isQuantityBuyer ? 10 : 1;
  const normalizedAvailableQty =
    typeof availableQuantity === "number"
      ? Math.max(0, Math.floor(availableQuantity))
      : null;
  const hasFiniteStock = normalizedAvailableQty !== null;
  const outOfStock =
    !inStock || (hasFiniteStock && normalizedAvailableQty === 0);
  const insufficientForMin =
    hasFiniteStock &&
    normalizedAvailableQty !== null &&
    normalizedAvailableQty > 0 &&
    normalizedAvailableQty < minQty;
  const minStockThreshold =
    typeof minStockAlert === "number" && Number.isFinite(minStockAlert)
      ? Math.max(0, Math.floor(minStockAlert))
      : null;
  const showMinStockWarning =
    hasFiniteStock &&
    normalizedAvailableQty !== null &&
    minStockThreshold !== null &&
    minStockThreshold > 0 &&
    normalizedAvailableQty <= minStockThreshold &&
    normalizedAvailableQty > 0;

  const productForPricing = {
    pricePiece,
    priceQuantity,
    combinations,
    venteFlashActive,
    venteFlashPercentage:
      flashPercentage !== undefined && flashPercentage !== null
        ? Number(flashPercentage)
        : undefined,
    flashApplyTarget,
    flashApplyAllCombinations,
    flashCombinationIds,
    flashDiscountType,
    flashDiscountValue:
      flashDiscountValue !== undefined && flashDiscountValue !== null
        ? Number(flashDiscountValue)
        : null,
    flashStartAt,
    flashEndAt,
  };

  const resolvedPrice = resolveListingMinPriceWithFlash(
    productForPricing,
    decidedUnit
  );
  const fallbackBase =
    currentPrice !== undefined && currentPrice !== null
      ? Number(currentPrice)
      : null;
  const basePrice = resolvedPrice.basePrice ?? fallbackBase;

  // Use flashPrice from backend if available (pre-calculated), otherwise use resolved price
  const backendFlashPrice = flashPrice !== undefined && flashPrice !== null ? Number(flashPrice) : null;
  const effectivePrice = backendFlashPrice ?? resolvedPrice.price ?? basePrice ?? 0;

  // Determine if flash sale is active: either from resolved price or from backend flash price
  const isVenteFlash =
    (resolvedPrice.flashApplied && basePrice !== null && effectivePrice < basePrice) ||
    (venteFlashActive === true && backendFlashPrice !== null && basePrice !== null && backendFlashPrice < basePrice);

  const priceLabel = formatPriceTND(effectivePrice);
  const showFrom = resolvedPrice.hasRange;
  const flashPercentLabel =
    flashDiscountType === "percent"
      ? flashDiscountValue ?? flashPercentage
      : flashPercentage;
  const normalizedRating =
    typeof rating === "number" && Number.isFinite(rating)
      ? Math.min(5, Math.max(0, rating))
      : null;
  const ratingLabel =
    normalizedRating !== null ? normalizedRating.toFixed(1) : "Pas d'avis";

  const containerClass = cn(
    "block w-full max-w-[180px] sm:max-w-[200px] lg:max-w-[320px] xl:max-w-[340px] h-[280px] sm:h-[300px] lg:h-[380px] xl:h-[400px] flex flex-col relative group transition-all duration-300 rounded-t-[50%] overflow-hidden",
    variant === "minimal"
      ? "bg-transparent shadow-none ring-0"
      : "bg-white shadow-md",
    variant !== "minimal" && isVenteFlash
      ? "ring-2 ring-orange-200 shadow-[0_10px_30px_rgba(251,146,60,0.25)]"
      : ""
  );

  return (
    <Link
      to={buildProductPath({ id, title })}
      className={containerClass}
    >
      <div className="flex-1 overflow-hidden relative">
        <img
          src={imageUrl(image)}
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 rounded-t-[50%]"
          loading="lazy"
          decoding="async"
          width={280}
          height={280}
        />
        {/* Vente Flash badge - dynamically positioned at bottom of image */}
        {isVenteFlash && (
          <span className="absolute bottom-3 left-3 bg-gradient-to-r from-orange-500 via-red-500 to-amber-400 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-[0_4px_15px_rgba(251,146,60,0.45)] uppercase tracking-[0.08em] border border-white/60 group-hover:scale-110 transition-transform duration-300">
            Vente flash
          </span>
        )}
        {/* Out of stock badge - dynamically positioned at bottom right */}
        {outOfStock && (
          <span className="absolute bottom-3 right-3 bg-gradient-to-r from-red-500 to-red-600 backdrop-blur-sm text-white text-[10px] font-semibold px-3 py-1.5 rounded-full shadow-[0_4px_15px_rgba(239,68,68,0.45)] group-hover:scale-110 transition-transform duration-300">
            Rupture
          </span>
        )}\n      </div>

      <div
        className={cn(
          "flex flex-col gap-2",
          variant === "minimal" ? "px-3 pt-4 pb-2" : "p-4"
        )}
      >
        {/* Title + Heart Row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors flex-1">
            {title}
          </h3>
          {/* Wishlist Heart Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist({
                productId: String(id),
                title,
                price: effectivePrice,
                image: imageUrl(image),
              });
            }}
            className="p-1 hover:bg-gray-100 rounded transition-all flex-shrink-0 active:scale-125"
            aria-label={inWishlist ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Heart
              className={`w-5 h-5 transition-all duration-200 ${inWishlist
                  ? "fill-black text-black scale-110"
                  : "text-gray-400 hover:fill-black hover:text-black hover:scale-110"
                }`}
            />
          </button>
        </div>

        <div
          className={cn(
            "mt-auto flex items-center",
            variant === "minimal" ? "pt-2" : "pt-3 border-t border-gray-100"
          )}
        >
          <div className="flex items-center gap-1 text-xs">
            <Star
              className={`w-4 h-4 ${normalizedRating !== null
                ? "text-amber-500 fill-amber-500"
                : "text-gray-300"
                }`}
            />
            <span className="text-gray-700">
              {ratingLabel}
              {ratingCount ? ` (${ratingCount})` : ""}
            </span>
          </div>

          <div className="ml-auto flex flex-col items-end gap-0.5 text-sm text-right">
            {/* Show original price with strikethrough when flash sale is active */}
            {isVenteFlash && basePrice !== null && (
              <span className="text-gray-400 line-through text-xs">
                {formatPriceTND(basePrice)}
              </span>
            )}
            <span
              className={`${isVenteFlash ? "text-red-600 font-semibold text-base" : ""
                }`}
            >
              {showFrom ? "À partir de " : ""}
              {priceLabel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
