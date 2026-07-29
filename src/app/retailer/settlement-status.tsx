import { Pill, type Tone } from "@/components/ui";

const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  success: { tone: "good", label: "Settled" },
  pending: { tone: "warn", label: "Pending" },
  failed: { tone: "bad", label: "Failed" },
  reversed: { tone: "neutral", label: "Reversed" },
};

export function SettlementStatusPill({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { tone: "neutral" as Tone, label: status };
  return <Pill tone={entry.tone}>{entry.label}</Pill>;
}
