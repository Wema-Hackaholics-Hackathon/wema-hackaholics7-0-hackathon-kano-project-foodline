import { Skeleton } from "@/components/ui";

export default function ApplyLoading() {
  return (
    <>
      <div className="awning h-1 shrink-0" aria-hidden />
      <div className="border-b border-crust/60 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-5">
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1.5 h-4 w-2/3" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2, 3].map((section) => (
            <div key={section} className="rounded-lg border border-crust/60 bg-white p-5 shadow-1">
              <div className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-3.5 w-56" />
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="mt-1.5 h-12 w-full" />
                </div>
                <div>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="mt-1.5 h-12 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
