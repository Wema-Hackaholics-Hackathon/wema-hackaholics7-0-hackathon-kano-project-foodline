import { Skeleton } from "@/components/ui";

export default function LimitLoading() {
  return (
    <main className="flex-1 px-5 py-6">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between min-h-11">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-1 w-full mt-3 rounded-full" />
        <Skeleton className="h-3 w-32 mt-3" />
        <div className="flex flex-col items-center mt-10" aria-hidden>
          <Skeleton className="size-56 rounded-full" />
          <Skeleton className="h-8 w-64 mt-8" />
          <Skeleton className="h-4 w-72 mt-3" />
        </div>
        <Skeleton className="h-44 w-full rounded-lg mt-8" />
        <Skeleton className="h-13 w-full rounded-full mt-8" />
      </div>
    </main>
  );
}
