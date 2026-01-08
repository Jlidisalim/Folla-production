import { Skeleton } from "@/components/ui/skeleton";

/**
 * ClientsAdminSkeleton - Matches ClientsAdmin page with stats cards and table
 */
export function ClientsAdminSkeleton() {
  return (
    <div className="p-6 min-h-screen bg-gray-50" role="status" aria-busy="true">
      {/* Title */}
      <Skeleton className="h-8 w-48 mb-6" />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg p-4 shadow flex flex-col">
            <div className="flex items-center text-sm mb-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 ml-2 rounded" />
            </div>
            <Skeleton className="h-9 w-16 mt-2" />
            <Skeleton className="h-3 w-32 mt-2" />
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <Skeleton className="h-10 w-full md:w-[200px] rounded-md" />
        <Skeleton className="h-10 w-full md:w-auto flex-1 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Table header */}
        <div className="bg-gray-50 p-3 border-b">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 flex items-center gap-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>

      <span className="sr-only">Chargement des clients...</span>
    </div>
  );
}

export default ClientsAdminSkeleton;
