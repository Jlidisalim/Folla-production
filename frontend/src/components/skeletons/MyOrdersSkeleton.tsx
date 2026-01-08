import { Skeleton } from "@/components/ui/skeleton";

/**
 * MyOrdersSkeleton - Matches MyOrders page with order cards
 */
export function MyOrdersSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" role="status" aria-busy="true">
      {/* Page title */}
      <Skeleton className="h-8 w-48 mb-6" />

      {/* Order cards */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border rounded-lg p-4 bg-white shadow-sm space-y-4"
          >
            {/* Order header */}
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>

            {/* Order items */}
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full max-w-xs" />
              ))}
            </div>

            {/* Total */}
            <div className="pt-2 border-t">
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Chargement des commandes...</span>
    </div>
  );
}

export default MyOrdersSkeleton;
