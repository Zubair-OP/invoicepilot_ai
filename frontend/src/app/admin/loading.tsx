import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading admin panel">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:px-6 border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-9 w-48 rounded-xl" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-md mt-2" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <Skeleton className="h-4 w-48 rounded-md mb-4" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <Skeleton className="h-4 w-40 rounded-md mb-4" />
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}