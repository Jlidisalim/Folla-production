import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type SkeletonCardProps = {
  className?: string;
};

/**
 * SkeletonCard - Matches ProductCard dimensions exactly
 * - Mobile: max-w-[180px] h-[280px]
 * - SM: max-w-[200px] h-[300px]
 * - LG+: max-w-[320px] h-[380px]
 * Features arch-shaped (rounded-top) image container like the real ProductCard
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        // Match ProductCard exact dimensions
        "w-full max-w-[180px] sm:max-w-[200px] lg:max-w-[320px] xl:max-w-[340px]",
        "h-[280px] sm:h-[300px] lg:h-[380px] xl:h-[400px]",
        "flex flex-col bg-white shadow-md rounded-t-[50%] overflow-hidden",
        className
      )}
      role="status"
      aria-busy="true"
    >
      {/* Image skeleton - arch-shaped top, matches ProductCard image area */}
      <div className="flex-1 overflow-hidden relative">
        <Skeleton className="w-full h-full rounded-t-[50%]" />
      </div>

      {/* Content area - matches ProductCard layout */}
      <div className="p-3 sm:p-4 flex flex-col gap-2">
        {/* Title + Heart row */}
        <div className="flex items-start justify-between gap-2">
          {/* Title skeleton - 2 lines */}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 sm:h-4 w-full" />
            <Skeleton className="h-3 sm:h-4 w-3/4" />
          </div>
          {/* Heart icon placeholder */}
          <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
        </div>

        {/* Rating + Price row */}
        <div className="mt-auto pt-2 sm:pt-3 border-t border-gray-100 flex items-center justify-between">
          {/* Rating skeleton */}
          <div className="flex items-center gap-1">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-3 w-10 sm:w-12" />
          </div>

          {/* Price skeleton */}
          <Skeleton className="h-4 w-14 sm:w-16" />
        </div>
      </div>

      <span className="sr-only">Chargement du produit...</span>
    </div>
  );
}

export default SkeletonCard;
