import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks, NumbersStrip, PartnerStrip, TrustSection } from "@/components/landing/sections";
import { LandingFooter } from "@/components/landing/footer";

// Fully static marketing page: no session, no database, prerendered at build.
export default function LandingPage() {
  return (
    <>
      {/* Smooth anchor scrolling for "See how it works", landing only */}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          html { scroll-behavior: smooth; }
        }
      `}</style>
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <NumbersStrip />
        <TrustSection />
        <PartnerStrip />
      </main>
      <LandingFooter />
    </>
  );
}
