import QRCode from "react-qr-code";
import { Logo } from "@/components/logo";
import { cn } from "@/components/ui";

/**
 * The Foodline Card: the brand artifact. Bank-card ratio, espresso-to-ember
 * gradient, woven texture, golden chip, spaced voucher code and a cream QR
 * tile with a soft mango glow. Rendered as a sample card for the hero.
 */
export function FoodlineCard({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <style>{`
        .fl-card-float {
          transform: rotate(-4deg);
          animation: fl-card-float 7s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes fl-card-float {
          0%, 100% { transform: rotate(-4deg) translateY(0); }
          50% { transform: rotate(-3.2deg) translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fl-card-float { animation: none; }
        }
      `}</style>
      <div
        className="fl-card-float relative w-full aspect-[1586/1000] rounded-xl overflow-hidden shadow-card select-none"
        role="img"
        aria-label="A sample Foodline Card for Adaeze Okafor with code FL-8PM3QK, valid for 72 hours, carrying a QR code for the store to scan"
      >
        {/* Base gradient: banklike espresso at the top, warming to an ember */}
        <div
          className="absolute inset-0 bg-[linear-gradient(135deg,#2B1B15_0%,#3D2417_52%,#7A2E0E_100%)]"
          aria-hidden
        />
        {/* Woven-basket texture */}
        <div className="absolute inset-0 card-weave" aria-hidden />
        {/* Soft top-left light sweep */}
        <div
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_18%_0%,rgba(255,249,241,0.08),transparent_60%)]"
          aria-hidden
        />
        {/* Mango glow behind the QR corner */}
        <div
          className="absolute -bottom-10 -right-10 size-44 sm:size-56 rounded-full bg-mango/25 blur-3xl"
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <Logo on="dark" />
            <span className="pt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/50">
              Food credit line
            </span>
          </div>

          <div>
            <CardChip />
            <p className="tnum mt-2.5 sm:mt-3.5 text-lg sm:text-2xl font-medium tracking-[0.3em] text-cream/90">
              FL-8PM3QK
            </p>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1.5 sm:space-y-2.5 min-w-0">
              <div>
                <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.24em] text-cream/50">
                  Card holder
                </p>
                <p className="mt-0.5 text-[13px] sm:text-base font-medium tracking-[0.14em] text-cream truncate">
                  ADAEZE OKAFOR
                </p>
              </div>
              <div>
                <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.24em] text-cream/50">
                  Valid thru
                </p>
                <p className="mt-0.5 text-[11px] sm:text-[13px] font-medium tracking-[0.14em] text-cream/90">
                  72 HOURS
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-[12px] bg-cream p-1.5 sm:p-2 shadow-1">
              <QRCode
                value="https://foodline.com.ng"
                size={72}
                bgColor="#FFF9F1"
                fgColor="#211512"
                className="block size-12 sm:size-18"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Golden EMV-style chip: gradient plate with contact lines. */
function CardChip() {
  return (
    <div
      className="relative h-7 w-10 sm:h-9 sm:w-12 overflow-hidden rounded-[6px] bg-[linear-gradient(135deg,#E8C36A_0%,#D9A94C_45%,#B98A2F_100%)]"
      aria-hidden
    >
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-espresso/30" />
      <div className="absolute inset-y-0 left-1/3 w-px bg-espresso/30" />
      <div className="absolute inset-y-0 right-1/3 w-px bg-espresso/30" />
      <div className="absolute inset-[3px] rounded-[4px] border border-espresso/25" />
    </div>
  );
}
