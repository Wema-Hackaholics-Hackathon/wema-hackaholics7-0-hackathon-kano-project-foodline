import { Skeleton } from "@/components/ui";

export default function CardLoading() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-4 aspect-[1.586/1] w-full rounded-xl" />
      <Skeleton className="mt-5 h-28 w-full" />
      <Skeleton className="mt-4 h-36 w-full" />
    </div>
  );
}
