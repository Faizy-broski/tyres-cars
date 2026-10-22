"use client";
import Image from "next/image";
import Link from "next/link";
import { Dot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { fadeUp, slideLeft, stagger, viewport } from "./motion-variants";

const bullets = [
  "Premium Global Tyre Brands",
  "Competitive Market Prices",
  "Expert Vehicle Matching",
  "Secure Online Shopping",
  "Professional Car Valeting",
  "Trusted By Thousands",
];

export default function HelpSection() {
  return (
    <section className="overflow-hidden py-16 md:py-24">
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-10 xl:gap-20">
        <motion.div className="relative flex items-center" initial="hidden" whileInView="visible" viewport={viewport} variants={slideLeft}>
          <div className="absolute left-[-180px] hidden h-[480px] w-[440px] rounded-r-[200px] bg-primary lg:block" />
          <div className="relative z-10 w-full overflow-hidden rounded-3xl shadow-xl">
            <Image src="/help.svg" alt="Tyre Fitting Help" width={540} height={420} className="h-[300px] w-full object-cover sm:h-[380px] lg:h-[420px]" />
          </div>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewport} variants={stagger}>
          <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-900">Expert Advice</motion.p>
          <h2 className="mt-2 font-oswald text-3xl font-black leading-tight tracking-tight text-black sm:text-4xl">Need Help Finding Tyres?</h2>
          <p className="mt-4 text-base leading-relaxed text-black/75 sm:text-lg">
            Choosing the right tyres makes a huge difference in safety, comfort, and performance. Our team helps you find the perfect match based on your vehicle, driving habits, and budget.
          </p>
          <p className="mt-3 text-base leading-relaxed text-black/75 sm:text-lg">
            Whether you need performance tyres, everyday options, SUV tyres, or all-season solutions — we make the process simple and stress-free.
          </p>
          <div className="mt-7 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {bullets.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-medium text-zinc-800 sm:text-base">
                <Dot className="h-4 w-4 shrink-0 text-amber-700" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button
            asChild
            aria-label="Get expert help finding tyres"
            className="mt-8 h-12 rounded-full bg-primary px-6 font-oswald text-base font-bold italic text-zinc-950 transition-all duration-200 hover:bg-[#c89907] active:scale-[0.97] sm:px-8 sm:text-xl"
          >
            <Link href="/book">Get Expert Help</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
