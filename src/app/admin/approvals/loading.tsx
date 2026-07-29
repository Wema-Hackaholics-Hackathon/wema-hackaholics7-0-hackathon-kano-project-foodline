import { Skeleton } from "@/components/ui";

export default function ApprovalsLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-48 rounded-full" />
        <Skeleton className="h-11 w-44 rounded-full" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-72" />
      ))}
    </div>
  );
}
