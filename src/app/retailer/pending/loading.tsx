import { Skeleton } from "@/components/ui";

export default function PendingLoading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="mt-3 h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
      </div>
      <div className="rounded-lg border border-crust/60 bg-white p-5 shadow-1">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-4 w-32" />
      <div className="space-y-px rounded-lg border border-crust/60 bg-white p-5 shadow-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4 py-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-2 h-3.5 w-full" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  );
}
