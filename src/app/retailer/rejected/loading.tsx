import { Skeleton } from "@/components/ui";

export default function RejectedLoading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-8 w-4/5" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-1/2" />
      </div>
      <Skeleton className="h-20 w-full rounded-md" />
      <div className="rounded-lg border border-crust/60 bg-white p-5 shadow-1">
        <Skeleton className="h-5 w-44" />
        <div className="mt-5 space-y-5">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3.5 w-full" />
                <Skeleton className="mt-1.5 h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-13 w-full rounded-full sm:w-64" />
      </div>
    </div>
  );
}
