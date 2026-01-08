import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

/**
 * VenteFlashSkeleton - Matches VenteFlash page layout with header + product grid
 */
export function VenteFlashSkeleton() {
  return (
    <div className="flex-1" role="status" aria-busy="true">
      {/* Header section skeleton */}
      <section className="bg-muted py-12 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-4 w-96 max-w-full mx-auto" />
          <Skeleton className="h-4 w-80 max-w-full mx-auto" />
        </div>
      </section>

      {/* Product grid skeleton */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-items-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </section>

      <span className="sr-only">Chargement des ventes flash...</span>
    </div>
  );
}

export default VenteFlashSkeleton;
