import { HeroSection } from "@/components/hero-section"
import { ProblemSection } from "@/components/problem-section"
import { ComparisonSection } from "@/components/comparison-section"
import { HowItWorksSection } from "@/components/how-it-works-section"
import { BenefitsSection } from "@/components/benefits-section"
import { AudienceSection } from "@/components/audience-section"
import { IncludedSection } from "@/components/included-section"
import { FaqSection } from "@/components/faq-section"
import { HorizonSection } from "@/components/horizon-section"
import { FinalCtaSection } from "@/components/final-cta-section"
import { Footer } from "@/components/footer"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"

const pageBlobs: GlassBlob[] = [
  { color: "#6b4c12", size: "60% 6%", position: "10% 2%" },
  { color: "#2a3444", shape: "circle", size: "7vw", position: "85% 9%" },
  { color: "#1f2836", size: "38% 5%", position: "20% 19%" },
  { color: "#4a1520", size: "55% 7%", position: "90% 27%" },
  { color: "#3d2a10", shape: "circle", size: "8vw", position: "6% 38%" },
  { color: "#6b4c12", size: "42% 5%", position: "78% 47%" },
  { color: "#2a3444", size: "50% 6%", position: "15% 55%" },
  { color: "#1f2836", shape: "circle", size: "6vw", position: "88% 64%" },
  { color: "#4a1520", size: "40% 5%", position: "25% 74%" },
  { color: "#3d2a10", size: "48% 6%", position: "82% 83%" },
  { color: "#6b4c12", shape: "circle", size: "7vw", position: "12% 92%" },
  { color: "#2a3444", size: "38% 5%", position: "70% 98%" },
]

export default function Home() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <LandingNavigation />
      <HeroSection />
      <ProblemSection />
      <ComparisonSection />
      <HowItWorksSection />
      <BenefitsSection />
      <AudienceSection />
      <IncludedSection />
      <FaqSection />
      <HorizonSection />
      <FinalCtaSection />
      <Footer />
    </main>
  )
}
