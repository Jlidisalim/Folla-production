import { Skeleton } from "@/components/ui/skeleton";

/**
 * DashboardSkeleton - Matches admin Dashboard with KPI cards, charts, and tables
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen" role="status" aria-busy="true">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-9 w-56" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="w-20 h-12" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts and content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main chart area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-32 rounded-full" />
              </div>
            </div>
            {/* Chart placeholder */}
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>

        {/* Sidebar - Region sales */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <Skeleton className="h-6 w-40 mb-4" />
          {/* Pie chart placeholder */}
          <Skeleton className="h-48 w-48 mx-auto rounded-full mb-4" />
          {/* Legend */}
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="w-3 h-3 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top products table */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0">
              <Skeleton className="w-12 h-12 rounded-md" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Chargement du tableau de bord...</span>
    </div>
  );
}

export default DashboardSkeleton;
