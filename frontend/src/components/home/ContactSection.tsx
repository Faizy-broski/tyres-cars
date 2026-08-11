"use client";
import Image from "next/image";
import { motion } from "framer-motion";
import { fadeUp, stagger, viewport } from "./motion-variants";
import { contactItems } from "./data";

export default function ContactSection() {
  return (
    <section className="w-full overflow-hidden py-20">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:pl-10 lg:pr-0">
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 lg:grid-cols-[260px_340px_1fr] lg:gap-10">
          <motion.div className="flex flex-row flex-wrap gap-8 lg:flex-col lg:gap-12" initial="hidden" whileInView="visible" viewport={viewport} variants={stagger}>
            {contactItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div key={index} variants={fadeUp} className="flex items-center gap-5">
                  <motion.div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-zinc-950 shadow-sm"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  >
                    <Icon className="h-7 w-7 stroke-[2.2]" />
                  </motion.div>
                  <div>
                    <h3 className="text-base font-bold leading-none text-zinc-950 sm:text-lg">{item.title}</h3>
                    <p className="mt-1.5 text-sm font-medium text-zinc-700 sm:text-base">{item.value}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <div className="relative mx-auto h-[300px] w-full overflow-hidden rounded-[32px] sm:h-[340px] sm:max-w-[340px] md:col-span-1 lg:col-span-1">
            <Image src="/contact.svg" alt="Tyre Consultation" fill className="object-cover" />
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 flex flex-col justify-between p-8 sm:p-10">
              <h2 className="max-w-[180px] font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
                Want To Schedule A Call
              </h2>
              <button
                type="button"
                aria-label="Schedule a call for expert tyre help"
                className="h-14 rounded-full bg-primary text-lg font-bold italic text-zinc-950 transition-all duration-300 hover:scale-[1.02] hover:bg-[#c89907]"
              >
                Get Expert Help
              </button>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] bg-primary px-8 py-10 sm:px-10 sm:py-12 md:col-span-2 lg:col-span-1 lg:rounded-l-full lg:px-14 lg:py-20">
            <div className="relative z-10">
              <h2 className="font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
                Have Questions?<br />We&apos;re Here.
              </h2>
              <div className="mt-8 space-y-2 text-base font-bold text-zinc-900 sm:text-lg">
                <p>Mon - Fri: 8 AM - 6 PM (ET)</p>
                <p>Sat: 9 AM - 5 PM (ET)</p>
                <p>Sun: Closed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
