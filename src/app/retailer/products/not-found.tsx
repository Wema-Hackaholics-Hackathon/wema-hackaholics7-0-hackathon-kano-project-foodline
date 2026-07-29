import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui";

export default function ListingNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm text-center animate-rise">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-wheat text-cocoa">
          <PackageSearch className="size-6" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl text-espresso">We cannot find that listing</h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          It may have been archived, or it belongs to another partner shop. Your own listings are
          all on the products page.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Button href="/retailer/products" size="lg" className="w-full">
            Back to your products
          </Button>
          <Button href="/retailer/products/new" size="lg" variant="ghost" className="w-full">
            Add a product
          </Button>
        </div>
      </div>
    </div>
  );
}
