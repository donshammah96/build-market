import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/layout/NavBar";
import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";

// Lazy load below-the-fold sections for faster initial page load
// These components are deferred until they're needed, reducing initial JS bundle
const FeaturesSection = dynamic(
  () =>
    import("@/components/home/FeatureSection").then((mod) => ({
      default: mod.FeaturesSection,
    })),
  {
    loading: () => <SectionSkeleton height="400px" />,
    ssr: true,
  },
);

const HowItWorks = dynamic(
  () =>
    import("@/components/home/HowItWorks").then((mod) => ({
      default: mod.HowItWorks,
    })),
  {
    loading: () => <SectionSkeleton height="500px" />,
    ssr: true,
  },
);

const Professionals = dynamic(
  () =>
    import("@/components/professional/Professionals").then((mod) => ({
      default: mod.Professionals,
    })),
  {
    loading: () => <SectionSkeleton height="500px" />,
    ssr: true,
  },
);

const Property = dynamic(
  () =>
    import("@/components/real-estate/Property").then((mod) => ({
      default: mod.Property,
    })),
  {
    loading: () => <SectionSkeleton height="500px" />,
    ssr: true,
  },
);

const VendorsSection = dynamic(
  () =>
    import("@/components/vendors/VendorSection").then((mod) => ({
      default: mod.VendorsSection,
    })),
  {
    loading: () => <SectionSkeleton height="500px" />,
    ssr: true,
  },
);

const ReviewsSection = dynamic(
  () =>
    import("@/components/reviews").then((mod) => ({
      default: mod.ReviewsSection,
    })),
  {
    loading: () => <SectionSkeleton height="400px" />,
    ssr: true,
  },
);

const FAQSection = dynamic(
  () =>
    import("@/components/home/FAQSection").then((mod) => ({
      default: mod.FAQSection,
    })),
  {
    loading: () => <SectionSkeleton height="500px" />,
    ssr: true,
  },
);

const CTA = dynamic(
  () => import("@/components/home/CTA").then((mod) => ({ default: mod.CTA })),
  {
    loading: () => <SectionSkeleton height="300px" bg="bg-muted" />,
    ssr: true,
  },
);

// Lightweight skeleton component for loading states
function SectionSkeleton({
  height,
  bg = "bg-muted",
}: {
  height: string;
  bg?: string;
}) {
  return (
    <div
      className={`${bg} motion-safe:animate-pulse`}
      style={{ minHeight: height }}
      aria-hidden="true"
    />
  );
}

export default function Home() {
  return (
    <main className="overflow-hidden mx-auto max-w-screen-2xl bg-background">
      <Navbar />
      <Hero />

      {/*
       * Rendered eagerly (not behind Suspense/dynamic like the sections
       * below) since it's a small text/stat strip immediately under the
       * fold — deferring it would cause a visible layout pop-in right
       * where the user's eye lands after the Hero. See TrustBar.tsx for
       * the placeholder-data caveat before shipping this.
       */}
      <TrustBar />

      {/* Below-the-fold content wrapped in Suspense for progressive loading */}
      <Suspense fallback={<SectionSkeleton height="400px" />}>
        <FeaturesSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="500px" />}>
        <HowItWorks />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="500px" />}>
        <Professionals />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="500px" />}>
        <Property />
      </Suspense>

      <Suspense
        fallback={<SectionSkeleton height="500px" bg="bg-background" />}
      >
        <VendorsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="400px" />}>
        <ReviewsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="500px" />}>
        <FAQSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="300px" bg="bg-muted" />}>
        <CTA />
      </Suspense>

      {/* Footer now mounted globally in app/layout.tsx — see audit doc */}
    </main>
  );
}
