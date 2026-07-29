import Link from "next/link";
import { cn } from "./ui";

/**
 * Foodline wordmark: Fraunces with the terracotta basket-dot over the i.
 * on="light" for oat/white surfaces, on="dark" for espresso surfaces.
 */
export function Logo({
  on = "light",
  size = "md",
  href,
  className,
}: {
  on?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}) {
  const text = on === "light" ? "text-espresso" : "text-cream";
  const px = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-[22px]";
  const mark = (
    <span className={cn("font-display font-semibold tracking-tight inline-flex items-baseline", px, text, className)}>
      food
      <span className="relative">
        l<span className={cn("absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-full", on === "light" ? "bg-terra" : "bg-mango", size === "sm" ? "size-1" : "size-1.5")} aria-hidden />
      </span>
      ine
    </span>
  );
  if (href) {
    return (
      <Link href={href} aria-label="Foodline home" className="inline-flex">
        {mark}
      </Link>
    );
  }
  return mark;
}
