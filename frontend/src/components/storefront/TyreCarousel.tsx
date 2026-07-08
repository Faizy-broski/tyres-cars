'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { createClient } from '@/lib/supabase/client'
import type { TyreSku } from '@/lib/supabase/search.types'
import TyreCard from './TyreCard'

interface Props {
  width:   number
  profile: number
  rimSize: number
  onAddToCart: (hit: TyreSku) => void
}

function SkeletonCard() {
  return (
    <div className="min-w-[300px] flex-[0_0_300px]">
      <div className="h-[220px] animate-pulse rounded-2xl bg-zinc-100" />
    </div>
  )
}

export default function TyreCarousel({ width, profile, rimSize, onAddToCart }: Props) {
  const [tyres,   setTyres]   = useState<TyreSku[]>([])
  const [loading, setLoading] = useState(true)

  const autoplay = useRef(Autoplay({ delay: 4500, stopOnInteraction: true }))
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { align: 'start', dragFree: true, loop: false },
    [autoplay.current],
  )
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    let cancelled = false
    async function fetchTyres() {
      setLoading(true)
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('search_tyres', {
        p_width:    width,
        p_profile:  profile,
        p_rim_size: rimSize,
        p_sort:     'stock_desc',
      })
      if (!cancelled) {
        if (!error && data) setTyres((data as TyreSku[]).slice(0, 8))
        setLoading(false)
      }
    }
    fetchTyres()
    return () => { cancelled = true }
  }, [width, profile, rimSize])

  useEffect(() => { emblaApi?.reInit() }, [emblaApi, tyres])

  if (!loading && tyres.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-oswald text-lg font-bold text-zinc-900 uppercase tracking-wide">Popular in your size</h2>
        {!loading && tyres.length > 1 && (
          <div className="hidden sm:flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous"
              onClick={scrollPrev}
              className="h-8 w-8 rounded-full border-primary bg-transparent text-primary hover:bg-primary/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              aria-label="Next"
              onClick={scrollNext}
              className="h-8 w-8 rounded-full bg-primary text-zinc-900 hover:brightness-110"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-4">
            {tyres.map(hit => (
              <div key={hit.product_id} className="min-w-[300px] flex-[0_0_300px]">
                <TyreCard hit={hit} onAddToCart={onAddToCart} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
