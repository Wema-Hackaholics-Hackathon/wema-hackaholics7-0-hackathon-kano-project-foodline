"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { PlateRing } from "@/components/ui";
import { formatNairaWhole } from "@/lib/money";

/**
 * The home hero: Plate Ring gauge with the available amount inside and an
 * over-the-shoulder privacy toggle.
 */
export function AvailableHero({
  availableKobo,
  limitKobo,
}: {
  availableKobo: number;
  limitKobo: number;
}) {
  const [hidden, setHidden] = useState(false);
  const fraction = limitKobo > 0 ? availableKobo / limitKobo : 0;

  return (
    <div className="flex flex-col items-center">
      <PlateRing fraction={fraction} size={190} stroke={12}>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ash">
          Available
        </span>
        <span className="font-display text-[27px] leading-tight text-espresso tnum">
          {hidden ? "₦••••••" : formatNairaWhole(availableKobo)}
        </span>
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          aria-label={hidden ? "Show available amount" : "Hide available amount"}
          aria-pressed={hidden}
          className="mt-1 flex size-9 items-center justify-center rounded-full text-ash transition-colors hover:bg-wheat hover:text-cocoa"
        >
          {hidden ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
        </button>
      </PlateRing>
      <p className="mt-3 text-sm text-ash">
        of <span className="font-medium text-cocoa tnum">{formatNairaWhole(limitKobo)}</span> limit
      </p>
    </div>
  );
}
