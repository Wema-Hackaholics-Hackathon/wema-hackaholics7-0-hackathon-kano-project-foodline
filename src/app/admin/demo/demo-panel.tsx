"use client";

import { useActionState, useState } from "react";
import { Banknote, RefreshCw } from "lucide-react";
import { Button, Card, Notice, Pill, inputCls } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";
import { reseed, type ActionState } from "./actions";

export type DemoCustomer = {
  id: string;
  name: string;
  firstName: string;
  salaryKobo: number;
  nextPayDate: string | null;
  outstandingKobo: number;
};

type Outcome = { attempted: boolean; status?: string; message: string };
type SimResult = { matched: boolean; amountKobo: number; outcomes: Outcome[] } | { error: string };

export function SalarySimulator({ customers }: { customers: DemoCustomer[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; data: SimResult } | null>(null);

  async function run(customer: DemoCustomer) {
    setBusy(customer.id);
    setResult(null);
    try {
      const res = await fetch("/api/demo/simulate-salary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerId: customer.id }),
      });
      const data = (await res.json()) as SimResult;
      setResult({ id: customer.id, data });
    } catch {
      setResult({ id: customer.id, data: { error: "Could not reach the server. Try again." } });
    } finally {
      setBusy(null);
    }
  }

  if (customers.length === 0) {
    return <p className="text-sm text-ash py-3">No demo customers found. Reseed to create them.</p>;
  }

  return (
    <div className="space-y-3">
      {customers.map((c) => (
        <div key={c.id} className="border-b border-crust/60 last:border-0 pb-3 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-espresso">{c.name}</p>
              <p className="text-[13px] text-ash tnum">
                Salary {formatNaira(c.salaryKobo)}
                {c.nextPayDate ? `, next payday ${formatDateShort(c.nextPayDate)}` : ""}
                {c.outstandingKobo > 0 ? `, owes ${formatNaira(c.outstandingKobo)}` : ", owes nothing"}
              </p>
            </div>
            <Button
              onClick={() => run(c)}
              loading={busy === c.id}
              disabled={busy !== null}
              className="shrink-0"
            >
              <Banknote className="size-4" aria-hidden />
              Pay {c.firstName}&apos;s salary
            </Button>
          </div>

          {result?.id === c.id && (
            <div className="mt-3 space-y-2 animate-rise">
              {"error" in result.data ? (
                <Notice tone="bad">{result.data.error}</Notice>
              ) : (
                <>
                  <Notice tone={result.data.matched ? "good" : "warn"}>
                    {result.data.matched
                      ? `Salary credit of ${formatNaira(result.data.amountKobo)} matched the verified salary signature.`
                      : `Credit of ${formatNaira(result.data.amountKobo)} did not match the salary signature, so no debit was triggered.`}
                  </Notice>
                  {result.data.outcomes.map((o, i) => (
                    <Notice
                      key={i}
                      tone={o.status === "successful" ? "good" : o.attempted ? "bad" : "note"}
                    >
                      {o.status === "successful" ? "Installment collected. " : ""}
                      {o.message}
                    </Notice>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SweepRunner() {
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setStats(null);
    try {
      const res = await fetch("/api/jobs/sweep", { method: "POST" });
      const data = (await res.json()) as Record<string, number> & { error?: string };
      if (data.error) setError(String(data.error));
      else
        setStats({
          attempted: data.attempted,
          succeeded: data.succeeded,
          failed: data.failed,
          markedOverdue: data.markedOverdue,
        });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button onClick={run} loading={busy} variant="secondary">
        <RefreshCw className="size-4" aria-hidden />
        Run debit sweep
      </Button>
      {error && (
        <Notice tone="bad" className="mt-3">
          {error}
        </Notice>
      )}
      {stats && (
        <div className="flex flex-wrap gap-2 mt-3 animate-rise">
          <Pill tone="note">Attempted: <span className="tnum">{stats.attempted}</span></Pill>
          <Pill tone="good">Collected: <span className="tnum">{stats.succeeded}</span></Pill>
          <Pill tone="bad">Failed: <span className="tnum">{stats.failed}</span></Pill>
          <Pill tone="warn">Marked overdue: <span className="tnum">{stats.markedOverdue}</span></Pill>
        </div>
      )}
    </div>
  );
}

export function ReseedCard() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reseed, {
    error: null,
  });
  const [confirm, setConfirm] = useState("");

  return (
    <Card className="border-bad/30 bg-bad-tint/40">
      <h2 className="font-display text-lg text-espresso">Reseed demo data</h2>
      <p className="text-sm text-cocoa mt-1.5 leading-relaxed">
        This wipes every record: customers, orders, loans, settlements, sessions and the catalog,
        then rebuilds the demo state from scratch. Everyone signed in is signed out, including you.
        Do this before a demo, never during one.
      </p>
      <form action={formAction} className="mt-4 flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-50">
          <span className="block text-sm font-medium text-cocoa mb-1.5">
            Type RESEED to confirm
          </span>
          <input
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="RESEED"
            className={inputCls}
          />
        </label>
        <Button
          type="submit"
          variant="danger"
          loading={pending}
          disabled={confirm.trim().toUpperCase() !== "RESEED"}
          className="h-12"
        >
          Wipe and reseed
        </Button>
      </form>
      {state.error && (
        <Notice tone="bad" className="mt-3">
          {state.error}
        </Notice>
      )}
    </Card>
  );
}
