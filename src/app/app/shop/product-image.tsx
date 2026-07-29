"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";
import { cn } from "@/components/ui";

/**
 * Product photo with a graceful fallback: if the image is missing or fails to
 * load, a calm wheat tile with a utensils mark takes its place.
 */
export function ProductImage({
  src,
  alt,
  className,
  iconClassName = "size-8",
}: {
  src: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-wheat text-ash/70", className)}
      >
        <Utensils className={iconClassName} aria-hidden />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
