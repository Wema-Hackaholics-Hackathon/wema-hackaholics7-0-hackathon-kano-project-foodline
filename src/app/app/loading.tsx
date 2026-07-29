import { Skeleton } from "@/components/ui";

export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>
      <div className="rounded-lg border border-crust/60 bg-white p-6 shadow-1">
        <div className="flex flex-col items-center">
          <Skeleton className="size-[190px] rounded-full" />
          <Skeleton className="mt-4 h-4 w-32" />
          <Skeleton className="mt-4 h-8 w-64 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
