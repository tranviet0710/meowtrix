import { createClient } from "@/lib/supabaseServer";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
// import { StatsBanner } from "@/components/landing/StatsBanner";
import { MissionSection } from "@/components/landing/MissionSection";
import { MascotsGallery } from "@/components/landing/MascotsGallery";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default async function Home() {
  // The landing page is visible to everyone. Authenticated visitors just see
  // adapted CTAs ("Go to HQ" instead of Sign In / Register).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-text-primary">
      <LandingNav isAuthenticated={isAuthenticated} />
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        {/* <StatsBanner /> */}
        <MissionSection />
        <MascotsGallery />
        <FeaturesSection />
        <HowItWorksSection isAuthenticated={isAuthenticated} />
        <FaqSection />
        <CtaSection isAuthenticated={isAuthenticated} />
      </main>
      <LandingFooter />
    </div>
  );
}
