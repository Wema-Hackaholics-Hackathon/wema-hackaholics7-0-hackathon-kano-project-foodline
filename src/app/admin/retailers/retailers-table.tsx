"use client";

import { useState, useTransition } from "react";
import { Button, Card, Pill, cn } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { relinkRecipient, toggleRetailerActive } from "./actions";

export type RetailerRow = {
  id: string;
  businessName: string;
  contactPhone: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  hasRecipient: boolean;
  active: boolean;
  isDemo: boolean;
  createdAt: string;
};

function ActiveToggle({ id, active }: { id: string; active: boolean }) {
  const [optimistic, setOptimistic] = useState(active);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={optimistic ? "Deactivate retailer" : "Activate retailer"}
      disabled={pending}
      onClick={() => {
        const next = !optimistic;
        setOptimistic(next);
        startTransition(() => {
          void toggleRetailerActive(id, next);
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

function RelinkButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(() => {
          void relinkRecipient(id);
        })
      }
    >
      Link
    </Button>
  );
}

export function RetailersTable({ rows }: { rows: RetailerRow[] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-crust bg-wheat/50">
              <th className="px-4 py-2.5 text-[13px] font-medium text-cocoa">Store</th>
              <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Settlement account</th>
              <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Paystack</th>
              <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Active</th>
              <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa whitespace-nowrap">
                Added
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-crust/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-espresso truncate">{row.businessName}</p>
                      <p className="text-[13px] text-ash tnum">{row.contactPhone ?? "No phone"}</p>
                    </div>
                    {row.isDemo && <Pill tone="terra">Demo</Pill>}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <p className="text-sm text-cocoa">
                    {row.bankName}{" "}
                    <span className="tnum text-ash">
                      ••{row.accountNumber.slice(-4)}
                    </span>
                  </p>
                  <p className="text-[13px] text-ash truncate max-w-50">{row.accountName}</p>
                </td>
                <td className="px-3 py-3">
                  {row.hasRecipient ? (
                    <Pill tone="good">Linked</Pill>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Pill tone="warn">Not linked</Pill>
                      <RelinkButton id={row.id} />
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <ActiveToggle id={row.id} active={row.active} />
                </td>
                <td className="px-3 py-3 text-[13px] text-ash whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
