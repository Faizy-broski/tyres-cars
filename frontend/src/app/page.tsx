"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import TopBar from "@/components/home/TopBar";
import Navbar from "@/components/home/Navbar";
import HeroSection from "@/components/home/HeroSection";
import DealsSection from "@/components/home/DealsSection";
import ServicesSection from "@/components/home/ServicesSection";
import HelpSection from "@/components/home/HelpSection";
import VehicleTypesSection from "@/components/home/VehicleTypesSection";
import TrustedBrandsSection from "@/components/home/TrustedBrandsSection";
import BestSellingSection from "@/components/home/BestSellingSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import ContactSection from "@/components/home/ContactSection";
import FaqSection from "@/components/home/FaqSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FooterSection from "@/components/home/FooterSection";
import CartDrawer from "@/components/storefront/CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import { staticFooterSections } from "@/components/home/data";

export default function HomePage() {
  const [topbarScrolled, setTopbarScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setTopbarScrolled(window.scrollY >= 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="text-zinc-900">
      <TopBar />
      <Navbar topbarScrolled={topbarScrolled} />
      <HeroSection />

      {/* Deals + Services + Help — shared white bg with tyre decoration */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 z-0 h-full w-[420px] opacity-[0.06]">
          <Image src="/tyre.svg" alt="" fill priority className="object-contain object-right" />
        </div>
        <div className="relative z-10">
          <DealsSection />
          <ServicesSection />
          <HelpSection />
        </div>
      </div>

      {/* Vehicle Types + Trusted Brands + Best Selling — shared leftvector bg */}
      <div className="bg-[url('/leftvector.svg')] bg-[position:left_center] bg-no-repeat">
        <VehicleTypesSection />
        <TrustedBrandsSection />
        <BestSellingSection />
      </div>

      {/* How It Works + Contact + FAQ — shared rightvector bg */}
      <div className="bg-[url('/rightvector.svg')] bg-[position:right_center] bg-no-repeat">
        <HowItWorksSection />
        <ContactSection />
        <FaqSection />
      </div>

      <TestimonialsSection />
      <FooterSection topSections={staticFooterSections} />
      <CartDrawer />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: { width: '420px', maxWidth: 'calc(100vw - 2rem)' },
          classNames: {
            toast:       'font-semibold text-base shadow-2xl rounded-2xl border px-5 py-4 gap-3',
            title:       'text-base',
            description: 'text-sm opacity-80 mt-1',
            success:     'border-green-200 bg-green-50 text-green-900',
            error:       'border-red-200 bg-red-50 text-red-900',
          },
        }}
      />
    </main>
  );
}

