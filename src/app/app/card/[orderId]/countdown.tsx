"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { Pill } from "@/components/ui";

function label(msLeft: number): string {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Live expiry ticker for an issued card. When time runs out it refreshes the
 * page so the server renders the expired state.
 */
export function ExpiryCountdown({ expiresAtMs }: { expiresAtMs: number }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const refreshed = useRef(false);

  const msLeft = expiresAtMs - now;

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Date.now()),
      expiresAtMs - Date.now() > 3_600_000 ? 30_000 : 1_000
    );
    return () => window.clearInterval(interval);
  }, [expiresAtMs]);

  useEffect(() => {
    if (msLeft <= 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [msLeft, router]);

  if (msLeft <= 0) {
    return <Pill tone="neutral">Expired</Pill>;
  }
  const soon = msLeft < 3_600_000;
  return (
    <Pill tone={soon ? "warn" : "neutral"} className="tnum" aria-live="off">
      <Timer className="size-3.5" aria-hidden />
      Expires in {label(msLeft)}
    </Pill>
  );
}
