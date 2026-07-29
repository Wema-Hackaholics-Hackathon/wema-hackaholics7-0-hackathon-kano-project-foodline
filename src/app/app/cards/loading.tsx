import { Skeleton } from "@/components/ui";

export default function CardsLoading() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[76px] w-full" />
        ))}
      </div>
    </div>
  );
}
