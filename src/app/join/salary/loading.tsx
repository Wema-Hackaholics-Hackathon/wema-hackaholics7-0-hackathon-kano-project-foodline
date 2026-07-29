import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui";

export default function SalaryLoading() {
  return (
    <main className="flex-1 px-5 py-6">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center justify-between min-h-11">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-1 w-full mt-3 rounded-full" />
        <Skeleton className="h-3 w-32 mt-3" />

        <div className="mt-12 text-center" role="status" aria-live="polite">
          <Loader2 className="size-7 animate-spin text-terra mx-auto" aria-hidden />
          <p className="font-display text-xl text-espresso mt-4">Checking your salary...</p>
          <p className="text-sm text-ash mt-2 max-w-xs mx-auto leading-relaxed">
            We are reading your statement and looking for a steady monthly salary. A few seconds.
          </p>
        </div>

        <div className="mt-10 space-y-3" aria-hidden>
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </main>
  );
}
