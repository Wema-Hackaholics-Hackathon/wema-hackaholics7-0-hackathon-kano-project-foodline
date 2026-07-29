import Link from "next/link";
import { and, desc, eq, like, sql, type SQL } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import { getDb } from "@/db";
import { ledgerEvents } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { Button, Card, EmptyState, PageTitle, Pill, Select, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function humanType(type: string): string {
  return type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; page?: string }>;
}) {
  const { type, q, page } = await searchParams;
  const db = getDb();
  const currentPage = Math.max(1, Number(page ?? "1") || 1);

  const types = await db
    .selectDistinct({ type: ledgerEvents.type })
    .from(ledgerEvents)
    .orderBy(ledgerEvents.type);

  const filters: SQL[] = [];
  if (type) filters.push(eq(ledgerEvents.type, type));
  if (q) filters.push(like(ledgerEvents.message, `%${q}%`));
  const where = filters.length ? and(...filters) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(ledgerEvents)
    .where(where);
  const totalCount = Number(total);

  const rows = await db
    .select()
    .from(ledgerEvents)
    .where(where)
    .orderBy(desc(ledgerEvents.createdAt))
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

  const from = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, totalCount);
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (type) sp.set("type", type);
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/admin/ledger?${s}` : "/admin/ledger";
  };

  return (
    <div className="space-y-5">
      <PageTitle
        title="Audit ledger"
        sub="Every decision the engine takes, in order, with the working behind it."
      />

      <Card className="p-4">
        <form className="flex flex-wrap gap-2 items-end" method="GET">
          <label className="flex-1 min-w-45">
            <span className="block text-sm font-medium text-cocoa mb-1.5">Search message</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="e.g. limit, debit, settlement"
              className={inputCls}
            />
          </label>
          <label className="min-w-45">
            <span className="block text-sm font-medium text-cocoa mb-1.5">Event type</span>
            <Select name="type" defaultValue={type ?? ""}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.type} value={t.type}>
                  {humanType(t.type)}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" className="h-12">
            Filter
          </Button>
          {(type || q) && (
            <Button href="/admin/ledger" variant="secondary" className="h-12">
              Clear
            </Button>
          )}
        </form>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ScrollText className="size-6" />}
            title="No events match these filters"
            body="Try a different event type, or clear the search to see the full decision trail."
            action={
              <Button href="/admin/ledger" variant="secondary">
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-crust bg-wheat/50">
                  <th className="px-4 py-2.5 text-[13px] font-medium text-cocoa whitespace-nowrap">
                    Time
                  </th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-cocoa">Type</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-cocoa">What happened</th>
                  <th className="px-4 py-2.5 text-[13px] font-medium text-cocoa whitespace-nowrap">
                    Actor
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-crust/50 align-top">
                    <td className="px-4 py-3 text-[13px] text-ash tnum whitespace-nowrap">
                      {formatDateTime(row.createdAt.getTime())}
                    </td>
                    <td className="px-4 py-3">
                      <Pill>{humanType(row.type)}</Pill>
                    </td>
                    <td className="px-4 py-3 text-sm text-espresso min-w-75">
                      {row.message}
                      {row.data ? (
                        <details className="mt-1.5">
                          <summary className="text-[13px] text-terra-deep cursor-pointer select-none">
                            Show working
                          </summary>
                          <pre className="mt-2 bg-wheat rounded-sm p-3 text-[11px] text-cocoa overflow-x-auto">
                            {JSON.stringify(row.data, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ash whitespace-nowrap">{row.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-ash tnum">
            Showing {from} to {to} of {totalCount}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={qs(currentPage - 1)}
                className="inline-flex items-center h-11 px-4 rounded-full border border-crust bg-white text-sm hover:bg-cream"
              >
                Previous
              </Link>
            )}
            {to < totalCount && (
              <Link
                href={qs(currentPage + 1)}
                className="inline-flex items-center h-11 px-4 rounded-full border border-crust bg-white text-sm hover:bg-cream"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
