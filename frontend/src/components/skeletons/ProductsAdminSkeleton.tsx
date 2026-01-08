import { Skeleton } from "@/components/ui/skeleton";

/**
 * ProductsAdminSkeleton - Matches admin Products page with filters and table
 */
export function ProductsAdminSkeleton() {
  return (
    <div className="p-6 bg-gray-50 min-h-screen" role="status" aria-busy="true">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-12 w-36 rounded-lg" />
          <Skeleton className="h-12 w-44 rounded-lg" />
          <Skeleton className="h-12 w-40 rounded-lg" />
        </div>
      </div>

      {/* Low stock alerts section skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="w-5 h-5" />
        </div>
      </div>

      {/* Shipping price section skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-48 mb-1" />
            <Skeleton className="h-4 w-80 mb-3" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex gap-4">
            {["Image", "Nom", "Catégorie", "Statut", "Qté", "Tarifs", "Flash", "Type", "Visibilité", "Actions"].map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-md" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-8" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-28 rounded-lg" />
              <div className="flex gap-1">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="w-8 h-8 rounded" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="w-8 h-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Chargement des produits...</span>
    </div>
  );
}

export default ProductsAdminSkeleton;
