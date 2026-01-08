import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

/**
 * IndexPageSkeleton - Matches home page layout with HeroGrid + ProductSection
 */
export function IndexPageSkeleton() {
  return (
    <div className="flex-1" role="status" aria-busy="true">
      {/* Hero Grid Skeleton - matches HeroGrid.tsx layout */}
      <section className="relative py-8 px-4 bg-muted/30">
        <div className="relative max-w-7xl mx-auto">
          <div className="relative">
            {/* 4-column grid with 8 images */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[200px] md:auto-rows-[180px]">
              {/* Image 1: spans 1 col, 2 rows */}
              <Skeleton className="md:col-span-1 md:row-span-2 rounded-lg" />
              {/* Image 2: spans 2 cols, 1 row */}
              <Skeleton className="md:col-span-2 md:row-span-1 rounded-lg" />
              {/* Image 3 */}
              <Skeleton className="md:col-span-1 md:row-span-1 rounded-lg" />
              {/* Image 4 */}
              <Skeleton className="md:col-span-1 md:row-span-1 rounded-lg" />
              {/* Image 5 */}
              <Skeleton className="md:col-span-1 md:row-span-1 rounded-lg" />
              {/* Image 6: spans 2 cols */}
              <Skeleton className="md:col-span-2 md:row-span-1 rounded-lg" />
              {/* Image 7 */}
              <Skeleton className="md:col-span-1 md:row-span-1 rounded-lg" />
              {/* Image 8 */}
              <Skeleton className="md:col-span-1 md:row-span-1 rounded-lg" />
            </div>

            {/* Centered tagline overlay skeleton */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-background/95 backdrop-blur-sm px-8 py-6 rounded-lg shadow-lg text-center max-w-md mx-4">
                <Skeleton className="h-8 w-64 mx-auto mb-2" />
                <Skeleton className="h-4 w-48 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Sections Skeleton - matches ProductSection layout */}
      <div className="max-w-7xl mx-auto">
        {/* Section 1 */}
        <section className="py-12 px-4 overflow-visible">
          <div className="text-center mb-10">
            {/* Collection badge */}
            <Skeleton className="h-6 w-24 mx-auto mb-3 rounded-full" />
            {/* Section title */}
            <Skeleton className="h-10 w-56 mx-auto mb-3" />
            {/* Underline decoration */}
            <Skeleton className="h-1 w-16 mx-auto rounded-full" />
            {/* Subtitle */}
            <Skeleton className="h-5 w-80 mx-auto mt-3" />
          </div>
          
          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 justify-items-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>

          {/* "Tout afficher" button */}
          <div className="text-center mt-8">
            <Skeleton className="h-10 w-32 mx-auto" />
          </div>
        </section>

        {/* Section 2 */}
        <section className="py-12 px-4 overflow-visible">
          <div className="text-center mb-10">
            <Skeleton className="h-6 w-24 mx-auto mb-3 rounded-full" />
            <Skeleton className="h-10 w-64 mx-auto mb-3" />
            <Skeleton className="h-1 w-16 mx-auto rounded-full" />
            <Skeleton className="h-5 w-72 mx-auto mt-3" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 justify-items-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>

          <div className="text-center mt-8">
            <Skeleton className="h-10 w-32 mx-auto" />
          </div>
        </section>
      </div>

      <span className="sr-only">Chargement de la page d'accueil...</span>
    </div>
  );
}

export default IndexPageSkeleton;
