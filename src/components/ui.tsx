import Link from "next/link";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { formatNaira, formatNairaWhole } from "@/lib/money";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons: pill primaries per the design system; 44px+ touch targets
// ---------------------------------------------------------------------------

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  size?: "md" | "lg" | "sm";
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  form?: string;
};

const BTN_VARIANT: Record<string, string> = {
  primary:
    "bg-terra text-white hover:bg-terra-deep active:bg-terra-deep shadow-1 disabled:bg-crust disabled:text-ash",
  secondary:
    "bg-white text-espresso border border-crust hover:border-cocoa/40 hover:bg-cream disabled:text-ash",
  ghost: "bg-transparent text-terra-deep hover:bg-terra-tint disabled:text-ash",
  danger: "bg-bad-tint text-bad hover:bg-bad hover:text-white disabled:opacity-50",
  dark: "bg-espresso text-cream hover:bg-espresso-2 disabled:opacity-60",
};

const BTN_SIZE: Record<string, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-13 px-8 text-base",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  type = "button",
  disabled,
  loading,
  className,
  onClick,
  form,
}: ButtonProps) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 select-none whitespace-nowrap",
    BTN_VARIANT[variant],
    BTN_SIZE[size],
    (disabled || loading) && "pointer-events-none",
    className
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled || loading} className={cls} onClick={onClick} form={form}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag className={cn("bg-white rounded-lg shadow-1 border border-crust/60 p-5", className)}>
      {children}
    </Tag>
  );
}

export function DarkCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-espresso text-cream rounded-lg p-5 border border-cream/10",
        className
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pills + notices
// ---------------------------------------------------------------------------

export type Tone = "good" | "warn" | "bad" | "note" | "neutral" | "terra";

const TONE_PILL: Record<Tone, string> = {
  good: "bg-good-tint text-good",
  warn: "bg-warn-tint text-warn",
  bad: "bg-bad-tint text-bad",
  note: "bg-note-tint text-note",
  neutral: "bg-wheat text-cocoa",
  terra: "bg-terra-tint text-terra-deep",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_PILL[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "note",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md px-4 py-3 text-sm leading-relaxed", TONE_PILL[tone], className)}>
      {title && <p className="font-semibold mb-0.5">{title}</p>}
      <div className="[&_a]:underline">{children}</div>
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-mango/15 text-warn border border-mango/40 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        className
      )}
    >
      Demo
    </span>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-sm font-medium text-cocoa mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-[13px] text-ash mt-1.5 leading-snug">{hint}</span>}
      {error && <span className="block text-[13px] text-bad mt-1.5">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-12 rounded-md border border-crust bg-white px-4 text-[15px] text-espresso placeholder:text-ash/70 focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/20 transition-shadow disabled:bg-wheat disabled:text-ash";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn(inputCls, className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={cn(inputCls, "appearance-none pr-10 bg-no-repeat bg-[right_1rem_center] bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20stroke%3D%22%236B5E55%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E')]", className)}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={cn(inputCls, "h-auto min-h-24 py-3 leading-relaxed", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading + empty states
// ---------------------------------------------------------------------------

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md", className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("text-center py-12 px-6", className)}>
      {icon && (
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-terra-tint text-terra">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg text-espresso">{title}</h3>
      {body && <p className="text-sm text-ash mt-1.5 max-w-sm mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Money + stats
// ---------------------------------------------------------------------------

export function Money({
  kobo,
  whole = false,
  className,
}: {
  kobo: number;
  whole?: boolean;
  className?: string;
}) {
  return <span className={cn("tnum", className)}>{whole ? formatNairaWhole(kobo) : formatNaira(kobo)}</span>;
}

export function Stat({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[13px] text-ash truncate">{label}</p>
      <p className={cn("font-display text-2xl mt-0.5 tnum", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>
        {value}
      </p>
      {sub && <p className="text-[13px] text-ash mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress: segmented step bar + the Plate Ring gauge
// ---------------------------------------------------------------------------

export function StepBar({
  total,
  current,
  className,
}: {
  total: number;
  current: number; // 1-based
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1.5", className)} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            i < current ? "bg-terra" : "bg-crust"
          )}
        />
      ))}
    </div>
  );
}

/**
 * The Plate Ring: circular gauge drawn like a plate rim. Wheat track,
 * terracotta fill, mango tip dot. fraction in [0, 1].
 */
export function PlateRing({
  fraction,
  size = 160,
  stroke = 10,
  children,
  className,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  className?: string;
}) {
  const f = Math.max(0, Math.min(1, fraction));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const angle = f * 2 * Math.PI - Math.PI / 2;
  const tipX = size / 2 + r * Math.cos(angle);
  const tipY = size / 2 + r * Math.sin(angle);
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-wheat)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-terra)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * f} ${c}`}
          style={{ transition: "stroke-dasharray 0.9s var(--ease-fl)" }}
        />
      </svg>
      {f > 0.01 && f < 0.995 && (
        <span
          className="absolute size-2 rounded-full bg-mango shadow-1"
          style={{ left: tipX - 4, top: tipY - 4 }}
          aria-hidden
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page scaffolding helpers
// ---------------------------------------------------------------------------

export function PageTitle({
  title,
  sub,
  right,
  className,
}: {
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-2xl md:text-[28px] text-espresso leading-tight">{title}</h1>
        {sub && <p className="text-sm text-ash mt-1">{sub}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-crust/70", className)} />;
}
