import AppHeader from "@/components/layout/AppHeader";
import AppFooter from "@/components/layout/AppFooter";
import HeroSection from "@/components/home/HeroSection";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 flex flex-col">
        <HeroSection />
      </main>
      <AppFooter />
    </div>
  );
}
