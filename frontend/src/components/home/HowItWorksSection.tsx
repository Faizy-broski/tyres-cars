"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, stagger, viewport } from "./motion-variants";
import { steps } from "./data";

export default function HowItWorksSection() {
  const [active, setActive] = useState(-1);

  return (
    <section className="py-20 overflow-hidden">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <motion.div className="mb-14" initial="hidden" whileInView="visible" viewport={viewport} variants={stagger}>
          <motion.h2 variants={fadeUp} className="font-oswald text-3xl font-black tracking-tight text-black sm:text-4xl">
            How It Works
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-3 text-base leading-relaxed text-black/65 sm:text-lg">
            Buying tires online has never been easier.
          </motion.p>
        </motion.div>

        {/* Mobile */}
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5 lg:hidden">
          {steps.map((step) => (
            <div key={step.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="relative h-36 sm:h-44">
                <Image src={step.image} alt={step.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                <div className="absolute inset-0 bg-black/45" />
                <div className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-xl font-black text-white shadow-lg">
                  {step.id}
                </div>
              </div>
              <div className="p-5">
                <h3 className="font-oswald text-xl font-black text-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/65">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop */}
        <div
          className="hidden lg:flex gap-5 min-h-[540px] items-start"
          onMouseLeave={() => setActive(-1)}
        >
          {steps.map((step, index) => {
            const isActive = active === index;
            return (
              <div
                key={step.id}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "relative flex flex-col transition-all duration-500 ease-out cursor-pointer",
                  isActive ? "" : "overflow-hidden h-[540px]",
                  active === -1
                    ? "w-[calc(33.333%-14px)]"
                    : isActive
                      ? "w-full"
                      : "w-[170px]",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isActive ? (
                    <motion.div
                      key={`active-${step.id}`}
                      className="flex w-full flex-col"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.28 }}
                    >
                      <div
                        className="relative h-[420px]"
                        style={{
                          WebkitMaskImage: "url('/frame.svg')",
                          WebkitMaskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          WebkitMaskSize: "100% 100%",
                          maskImage: "url('/frame.svg')",
                          maskRepeat: "no-repeat",
                          maskPosition: "center",
                          maskSize: "100% 100%",
                        }}
                      >
                        <Image
                          src={step.image}
                          alt={step.title}
                          fill
                          sizes="100vw"
                          className="object-cover transition-transform duration-700 hover:scale-105"
                        />
                      </div>
                      <motion.div
                        className="absolute z-20 left-36 bottom-0 flex items-start gap-4 pl-3"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.18 }}
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-black text-white shadow-xl">
                          {step.id}
                        </div>
                        <div>
                          <h3 className="font-oswald text-lg text-black sm:text-3xl">{step.title}</h3>
                          <p className="mt-1 max-w-xs text-sm leading-relaxed text-black/65">{step.desc}</p>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`inactive-${step.id}`}
                      className="relative h-full overflow-hidden rounded-[999px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.28 }}
                    >
                      <Image src={step.image} alt={step.title} fill sizes="170px" className="object-cover" />
                      <div className="absolute inset-0 bg-black/55" />
                      <div className="absolute inset-x-0 top-0 bottom-40 flex items-center justify-center">
                        <h3 className="rotate-[-90deg] whitespace-nowrap font-oswald text-[28px] font-black uppercase tracking-wide text-white">
                          {step.short}
                        </h3>
                      </div>
                      <div className="absolute bottom-14 left-1/2 z-20 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-5xl font-black text-white shadow-2xl">
                        {step.id}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

