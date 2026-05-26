import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import HeroSection from "@/components/home/HeroSection";
import StatsSection from "@/components/home/StatsSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import QuickUploadSection from "@/components/home/QuickUploadSection";
import ModulesSection from "@/components/home/ModulesSection";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <QuickUploadSection />
        <ModulesSection />
      </main>
      <AppFooter />
    </div>
  );
}
