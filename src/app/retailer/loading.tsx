import { Skeleton } from "@/components/ui";

export default function RetailerLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-28" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="mt-5 grid grid-cols-2 gap-5 rounded-lg border border-crust/60 bg-white p-5 shadow-1 md:grid-cols-3">
        <div>
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="mt-2 h-7 w-24" />
        </div>
        <div>
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="mt-2 h-7 w-24" />
        </div>
        <div className="hidden md:block">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-2 h-7 w-12" />
        </div>
      </div>
      <Skeleton className="mt-7 h-4 w-36" />
      <div className="mt-2 space-y-px overflow-hidden rounded-lg border border-crust/60 bg-white shadow-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </div>
            <div className="flex flex-col items-end">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1.5 h-4 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
