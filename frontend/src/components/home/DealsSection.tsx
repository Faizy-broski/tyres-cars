"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Autoplay from "embla-carousel-autoplay";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { fadeUp, stagger, viewport } from "./motion-variants";
import { createClient } from "@/lib/supabase/client";

interface ActiveDeal {
  promotion_id: string;
  title:        string;
  brand_name:   string | null;
  description:  string | null;
  image_url:    string | null;
  cta_url:      string | null;
  start_date:   string;
  end_date:     string;
  display_order: number;
}

function formatDateRange(start: string, end: string): string {
  const parse = (d: string) => new Date(d + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const endOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${parse(start).toLocaleDateString("en-US", opts)} – ${parse(end).toLocaleDateString("en-US", endOpts)}`;
}

function SkeletonCard() {
  return (
    <div className="min-w-[240px] flex-[0_0_240px] sm:min-w-[265px] sm:flex-[0_0_265px] md:min-w-[285px] md:flex-[0_0_285px]">
      <div className="h-[340px] animate-pulse rounded-3xl bg-zinc-200" />
    </div>
  );
}

function PhoneSkeletonCard() {
  return <div className="aspect-[3/4] animate-pulse rounded-[2rem] bg-zinc-200" />;
}

// Mobile-only "phone screenshot" style card: black bezel bars top/bottom
function PhoneDealCard({ deal }: { deal: ActiveDeal }) {
  const hasImage = deal.image_url && deal.image_url.startsWith("http");
  const brandInitials = deal.brand_name
    ? deal.brand_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  const inner = (
    <div className="relative aspect-[3/4] overflow-hidden rounded-[2rem] bg-black shadow-md">
      {hasImage ? (
        <Image
          src={deal.image_url!}
          alt={deal.title}
          fill
          sizes="50vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
          <span className="font-oswald text-3xl font-black text-white/20">{brandInitials}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />

      {/* Bezel bars */}
      <div className="absolute inset-x-0 top-0 h-3 bg-black" />
      <div className="absolute inset-x-0 bottom-0 h-3 bg-black" />

      {deal.brand_name && (
        <div className="absolute left-3 top-6">
          <div className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-black">
            {deal.brand_name}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-0 w-full px-3.5">
        {deal.description && (
          <p className="text-xs leading-snug text-white/80 line-clamp-2">{deal.description}</p>
        )}
        <h3 className="mt-1 font-oswald text-xl font-black leading-[1.05] tracking-tight text-white">
          {deal.title}
        </h3>
        <p className="mt-1.5 text-[10px] text-white/55">
          {formatDateRange(deal.start_date, deal.end_date)}
        </p>
        {deal.cta_url && (
          <p className="mt-1.5 text-xs font-semibold text-primary">
            View Deal →
          </p>
        )}
      </div>
    </div>
  );

  return deal.cta_url ? (
    <Link href={deal.cta_url} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function DealCard({ deal }: { deal: ActiveDeal }) {
  const hasImage = deal.image_url && deal.image_url.startsWith("http");
  const brandInitials = deal.brand_name
    ? deal.brand_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "—";

  const inner = (
    <Card className="group relative overflow-hidden rounded-3xl border-0 bg-black shadow-none">
      <div className="relative h-[340px]">
        {hasImage ? (
          <Image
            src={deal.image_url!}
            alt={deal.title}
            fill
            sizes="(max-width: 640px) 240px, 285px"
            className="object-cover transition duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
            <span className="font-oswald text-5xl font-black text-white/20">{brandInitials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

        {deal.brand_name && (
          <div className="absolute left-4 top-4">
            <div className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
              {deal.brand_name}
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 w-full p-5">
          {deal.description && (
            <p className="text-sm text-white/80">{deal.description}</p>
          )}
          <h3 className="mt-1 font-oswald text-3xl font-black leading-none tracking-tight text-white">
            {deal.title}
          </h3>
          <p className="mt-2 text-xs text-white/55">
            {formatDateRange(deal.start_date, deal.end_date)}
          </p>
          {deal.cta_url && (
            <p className="mt-2 text-xs font-semibold text-primary/90 group-hover:text-primary transition-colors">
              View Deal →
            </p>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-w-[240px] flex-[0_0_240px] sm:min-w-[265px] sm:flex-[0_0_265px] md:min-w-[285px] md:flex-[0_0_285px]">
      {deal.cta_url ? (
        <Link href={deal.cta_url} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

export default function DealsSection() {
  const [deals,   setDeals]   = useState<ActiveDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const autoplay = useRef(Autoplay({ delay: 4500, stopOnInteraction: true }));
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: "start", dragFree: true, loop: false },
    [autoplay.current],
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    async function fetchDeals() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_active_deals");
      if (!error && data) setDeals(data as ActiveDeal[]);
      setLoading(false);
    }
    fetchDeals();
  }, []);

  // Reinit Embla after deals load so snap points are correct
  useEffect(() => { emblaApi?.reInit(); }, [emblaApi, deals]);

  // Hide section entirely when no deals and not loading
  if (!loading && deals.length === 0) return null;

  return (
    <section className="overflow-hidden py-16 md:py-24">
      <div className="mx-auto max-w-[1400px]">
        <motion.div
          className="mb-10 flex items-start justify-between px-4 sm:px-6 lg:px-10"
          initial="hidden"
          whileInView="visible"
          viewport={viewport}
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Limited Time</p>
            <h2 className="mt-2 font-oswald text-3xl font-black tracking-tight text-black sm:text-4xl">
              Deals & Offers
            </h2>
            <p className="mt-2 text-base text-black/65">Get cash back directly from the manufacturer!</p>
          </motion.div>

          {!loading && deals.length > 1 && (
            <motion.div variants={fadeUp} className="hidden shrink-0 items-center gap-3 md:flex">
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous deal"
                onClick={scrollPrev}
                className="h-10 w-10 rounded-full border-primary bg-transparent text-primary hover:bg-primary/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                aria-label="Next deal"
                onClick={scrollNext}
                className="h-10 w-10 rounded-full bg-primary text-white hover:bg-[#c89907]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Mobile — static 2-column phone-frame grid */}
        <div className="grid grid-cols-2 gap-3 px-4 sm:hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <PhoneSkeletonCard key={i} />)
            : deals.map((deal) => <PhoneDealCard key={deal.promotion_id} deal={deal} />)}
        </div>

        {/* Tablet/desktop — horizontal scroll carousel */}
        <div className="hidden sm:block">
          {loading ? (
            <div className="flex gap-4 overflow-hidden pl-4 sm:pl-6 lg:pl-10">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="overflow-hidden pl-4 sm:pl-6 lg:pl-10" ref={emblaRef}>
              <div className="flex gap-4">
                {deals.map((deal) => (
                  <DealCard key={deal.promotion_id} deal={deal} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

