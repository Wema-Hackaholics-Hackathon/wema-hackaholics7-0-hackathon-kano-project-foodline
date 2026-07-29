"use client";

// Basket state for the customer area. Lines live in localStorage under
// "fl-cart" so a market run survives refreshes; the server re-validates
// every line before money moves (see cart/actions.ts).

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ShoppingBasket } from "lucide-react";

const STORAGE_KEY = "fl-cart";
export const MAX_QTY = 50;

export type CartLine = { productUnitId: string; qty: number };

type CartContextValue = {
  lines: CartLine[];
  /** total units across all lines */
  count: number;
  /** true once localStorage has been read; render nothing cart-shaped before */
  hydrated: boolean;
  addLine: (productUnitId: string, qty: number, maxQty?: number) => void;
  setQty: (productUnitId: string, qty: number) => void;
  removeLine: (productUnitId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as CartLine).productUnitId === "string" &&
          typeof (l as CartLine).qty === "number"
      )
      .map((l) => ({ productUnitId: l.productUnitId, qty: clampQty(l.qty) }));
  } catch {
    return [];
  }
}

function clampQty(qty: number, max = MAX_QTY): number {
  return Math.max(1, Math.min(max, Math.round(qty)));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setLines(readStorage());
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage full or blocked: the in-memory basket still works this session
    }
  }, [lines]);

  const addLine = useCallback((productUnitId: string, qty: number, maxQty = MAX_QTY) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productUnitId === productUnitId);
      if (existing) {
        return prev.map((l) =>
          l.productUnitId === productUnitId
            ? { ...l, qty: clampQty(l.qty + qty, Math.min(maxQty, MAX_QTY)) }
            : l
        );
      }
      return [...prev, { productUnitId, qty: clampQty(qty, Math.min(maxQty, MAX_QTY)) }];
    });
  }, []);

  const setQty = useCallback((productUnitId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.productUnitId === productUnitId ? { ...l, qty: clampQty(qty) } : l))
    );
  }, []);

  const removeLine = useCallback((productUnitId: string) => {
    setLines((prev) => prev.filter((l) => l.productUnitId !== productUnitId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      hydrated,
      addLine,
      setQty,
      removeLine,
      clear,
    }),
    [lines, hydrated, addLine, setQty, removeLine, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

/**
 * Floating basket pill: appears anywhere in the area once the basket has
 * items, except on the basket, checkout and card screens themselves.
 */
export function FloatingBasket() {
  const { count, hydrated } = useCart();
  const pathname = usePathname();
  if (!hydrated || count === 0) return null;
  if (
    pathname.startsWith("/app/cart") ||
    pathname.startsWith("/app/checkout") ||
    pathname.startsWith("/app/card/")
  ) {
    return null;
  }
  return (
    <Link
      href="/app/cart"
      aria-label={`Open your basket, ${count} item${count === 1 ? "" : "s"}`}
      className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-8 z-40 flex h-13 items-center gap-2.5 rounded-full bg-espresso pl-4 pr-5 text-cream shadow-2 animate-pop hover:bg-espresso-2 transition-colors"
    >
      <ShoppingBasket className="size-5 text-mango" aria-hidden />
      <span className="text-sm font-medium">Basket</span>
      <span className="flex size-5 items-center justify-center rounded-full bg-mango text-[11px] font-semibold text-espresso tnum">
        {count}
      </span>
    </Link>
  );
}
