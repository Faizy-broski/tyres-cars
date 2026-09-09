"use client";

import { useRef, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { fadeUp, stagger, viewport } from "./motion-variants";
import { reviews } from "./data";

export default function TestimonialsSection() {
  const reviewsRef = useRef<HTMLDivElement>(null);
  const scrollReviewsPrev = useCallback(() => {
    reviewsRef.current?.scrollBy({ left: -320, behavior: "smooth" });
  }, []);
  const scrollReviewsNext = useCallback(() => {
    reviewsRef.current?.scrollBy({ left: 320, behavior: "smooth" });
  }, []);

  return (
    <section className="relative overflow-hidden py-24">
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-contain"
        style={{ backgroundImage: "url('/tyrebg.svg')" }}
      />
      <div className="relative z-10 mx-auto max-w-[1450px] px-4 sm:px-6 lg:px-0">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10 lg:overflow-hidden lg:pl-0">
          {/* Left panel */}
          <motion.div
            className="flex flex-col justify-center rounded-3xl bg-primary px-8 py-10 sm:px-12 sm:py-12 lg:min-h-[290px] lg:w-[420px] lg:shrink-0 lg:rounded-r-full lg:px-16 lg:py-14"
            initial={{ opacity: 0, x: -48 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={viewport}
            transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h2 className="font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Trusted By Drivers
            </h2>
            <div className="mt-6 flex items-end gap-3">
              <span className="font-oswald text-7xl font-black leading-none text-white lg:text-8xl">4.7</span>
              <div className="mb-3 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-white text-white" />
                ))}
              </div>
            </div>
            <p className="mt-2 text-sm text-white/80">Thousands of drivers rely on us for professional tyre fitting and car valeting</p>
          </motion.div>

          {/* Reviews */}
          <div className="flex-1 overflow-hidden py-4 lg:py-6">
            <motion.div
              ref={reviewsRef}
              className="flex gap-5 overflow-x-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={stagger}
            >
              {reviews.map((review, index) => (
                <motion.div key={index} variants={fadeUp}>
                  <motion.div
                    className="relative min-h-[200px] min-w-[80vw] rounded-[28px] bg-[#f9f6ef] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.03)] sm:min-w-[280px] sm:p-8"
                    whileHover={{ y: -4, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", transition: { duration: 0.2 } }}
                  >
                    <div className="absolute bottom-[-14px] left-10 h-7 w-7 rotate-45 bg-[#f9f6ef]" />
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-black">5</span>
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                        ))}
                      </div>
                    </div>
                    <div className="my-4 h-px bg-black/5" />
                    <p className="text-base leading-relaxed text-black/65 sm:text-lg">{review.review}</p>
                  </motion.div>
                  <div className="mt-10 flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {review.initial}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-black sm:text-lg">{review.name}</span>
                      <span className="text-xs uppercase text-black/25">Verified Buyer</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-8 flex items-center justify-between">
              <Button className="h-12 rounded-full bg-primary px-8 text-sm font-bold text-white hover:opacity-100 sm:h-14 sm:px-10 sm:text-base">
                View All Reviews
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  onClick={scrollReviewsPrev}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e6dcc2] bg-[#f8f4e8] text-primary transition hover:scale-105 sm:h-12 sm:w-12"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  onClick={scrollReviewsNext}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white transition hover:scale-105 sm:h-12 sm:w-12"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

