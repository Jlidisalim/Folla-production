import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

type SkeletonCardProps = {
  className?: string;
};

/**
 * SkeletonCard - Matches ProductCard dimensions (max-w-[280px], h-[360px])
 * with rounded top image, title lines, and price placeholder
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-[280px] sm:max-w-[300px] h-[360px] sm:h-[380px]",
        "flex flex-col bg-white shadow-md rounded-t-[50%] overflow-hidden",
        className
      )}
      role="status"
      aria-busy="true"
    >
      {/* Image skeleton - matches ProductCard image area */}
      <div className="flex-1 overflow-hidden relative">
        <Skeleton className="w-full h-full rounded-t-[50%]" />
      </div>

      {/* Content area */}
      <div className="p-4 flex flex-col gap-2">
        {/* Title skeleton - 2 lines */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        {/* Rating + Price row */}
        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
          {/* Rating skeleton */}
          <div className="flex items-center gap-1">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>

          {/* Price skeleton */}
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <span className="sr-only">Chargement du produit...</span>
    </div>
  );
}

export default SkeletonCard;
