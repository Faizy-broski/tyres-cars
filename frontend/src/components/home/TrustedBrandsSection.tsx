"use client";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const brands = ["Michelin", "Bridgestone", "Goodyear", "Pirelli", "Continental", "Dunlop"];

export default function TrustedBrandsSection() {
  return (
    <section className="border-y border-zinc-200 bg-white py-12 md:py-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-900">Trusted Brands</p>
          <button
            type="button"
            aria-label="Shop by brand"
            className="group flex items-center gap-2 text-sm font-semibold text-zinc-800 transition-colors hover:text-zinc-950"
          >
            Shop By Brands
            <ArrowRight className="h-4 w-4 text-amber-600 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
        <div className="mt-10 flex items-center overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:justify-between">
          {brands.map((brand, index, arr) => (
            <div key={brand} className="flex shrink-0 items-center">
              <motion.button
                type="button"
                aria-label={`View tyres by ${brand}`}
                className="px-4 font-oswald text-2xl font-black tracking-tight text-zinc-700 transition-colors duration-300 hover:text-zinc-950 md:text-3xl lg:text-[32px]"
                whileHover={{ scale: 1.08, opacity: 1 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
              >
                {brand}
              </motion.button>
              {index !== arr.length - 1 && <div className="h-8 w-px bg-zinc-200" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
