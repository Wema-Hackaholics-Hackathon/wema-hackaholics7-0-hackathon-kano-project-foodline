"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Utensils } from "lucide-react";
import { Button, Card, cn } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { bulkSetActive, toggleProductActive } from "./actions";

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  imageKey: string | null;
  active: boolean;
  unitSummary: string;
  totalStock: number;
};

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex size-10 items-center justify-center rounded-sm bg-wheat text-ash/60">
        <Utensils className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-10 rounded-sm object-cover bg-wheat"
      onError={() => setFailed(true)}
    />
  );
}

function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [optimistic, setOptimistic] = useState(active);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={optimistic ? "Set unavailable" : "Set available"}
      disabled={pending}
      onClick={() => {
        const next = !optimistic;
        setOptimistic(next);
        startTransition(() => {
          void toggleProductActive(id, next);
        });
      }}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        optimistic ? "bg-good" : "bg-crust",
        pending && "opacity-60"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-1 transition-all",
          optimistic ? "left-5.5" : "left-0.5"
        )}
      />
    </button>
  );
}

export function ProductsTable({ rows }: { rows: ProductRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.length === rows.length;

  const runBulk = (active: boolean) =>
    startTransition(() => {
      void bulkSetActive(selected, active).then(() => setSelected([]));
    });

  return (
    <>
      {selected.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 py-3 bg-terra-tint border-terra/20">
          <p className="text-sm text-terra-deep font-medium">
            {selected.length} selected
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" loading={pending} onClick={() => runBulk(true)}>
              Set available
            </Button>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => runBulk(false)}>
              Set unavailable
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-crust bg-wheat/50">
                <th className="pl-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all products"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                    className="size-4 accent-[var(--color-terra)]"
                  />
                </th>
                <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Product</th>
                <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Units</th>
                <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa whitespace-nowrap">
                  Stock
                </th>
                <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Available</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-crust/50">
                  <td className="pl-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.name}`}
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, row.id] : s.filter((id) => id !== row.id)
                        )
                      }
                      className="size-4 accent-[var(--color-terra)]"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Thumb src={row.imageKey} alt={row.name} />
                      <div className="min-w-0">
                        <p className="text-sm text-espresso truncate">{row.name}</p>
                        <p className="text-[13px] text-ash truncate">{row.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[13px] text-cocoa min-w-45">{row.unitSummary}</td>
                  <td className="px-3 py-3 text-sm text-cocoa tnum">{row.totalStock}</td>
                  <td className="px-3 py-3">
                    <ActiveToggle id={row.id} active={row.active} />
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/products/${row.id}/edit`}
                      className="text-sm text-terra-deep hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function unitSummary(units: { unitLabel: string; priceKobo: number }[]): string {
  if (units.length === 0) return "No units";
  const first = `${units[0].unitLabel} ${formatNaira(units[0].priceKobo)}`;
  return units.length === 1 ? first : `${first} and ${units.length - 1} more`;
}
