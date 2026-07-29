import { Skeleton } from "@/components/ui";

export default function RepaymentsLoading() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-6 h-28 w-full" />
      <Skeleton className="mt-5 h-64 w-full" />
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );
}
