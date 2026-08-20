import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-7xl" role="status" aria-label="Loading dashboard">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-52 rounded-md" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20 rounded-md mb-2" />
            <Skeleton className="h-7 w-28 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-md mt-2" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <Skeleton className="h-5 w-36 rounded-md" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-16 rounded-md ml-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-32 rounded-md" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-sm p-5 space-y-3">
            <Skeleton className="h-5 w-32 rounded-md bg-slate-700/60" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl bg-slate-700/40" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}