import { Skeleton } from "@/components/ui";

export default function JoinLoading() {
  return (
    <main className="flex-1 px-5 py-6">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between min-h-11">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-1 w-full mt-3 rounded-full" />
        <Skeleton className="h-3 w-32 mt-3" />
        <Skeleton className="h-8 w-3/4 mt-8" />
        <Skeleton className="h-4 w-full mt-3" />
        <div className="mt-8 space-y-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="h-12 w-full mt-10 rounded-full" />
      </div>
    </main>
  );
}
