import { Skeleton } from "@/components/ui";

export default function RetailerProductsLoading() {
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-36" />
        </div>
        <Skeleton className="h-11 w-36 rounded-full" />
      </div>

      <div className="flex gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-full" />
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-crust/60 bg-white p-5 shadow-1">
            <div className="flex items-start gap-3">
              <Skeleton className="size-14 rounded-sm" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-3 w-24" />
                <Skeleton className="mt-1.5 h-3 w-36" />
              </div>
            </div>
            <div className="mt-4 space-y-3 border-t border-crust/60 pt-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
