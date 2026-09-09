"use client";
import { Disc3, Truck, CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { scaleIn, slideLeft, stagger, viewport } from "./motion-variants";

const cards = [
  { num: "01", icon: <Disc3 className="h-7 w-7" />, title: ["Massive Tyre", "Selection"], desc: "Browse premium tyres for every vehicle, size, and driving style from trusted global brands.", accent: false },
  { num: "02", icon: <Truck className="h-7 w-7" />, title: ["Fast &", "Reliable Delivery"], desc: "Get your tyres delivered quickly with secure nationwide shipping and real-time tracking.", accent: false },
  { num: "03", icon: <CarFront className="h-7 w-7" />, title: ["Perfect Vehicle", "Matching"], desc: "Use our smart search to find the right tyres for your exact vehicle in seconds.", accent: true },
];

export default function ServicesSection() {
  return (
    <section className="overflow-hidden bg-cover bg-center bg-no-repeat py-16 md:py-24" style={{ backgroundImage: "url('/services.svg')" }}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-10">
        <motion.div className="w-full shrink-0 lg:max-w-[300px]" initial="hidden" whileInView="visible" viewport={viewport} variants={slideLeft}>
          <h2 className="font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
            Services That Keep You Moving
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/75">Three important things to know about Tyres & Car Valeting.</p>
          <Button className="mt-6 h-12 rounded-full bg-primary px-8 font-oswald text-lg font-bold italic text-white transition-all duration-200 hover:bg-[#c89907] active:scale-[0.97]">
            Get Expert Help
          </Button>
          <div className="mt-10">
            <svg width="160" height="36" viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <path d="M0 20C20 20 20 0 40 0C60 0 60 20 80 20C100 20 100 0 120 0C140 0 140 20 160 20C170 20 175 15 180 10" stroke="currentColor" strokeWidth="6" />
              <path d="M0 20C20 20 20 40 40 40C60 40 60 20 80 20C100 20 100 40 120 40C140 40 140 20 160 20C170 20 175 25 180 30" stroke="currentColor" strokeWidth="6" />
            </svg>
          </div>
        </motion.div>

        <motion.div className="grid flex-1 gap-5 sm:grid-cols-3" initial="hidden" whileInView="visible" viewport={viewport} variants={stagger}>
          {cards.map((card) => (
            <motion.div key={card.num} variants={scaleIn} className="h-full" whileHover={{ y: -6, transition: { duration: 0.2 } }}>
              <Card className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:border-primary hover:bg-primary">
                <span className={`absolute right-4 top-1 font-black leading-none text-8xl ${card.accent ? "text-white/20" : "text-white/[0.07]"}`}>
                  {card.num}
                </span>
                <div className="relative z-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
                    {card.icon}
                  </div>
                  <h3 className="mt-6 font-oswald text-3xl font-black uppercase leading-tight text-white">
                    {card.title[0]}<br />{card.title[1]}
                  </h3>
                  <div className={`my-5 h-px w-full ${card.accent ? "bg-white/25" : "bg-white/10"}`} />
                  <p className={`text-base leading-relaxed ${card.accent ? "text-white/90" : "text-white/70"}`}>{card.desc}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

