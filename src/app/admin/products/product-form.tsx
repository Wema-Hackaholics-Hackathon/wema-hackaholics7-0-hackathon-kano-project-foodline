"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, Utensils } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
  cn,
  inputCls,
} from "@/components/ui";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { priceFor } from "@/lib/catalog";
import { MARKUP_PRESETS_BPS, formatBps, parseMarkupPercent } from "../approvals/review-state";
import { archiveProduct, saveProduct, type ProductState } from "./actions";

export type UnitRow = {
  id: string;
  unitLabel: string;
  costKobo: number;
  stockQty: number;
  active: boolean;
};

export type ProductInput = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageKey: string | null;
  retailerId: string | null;
  markupBps: number | null;
  suggestedMarkupBps: number;
  status: "pending" | "approved" | "rejected" | "archived";
  units: UnitRow[];
};

export type ShopOption = { id: string; businessName: string };

const blankUnit = () => ({
  id: "new",
  unitLabel: "",
  cost: "",
  stock: "0",
  active: true,
});

/** "2800" naira typed by the admin -> kobo, or null while it is unusable. */
function costToKobo(input: string): number | null {
  const kobo = parseNairaToKobo(input);
  return kobo !== null && kobo > 0 ? kobo : null;
}

export function ProductForm({
  product,
  categories,
  shops,
}: {
  product?: ProductInput;
  categories: string[];
  shops: ShopOption[];
}) {
  const [state, formAction, pending] = useActionState<ProductState, FormData>(saveProduct, {
    errors: {},
  });
  const [imageKey, setImageKey] = useState(product?.imageKey ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [markupPercent, setMarkupPercent] = useState(
    String((product?.markupBps ?? product?.suggestedMarkupBps ?? 1000) / 100)
  );
  const [units, setUnits] = useState(
    product && product.units.length > 0
      ? product.units.map((u) => ({
          id: u.id,
          unitLabel: u.unitLabel,
          cost: String(u.costKobo / 100),
          stock: String(u.stockQty),
          active: u.active,
        }))
      : [blankUnit()]
  );

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setUploadError(data.error ?? "Upload failed. Try again.");
      } else {
        setImageKey(data.path);
        setImgFailed(false);
      }
    } catch {
      setUploadError("Upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  const e = state.errors;
  const markupBps = parseMarkupPercent(markupPercent);

  return (
    <form action={formAction} className="space-y-4">
      {e.form && <Notice tone="bad">{e.form}</Notice>}
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="imageKey" value={imageKey} />

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-5">
          <div>
            <span className="block text-sm font-medium text-cocoa mb-1.5">Photo</span>
            <div className="size-32 rounded-md bg-wheat overflow-hidden flex items-center justify-center">
              {imageKey && !imgFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageKey}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <Utensils className="size-8 text-ash/60" aria-hidden />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" aria-hidden />
              {imageKey ? "Replace" : "Upload"}
            </Button>
            {uploadError && <p className="text-[13px] text-bad mt-1.5 max-w-32">{uploadError}</p>}
          </div>

          <div className="flex-1 min-w-60 space-y-4">
            <Field label="Product name" error={e.name}>
              <Input name="name" defaultValue={product?.name} placeholder="Parboiled Rice" />
            </Field>
            <Field label="Category" error={e.category} hint="Pick an existing one or type a new one.">
              <input
                name="category"
                defaultValue={product?.category}
                list="fl-categories"
                placeholder="Grains & Rice"
                className={inputCls}
              />
              <datalist id="fl-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>

        <Field
          label="Partner shop"
          error={e.retailerId}
          hint="The shop that stocks this and collects the cost portion at settlement. Foodline catalog means no shop owns it yet."
        >
          <Select name="retailerId" defaultValue={product?.retailerId ?? ""}>
            <option value="">Foodline catalog</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.businessName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Description" error={e.description}>
          <Textarea
            name="description"
            defaultValue={product?.description}
            placeholder="Stone-free long grain rice that cooks fluffy and separate."
          />
        </Field>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso">Pricing</h2>
        <p className="text-[13px] text-ash mt-1 mb-3">
          Set what the shop receives, then the markup Foodline keeps. The customer only ever sees
          the total of the two.
        </p>

        <div className="rounded-md bg-wheat/60 px-4 py-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-cocoa mb-1.5">Foodline markup</span>
              <div className="relative w-32">
                <input
                  name="markupPercent"
                  value={markupPercent}
                  onChange={(ev) => setMarkupPercent(ev.target.value)}
                  inputMode="decimal"
                  aria-invalid={markupBps === null}
                  className={cn(inputCls, "pr-9 tnum", markupBps === null && "border-bad")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ash text-sm">
                  %
                </span>
              </div>
            </label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {MARKUP_PRESETS_BPS.map((bps) => {
                const on = markupBps === bps;
                return (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => setMarkupPercent(String(bps / 100))}
                    aria-pressed={on}
                    className={cn(
                      "h-11 min-w-11 px-3 rounded-full text-sm font-medium tnum transition-colors",
                      on
                        ? "bg-terra text-white"
                        : "bg-white border border-crust text-cocoa hover:bg-cream"
                    )}
                  >
                    {formatBps(bps)}
                  </button>
                );
              })}
            </div>
          </div>
          {product && product.markupBps == null && (
            <p className="text-[13px] text-ash mt-2">
              The shop suggested {formatBps(product.suggestedMarkupBps)}.
            </p>
          )}
          {(e.markup || markupBps === null) && (
            <p className="text-[13px] text-bad mt-2">
              {e.markup ?? "Enter a markup between 0% and 200%, for example 10."}
            </p>
          )}
        </div>

        <h3 className="text-sm font-medium text-cocoa mt-5">Sellable units</h3>
        <p className="text-[13px] text-ash mt-0.5 mb-3">
          How shoppers buy this in the market: a mudu, a paint bucket, a 50kg bag.
        </p>
        {e.units && <p className="text-[13px] text-bad mb-2">{e.units}</p>}

        <div className="space-y-3">
          {units.map((unit, i) => {
            const costKobo = costToKobo(unit.cost);
            const priceKobo =
              costKobo === null || markupBps === null ? null : priceFor(costKobo, markupBps);
            return (
              <div key={i} className="rounded-md border border-crust/70 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="unitActive" value={unit.active ? "1" : "0"} />
                  <label className="flex-1 min-w-32">
                    <span className="block text-[13px] text-cocoa mb-1">Unit</span>
                    <input
                      name="unitLabel"
                      value={unit.unitLabel}
                      onChange={(ev) =>
                        setUnits((u) =>
                          u.map((r, idx) => (idx === i ? { ...r, unitLabel: ev.target.value } : r))
                        )
                      }
                      placeholder="1 mudu"
                      className={inputCls}
                    />
                  </label>
                  <label className="w-36">
                    <span className="block text-[13px] text-cocoa mb-1">Shop receives</span>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ash text-sm">
                        ₦
                      </span>
                      <input
                        name="unitCost"
                        value={unit.cost}
                        onChange={(ev) =>
                          setUnits((u) =>
                            u.map((r, idx) => (idx === i ? { ...r, cost: ev.target.value } : r))
                          )
                        }
                        inputMode="decimal"
                        placeholder="2800"
                        className={cn(inputCls, "pl-7 tnum")}
                      />
                    </div>
                  </label>
                  <label className="w-24">
                    <span className="block text-[13px] text-cocoa mb-1">Stock</span>
                    <input
                      name="unitStock"
                      value={unit.stock}
                      onChange={(ev) =>
                        setUnits((u) =>
                          u.map((r, idx) => (idx === i ? { ...r, stock: ev.target.value } : r))
                        )
                      }
                      inputMode="numeric"
                      className={cn(inputCls, "tnum")}
                    />
                  </label>
                  <label className="flex items-center gap-1.5 h-12 px-1">
                    <input
                      type="checkbox"
                      checked={unit.active}
                      onChange={(ev) =>
                        setUnits((u) =>
                          u.map((r, idx) => (idx === i ? { ...r, active: ev.target.checked } : r))
                        )
                      }
                      className="size-4.5 accent-[var(--color-terra)]"
                    />
                    <span className="text-[13px] text-cocoa">On sale</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setUnits((u) => u.filter((_, idx) => idx !== i))}
                    disabled={units.length === 1}
                    aria-label={`Remove unit ${i + 1}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-md text-ash hover:text-bad hover:bg-bad-tint disabled:opacity-40"
                  >
                    <Trash2 className="size-4.5" />
                  </button>
                </div>

                <p className="text-[13px] mt-2" aria-live="polite">
                  {priceKobo === null || costKobo === null ? (
                    <span className="text-ash">
                      Enter what the shop receives to see what the customer pays.
                    </span>
                  ) : (
                    <span className="text-cocoa">
                      Customer pays{" "}
                      <span className="tnum font-medium text-terra-deep">
                        {formatNaira(priceKobo)}
                      </span>
                      , Foodline keeps{" "}
                      <span className="tnum font-medium text-good">
                        {formatNaira(priceKobo - costKobo)}
                      </span>
                      .
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setUnits((u) => [...u, blankUnit()])}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-terra-deep hover:underline h-11"
        >
          <Plus className="size-4" /> Add a unit
        </button>
      </Card>

      <div className="flex flex-wrap gap-2 items-center">
        <Button type="submit" size="lg" loading={pending}>
          {product ? "Save changes" : "Create product"}
        </Button>
        <Button href="/admin/products" variant="secondary" size="lg">
          Cancel
        </Button>
        {product && <ArchiveButton productId={product.id} />}
      </div>
      {!product && (
        <p className="text-[13px] text-ash">
          Products you add here go on the shelf immediately at the markup above. Listings sent in by
          a shop wait in Approvals instead.
        </p>
      )}
      {product && product.status === "pending" && (
        <Notice tone="warn">
          This listing is still waiting on a decision. Saving here updates the details and prices
          but keeps it off the shelf. Publish it from{" "}
          <Link href="/admin/approvals?tab=listings">Approvals</Link>.
        </Notice>
      )}
    </form>
  );
}

function ArchiveButton({ productId }: { productId: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ml-auto text-sm text-ash hover:text-bad h-11 px-2"
      >
        Archive product
      </button>
    );
  }
  return (
    <span className="ml-auto flex items-center gap-2">
      <span className="text-[13px] text-cocoa">Hide it from shoppers?</span>
      <Button
        variant="danger"
        size="sm"
        onClick={() => archiveProduct(productId)}
      >
        Yes, archive
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-sm text-ash hover:text-cocoa h-11 px-2"
      >
        Keep
      </button>
    </span>
  );
}
