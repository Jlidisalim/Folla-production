import { Skeleton } from "@/components/ui/skeleton";

/**
 * ProductDetailSkeleton - Two-column layout matching ProductDetail page
 */
export function ProductDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8" role="status" aria-busy="true">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left column - Image gallery */}
        <div className="space-y-4">
          {/* Main image */}
          <Skeleton className="w-full aspect-square rounded-2xl" />
          
          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-16 h-16 rounded-lg flex-shrink-0" />
            ))}
          </div>
        </div>

        {/* Right column - Product info */}
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-5 h-5 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>

          {/* Variants - Color selector */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-10 h-10 rounded-full" />
              ))}
            </div>
          </div>

          {/* Variants - Size selector */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-20" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-12 h-10 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-20" />
            <div className="flex items-center gap-2">
              <Skeleton className="w-10 h-10 rounded" />
              <Skeleton className="w-12 h-10" />
              <Skeleton className="w-10 h-10 rounded" />
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-4 pt-4">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 flex-1 rounded-lg" />
          </div>

          {/* Shipping info */}
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Accordions */}
          <div className="space-y-4 pt-6 border-t">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="py-3 border-b">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Chargement du produit...</span>
    </div>
  );
}

export default ProductDetailSkeleton;
