import { Skeleton } from "@/components/ui";

export default function HistoryLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-20" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-44" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-32" />
    </div>
  );
}
