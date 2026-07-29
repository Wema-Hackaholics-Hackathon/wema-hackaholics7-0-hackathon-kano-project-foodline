import { Skeleton } from "@/components/ui";

export default function ProductLoading() {
  return (
    <div>
      <Skeleton className="h-5 w-36" />
      <div className="mt-4 md:grid md:grid-cols-2 md:gap-8">
        <Skeleton className="aspect-square w-full rounded-lg md:aspect-[4/3]" />
        <div className="mt-5 md:mt-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-3/4" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-6 space-y-2.5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="mt-6 h-13 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
