import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

/**
 * ProductListingSkeleton - Matches product listing page with breadcrumb, title, and grid
 */
export function ProductListingSkeleton() {
  return (
    <div className="min-h-screen bg-background relative" role="status" aria-busy="true">
      {/* Breadcrumb skeleton */}
      <nav className="px-4 py-4 border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <span className="text-muted-foreground">/</span>
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </nav>

      {/* Header skeleton */}
      <div className="bg-muted py-8">
        <div className="max-w-7xl mx-auto px-4">
          <Skeleton className="h-9 w-48 mx-auto" />
        </div>
      </div>

      {/* Product grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-center">
          <div className="grid w-full grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 justify-items-center xl:gap-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>

        {/* Pagination skeleton */}
        <div className="flex justify-center items-center mt-8 gap-4">
          <Skeleton className="h-10 w-20 rounded" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-10 w-20 rounded" />
        </div>
      </div>

      <span className="sr-only">Chargement des produits...</span>
    </div>
  );
}

export default ProductListingSkeleton;
