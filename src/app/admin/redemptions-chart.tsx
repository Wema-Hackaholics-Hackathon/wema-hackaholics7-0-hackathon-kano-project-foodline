"use client";

import { useState } from "react";
import { formatNaira } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export type Day = { date: string; count: number; totalKobo: number };

/**
 * Single-series daily redemption bars. One series, so the section title
 * names it and no legend is drawn. Hit targets span the full column.
 */
export function RedemptionsChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.count), 1);
  const maxIndex = days.findIndex((d) => d.count === max && d.count > 0);

  return (
    <div className="relative">
      <div className="flex items-end gap-[2px] h-40">
        {days.map((d, i) => {
          const pct = d.count > 0 ? Math.max((d.count / max) * 100, 2) : 0;
          return (
            <div
              key={d.date}
              className="flex-1 h-full flex flex-col justify-end items-center relative cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {i === maxIndex && (
                <span className="text-[11px] text-cocoa tnum mb-1 font-medium">{d.count}</span>
              )}
              {pct > 0 && (
                <div
                  className="w-full bg-terra rounded-t-[4px] transition-opacity"
                  style={{ height: `${pct}%`, opacity: hover === null || hover === i ? 1 : 0.55 }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="h-px bg-crust" />
      <div className="flex gap-[2px] mt-1.5">
        {days.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % 2 === 0 && (
              <span className="text-[11px] text-ash tnum">{d.date.slice(8, 10)}</span>
            )}
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="absolute -top-2 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-espresso text-cream rounded-sm px-3 py-2 text-xs shadow-2">
            <p className="font-medium">{formatDate(days[hover].date)}</p>
            <p className="text-cream/75 tnum">
              {days[hover].count} redemption{days[hover].count === 1 ? "" : "s"},{" "}
              {formatNaira(days[hover].totalKobo)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
