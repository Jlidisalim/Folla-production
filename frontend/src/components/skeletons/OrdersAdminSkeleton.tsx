import { Skeleton } from "@/components/ui/skeleton";

/**
 * OrdersAdminSkeleton - Matches admin Orders page with KPI cards and order list
 */
export function OrdersAdminSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-32" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white p-4 rounded shadow flex items-center gap-3">
            <Skeleton className="w-6 h-6 rounded" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <Skeleton className="h-10 w-full rounded-md" />

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-3 md:gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded shadow bg-gray-50"
          >
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <Skeleton className="w-12 h-12 sm:w-10 sm:h-10 rounded" />
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 w-full sm:w-auto">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Chargement des commandes...</span>
    </div>
  );
}

export default OrdersAdminSkeleton;
