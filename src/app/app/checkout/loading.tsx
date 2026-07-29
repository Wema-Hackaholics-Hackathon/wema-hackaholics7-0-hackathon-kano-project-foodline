import { Skeleton } from "@/components/ui";

export default function CheckoutLoading() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-5 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-full max-w-sm" />
      <div className="mt-6 space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-13 w-full rounded-full" />
      </div>
    </div>
  );
}
