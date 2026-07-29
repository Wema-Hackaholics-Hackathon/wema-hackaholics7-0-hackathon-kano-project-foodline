"use client";

import { Button, Card } from "@/components/ui";

export default function AdminError({ error }: { error: Error }) {
  return (
    <Card className="max-w-md mx-auto mt-12 text-center p-8">
      <h1 className="font-display text-xl text-espresso">This screen could not load</h1>
      <p className="text-sm text-ash mt-2 leading-relaxed">
        Something went wrong while fetching operations data. Nothing was changed. Try again, and if
        it keeps happening check the Worker logs.
      </p>
      <p className="text-[13px] text-ash/80 mt-3 break-words">{error.message}</p>
      <div className="mt-5 flex gap-2 justify-center">
        <Button href="/admin" variant="secondary">
          Back to dashboard
        </Button>
      </div>
    </Card>
  );
}
