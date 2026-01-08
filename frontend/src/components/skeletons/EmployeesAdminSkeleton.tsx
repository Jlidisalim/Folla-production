import { Skeleton } from "@/components/ui/skeleton";

/**
 * EmployeesAdminSkeleton - Matches EmployeesAdmin page with header, stats, table, and calendar
 */
export function EmployeesAdminSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 bg-[#f7f8fb] min-h-screen" role="status" aria-busy="true">
      {/* Header section */}
      <div className="flex flex-col gap-4 max-w-6xl mx-auto w-full">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 p-6 sm:p-7">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="rounded-full w-12 h-12 bg-white/20" />
            <div>
              <Skeleton className="h-8 w-56 bg-white/30 mb-2" />
              <Skeleton className="h-4 w-64 bg-white/20" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-40 rounded-md bg-white/30" />
            <Skeleton className="h-10 w-48 rounded-xl bg-black/10" />
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <Skeleton className="h-8 w-12 mt-2" />
              <Skeleton className="h-3 w-24 mt-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Employee table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-6xl mx-auto">
        {/* Table header with search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100">
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-64 rounded-md" />
            <Skeleton className="h-10 w-40 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex gap-8">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-8 border-b border-slate-100">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <div className="flex flex-col gap-1">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100">
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      </div>

      {/* Calendar section */}
      <div className="grid gap-4 lg:grid-cols-3 max-w-6xl mx-auto">
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Skeleton className="h-6 w-32 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 px-4 py-3 flex items-start gap-3">
                <div className="text-center">
                  <Skeleton className="h-6 w-8 mb-1" />
                  <Skeleton className="h-3 w-6" />
                </div>
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <span className="sr-only">Chargement des employés...</span>
    </div>
  );
}

export default EmployeesAdminSkeleton;
