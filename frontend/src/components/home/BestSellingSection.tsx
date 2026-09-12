"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { fadeUp, stagger, viewport } from "./motion-variants";
import TyreCard, { type BestSellerSku } from "./TyreCard";
import { createClient } from "@/lib/supabase/client";

const ITEMS_PER_PAGE = 8;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function BestSellingSection() {
  const [pages,         setPages]         = useState<BestSellerSku[][]>([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps,   setScrollSnaps]   = useState<number[]>([]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", dragFree: false });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onInit   = useCallback(() => { if (emblaApi) setScrollSnaps(emblaApi.scrollSnapList()) }, [emblaApi]);
  const onSelect = useCallback(() => { if (emblaApi) setSelectedIndex(emblaApi.selectedScrollSnap()) }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onInit();
    onSelect();
    emblaApi.on("reInit", onInit);
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("reInit", onInit); emblaApi.off("select", onSelect); };
  }, [emblaApi, onInit, onSelect]);

  useEffect(() => {
    async function fetchBestSellers() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("skus")
        .select(`
          product_id,
          sku,
          product_slug,
          tyre_size_display,
          xl_reinforced,
          runflat,
          total_available_stock,
          variant_images,
          patterns!inner (
            pattern_name,
            main_image,
            gallery_images,
            is_active,
            show_on_website,
            brands!inner ( brand_name, is_active, show_on_website )
          ),
          product_prices ( price_type, price_inc_gst )
        `)
        .eq("status", "active")
        .eq("patterns.is_active", true)
        .eq("patterns.show_on_website", true)
        .eq("patterns.brands.is_active", true)
        .eq("patterns.brands.show_on_website", true)
        .not("product_slug", "is", null)
        .order("total_available_stock", { ascending: false })
        .limit(24);

      if (error || !data) { setLoading(false); return; }

      const items: BestSellerSku[] = (data as any[]).map((row) => {
        const pattern = row.patterns as any;
        const brand   = pattern?.brands as any;
        const retail  = (row.product_prices ?? []).find(
          (p: any) => p.price_type === "retail"
        )?.price_inc_gst ?? null;

        return {
          product_id:            row.product_id,
          sku:                   row.sku,
          product_slug:          row.product_slug,
          tyre_size_display:     row.tyre_size_display,
          brand_name:            brand?.brand_name  ?? "",
          pattern_name:          pattern?.pattern_name ?? "",
          main_image:            pattern?.main_image ?? row.variant_images?.[0] ?? pattern?.gallery_images?.[0] ?? null,
          price_inc_gst:         retail,
          total_available_stock: row.total_available_stock,
          xl_reinforced:         row.xl_reinforced,
          runflat:               row.runflat,
        };
      });

      setPages(chunk(items, ITEMS_PER_PAGE));
      setLoading(false);
    }

    fetchBestSellers();
  }, []);

  // Reinitialise Embla after pages load so snap list is correct
  useEffect(() => { emblaApi?.reInit(); }, [emblaApi, pages]);

  return (
    <section className="overflow-hidden py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex items-start justify-between">
          <motion.div initial="hidden" whileInView="visible" viewport={viewport} variants={stagger}>
            <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Trending</motion.p>
            <motion.h2 variants={fadeUp} className="mt-2 font-oswald text-3xl font-black leading-tight tracking-tight text-black sm:text-4xl">
              Best Selling Tyres
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-2 text-base leading-relaxed text-black/65 sm:text-lg">
              Our most popular selections across every road condition.
            </motion.p>
          </motion.div>
          <div className="mt-4 hidden shrink-0 items-center gap-3 lg:flex">
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous tyres"
              onClick={scrollPrev}
              className="h-11 w-11 rounded-full border-primary/30 bg-white text-primary shadow-none hover:bg-primary/5"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              aria-label="Next tyres"
              onClick={scrollNext}
              className="h-11 w-11 rounded-full border-0 bg-primary text-zinc-900 hover:bg-[#c89907]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex rounded-2xl border border-zinc-100 bg-white shadow-md overflow-hidden animate-pulse h-44">
                <div className="w-[42%] bg-zinc-100 shrink-0" />
                <div className="flex-1 p-3.5 flex flex-col gap-2">
                  <div className="h-2 bg-zinc-100 rounded-full w-20" />
                  <div className="h-3.5 bg-zinc-100 rounded-full w-full" />
                  <div className="h-3 bg-zinc-100 rounded-full w-2/3" />
                  <div className="mt-auto h-6 bg-zinc-100 rounded-full w-1/2" />
                  <div className="h-8 bg-zinc-100 rounded-lg w-full" />
                  <div className="h-7 bg-zinc-100 rounded-lg w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : pages.length === 0 ? (
          <p className="mt-12 text-center text-sm text-zinc-400">No products available yet.</p>
        ) : (
          <>
            <div className="mt-12 overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {pages.map((page, pageIndex) => (
                  <div key={pageIndex} className="min-w-0 flex-[0_0_100%]">
                    <motion.div
                      className="grid grid-cols-1 gap-5 sm:grid-cols-2"
                      initial="hidden"
                      whileInView="visible"
                      viewport={viewport}
                      variants={stagger}
                    >
                      {page.map((item) => (
                        <motion.div key={item.product_id} variants={fadeUp} whileHover={{ y: -5, transition: { duration: 0.18 } }}>
                          <TyreCard item={item} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                ))}
              </div>
            </div>

            {scrollSnaps.length > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {scrollSnaps.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to page ${index + 1}`}
                    onClick={() => emblaApi?.scrollTo(index)}
                    className={`h-1 rounded-full transition-all duration-300 ${selectedIndex === index ? "w-8 bg-primary" : "w-4 bg-black/25"}`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

