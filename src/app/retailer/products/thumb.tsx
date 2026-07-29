"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Product photo with a warm fallback tile. next/image is not configured on
 * this deployment, so this is a plain img that degrades on any load failure.
 */
export function Thumb({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = cn("size-14 shrink-0 rounded-sm bg-wheat", className);

  if (!src || failed) {
    return (
      <span className={cn(box, "flex items-center justify-center text-ash/70")} aria-hidden>
        <Utensils className="size-5" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(box, "object-cover")}
      onError={() => setFailed(true)}
    />
  );
}
