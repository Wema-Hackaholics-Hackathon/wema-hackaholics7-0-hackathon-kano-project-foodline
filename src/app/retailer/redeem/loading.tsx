import { Skeleton } from "@/components/ui";

export default function RedeemLoading() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-5 h-11 w-full rounded-full" />
      <Skeleton className="mt-4 aspect-square w-full rounded-lg" />
      <Skeleton className="mt-3 h-12 w-full rounded-full" />
    </div>
  );
}
