"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ImagePlus, Plus, Trash2, Utensils } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  Textarea,
  cn,
  inputCls,
} from "@/components/ui";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { archiveListing, saveListing } from "./actions";
import {
  DEFAULT_MARKUP_PERCENT,
  koboToInput,
  previewShelfPrice,
  type ListingInput,
  type ListingState,
} from "./shared";

type Row = {
  id: string;
  unitLabel: string;
  cost: string;
  stock: string;
  active: boolean;
};

const blankRow = (): Row => ({
  id: "new",
  unitLabel: "",
  cost: "",
  stock: "0",
  active: true,
});

export function ListingForm({
  listing,
  categories,
}: {
  listing?: ListingInput;
  categories: string[];
}) {
  const [state, formAction, pending] = useActionState<ListingState, FormData>(saveListing, {
    errors: {},
  });

  const [imageKey, setImageKey] = useState(listing?.imageKey ?? "");
  const [imgFailed, setImgFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [markup, setMarkup] = useState(
    listing ? String(listing.suggestedMarkupBps / 100) : String(DEFAULT_MARKUP_PERCENT)
  );
  const [rows, setRows] = useState<Row[]>(
    listing && listing.units.length > 0
      ? listing.units.map((unit) => ({
          id: unit.id,
          unitLabel: unit.unitLabel,
          cost: koboToInput(unit.costKobo),
          stock: String(unit.stockQty),
          active: unit.active,
        }))
      : [blankRow()]
  );

  const markupPercent = Number(markup);
  const markupBps =
    Number.isFinite(markupPercent) && markupPercent >= 0 && markupPercent <= 100
      ? Math.round(markupPercent * 100)
      : null;

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/retailer/upload", { method: "POST", body });
      const data = (await res.json()) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setUploadError(data.error ?? "The photo did not upload. Try again.");
      } else {
        setImageKey(data.path);
        setImgFailed(false);
      }
    } catch {
      setUploadError("The photo did not upload. Check your connection, then try again.");
    } finally {
      setUploading(false);
    }
  }

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const e = state.errors;

  return (
    <form action={formAction} className="space-y-4">
      {e.form && <Notice tone="bad">{e.form}</Notice>}

      {listing?.status === "rejected" && (
        <Notice tone="bad" title="The Foodline team asked for a change">
          {listing.rejectionReason ??
            "No reason was recorded. Contact the Foodline partner team and they will explain."}
        </Notice>
      )}

      {listing?.status === "approved" && (
        <Notice tone="warn" title="This listing is live">
          Saving any change here sends it back to the Foodline team for review, so it leaves the
          shop until they approve it again. To change stock only, use the plus and minus buttons on
          the products list instead.
        </Notice>
      )}

      {listing && <input type="hidden" name="id" value={listing.id} />}
      <input type="hidden" name="imageKey" value={imageKey} />

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-5">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-cocoa">Photo</span>
            <div className="flex size-32 items-center justify-center overflow-hidden rounded-md bg-wheat">
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
              aria-label="Product photo"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
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
              {imageKey ? "Replace photo" : "Add a photo"}
            </Button>
            {uploadError ? (
              <p className="mt-1.5 max-w-32 text-[13px] text-bad">{uploadError}</p>
            ) : (
              <p className="mt-1.5 max-w-32 text-[13px] text-ash">JPEG, PNG or WebP, up to 5MB.</p>
            )}
          </div>

          <div className="min-w-60 flex-1 space-y-4">
            <Field label="Product name" error={e.name}>
              <Input name="name" defaultValue={listing?.name} placeholder="Parboiled rice" />
            </Field>
            <Field
              label="Category"
              error={e.category}
              hint="Pick one already used on Foodline, or type your own."
            >
              <input
                name="category"
                defaultValue={listing?.category}
                list="fl-retailer-categories"
                placeholder="Grains and rice"
                className={inputCls}
              />
              <datalist id="fl-retailer-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>

        <Field
          label="Description"
          error={e.description}
          hint="What a shopper needs to know: the brand, the grade, how clean it is."
        >
          <Textarea
            name="description"
            defaultValue={listing?.description}
            placeholder="Stone-free long grain rice that cooks fluffy and separate."
          />
        </Field>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso">Units and what you receive</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ash">
          List each way you sell this: a mudu, a paint bucket, a 50kg bag. Enter the amount you need
          to receive per unit. That is exactly what Foodline settles to your account on every sale.
        </p>

        <div className="mt-4 rounded-md bg-wheat/60 p-4">
          <label className="block">
            <span className="block text-sm font-medium text-cocoa">Suggested markup</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-ash">
              Foodline adds a markup on top of what you receive, and that is how Foodline earns.
              Suggest one here. The Foodline team reviews every listing and sets the final shelf
              price, which can differ from your suggestion.
            </span>
            <span className="relative mt-2 block w-32">
              <input
                name="suggestedMarkup"
                value={markup}
                onChange={(event) => setMarkup(event.target.value)}
                inputMode="decimal"
                className={cn(inputCls, "tnum pr-9")}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ash">%</span>
            </span>
          </label>
          {e.suggestedMarkup && <p className="mt-1.5 text-[13px] text-bad">{e.suggestedMarkup}</p>}
        </div>

        {e.units && <p className="mt-3 text-[13px] text-bad">{e.units}</p>}

        <div className="mt-4 space-y-4">
          {rows.map((row, index) => {
            const costKobo = parseNairaToKobo(row.cost);
            const preview =
              costKobo !== null && costKobo > 0 && markupBps !== null
                ? previewShelfPrice(costKobo, markupBps)
                : null;
            return (
              <div key={index} className="rounded-md border border-crust/70 p-3">
                <input type="hidden" name="unitId" value={row.id} />
                <input type="hidden" name="unitActive" value={row.active ? "1" : "0"} />

                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-32 flex-1">
                    <span className="mb-1 block text-[13px] text-cocoa">Unit</span>
                    <input
                      name="unitLabel"
                      value={row.unitLabel}
                      onChange={(event) => update(index, { unitLabel: event.target.value })}
                      placeholder="1 mudu"
                      className={inputCls}
                    />
                  </label>
                  <label className="w-36">
                    <span className="mb-1 block text-[13px] text-cocoa">What you receive</span>
                    <span className="relative block">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ash">
                        ₦
                      </span>
                      <input
                        name="unitCost"
                        value={row.cost}
                        onChange={(event) => update(index, { cost: event.target.value })}
                        inputMode="decimal"
                        placeholder="2800"
                        className={cn(inputCls, "tnum pl-7")}
                      />
                    </span>
                  </label>
                  <label className="w-24">
                    <span className="mb-1 block text-[13px] text-cocoa">Stock</span>
                    <input
                      name="unitStock"
                      value={row.stock}
                      onChange={(event) => update(index, { stock: event.target.value })}
                      inputMode="numeric"
                      className={cn(inputCls, "tnum")}
                    />
                  </label>
                  <label className="flex h-12 items-center gap-1.5 px-1">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(event) => update(index, { active: event.target.checked })}
                      className="size-4.5 accent-[var(--color-terra)]"
                    />
                    <span className="text-[13px] text-cocoa">On sale</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    disabled={rows.length === 1}
                    aria-label={`Remove unit ${index + 1}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-md text-ash transition-colors hover:bg-bad-tint hover:text-bad disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ash"
                  >
                    <Trash2 className="size-4.5" aria-hidden />
                  </button>
                </div>

                <p className="mt-2 text-[13px] text-ash">
                  {preview === null ? (
                    "Enter what you receive to see the shelf price this would suggest."
                  ) : (
                    <>
                      Suggested shelf price:{" "}
                      <span className="tnum font-medium text-cocoa">{formatNaira(preview)}</span>.
                      Foodline reviews this and sets the final price.
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((current) => [...current, blankRow()])}
          className="mt-3 inline-flex h-11 items-center gap-1.5 text-sm font-medium text-terra-deep hover:underline"
        >
          <Plus className="size-4" aria-hidden /> Add another unit
        </button>
      </Card>

      <div className="flex flex-wrap items-center gap-2 pb-[calc(env(safe-area-inset-bottom))]">
        <Button type="submit" size="lg" loading={pending}>
          {listing ? "Save and send for review" : "Send for review"}
        </Button>
        <Button href="/retailer/products" variant="secondary" size="lg">
          Cancel
        </Button>
        {listing && listing.status !== "archived" && <ArchiveButton productId={listing.id} />}
      </div>
    </form>
  );
}

function ArchiveButton({ productId }: { productId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ml-auto h-11 px-2 text-sm text-ash transition-colors hover:text-bad"
      >
        Archive listing
      </button>
    );
  }
  return (
    <span className="ml-auto flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-cocoa">Take it off your shelf?</span>
      <Button
        variant="danger"
        size="sm"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            await archiveListing(productId);
          })
        }
      >
        Yes, archive
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-11 px-2 text-sm text-ash transition-colors hover:text-cocoa"
      >
        Keep it
      </button>
    </span>
  );
}
