'use client'

import Image from 'next/image'
import { ShoppingCart, ImageOff, Mail } from 'lucide-react'
import type { TyreSku } from '@/lib/supabase/search.types'
import InquiryModal from '@/components/storefront/InquiryModal'

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-xs font-semibold text-red-500">Out of stock</span>
  if (stock <= 4)  return <span className="text-xs font-semibold text-amber-500">Low stock — {stock} left</span>
  return <span className="text-xs font-semibold text-emerald-500">In stock</span>
}

export function RibbonBadge({ label, tone }: { label: string; tone: 'discount' | 'premium' }) {
  const tones = {
    discount: 'bg-red-500 text-white',
    premium:  'bg-primary text-zinc-900',
  }
  return (
    <div className={`rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm tracking-wide ${tones[tone]}`}>
      {label}
    </div>
  )
}

export function DiscountBadge({ original, promo }: { original: number; promo: number }) {
  const pct = Math.round((1 - promo / original) * 100)
  if (pct <= 0) return null
  return <RibbonBadge tone="discount" label={`-${pct}%`} />
}

export default function TyreCard({ hit, onAddToCart }: { hit: TyreSku; onAddToCart: (hit: TyreSku) => void }) {
  const hasPromo     = hit.promo_price != null && hit.price_inc_gst != null && hit.promo_price < hit.price_inc_gst
  const displayPrice = hasPromo ? hit.promo_price! : hit.price_inc_gst
  const href         = hit.product_slug ? `/tyres/${hit.product_slug}` : `/tyres?brand_id=${hit.brand_id}`
  const isPremium    = hit.brand_positioning === 'premium'

  return (
    <div className="group flex bg-white rounded-2xl border border-zinc-100 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden">

      {/* Left — image */}
      <a href={href} className="relative shrink-0 w-[42%] bg-zinc-50 overflow-hidden">
        {hit.brand_logo && hit.brand_logo.startsWith('http') && (
          <div className="absolute top-2 left-2 z-10 w-9 h-9 rounded-lg bg-white shadow-sm p-1 flex items-center justify-center">
            <Image src={hit.brand_logo} alt={hit.brand_name} width={28} height={28} className="object-contain w-full h-full" />
          </div>
        )}
        {hit.main_image && (hit.main_image.startsWith('http') || hit.main_image.startsWith('/')) ? (
          <Image
            src={hit.main_image}
            alt={hit.tyre_size_display}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 40vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center w-14 h-14 mb-1.5">
              <div className="absolute inset-0 rounded-full border-[3px] border-dashed border-zinc-200 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-3 rounded-full border-2 border-zinc-200/80" />
              <ImageOff className="w-4 h-4 text-zinc-300" />
            </div>
            <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">No Image</span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
          {hasPromo    && <DiscountBadge original={hit.price_inc_gst!} promo={hit.promo_price!} />}
          {isPremium   && <RibbonBadge tone="premium" label="Premium" />}
        </div>
      </a>

      {/* Right — details */}
      <div className="flex flex-col flex-1 min-w-0 p-4">
        {/* Brand */}
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.25em] truncate mb-1">
          {hit.brand_name}
        </p>

        {/* Name + size */}
        <a href={href} className="block flex-1">
          <p className="text-base font-black text-zinc-900 leading-tight line-clamp-2 font-oswald uppercase tracking-wide">
            {hit.pattern_name}
          </p>
          <p className="text-xs text-zinc-500 font-semibold mt-1">{hit.tyre_size_display}</p>
          {(hit.runflat || hit.xl_reinforced) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {hit.runflat       && <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-bold">Runflat</span>}
              {hit.xl_reinforced && <span className="text-[10px] bg-primary/15 text-zinc-700 px-2 py-0.5 rounded-md font-bold">XL</span>}
            </div>
          )}
        </a>

        {/* Price */}
        <div className="mt-2">
          {displayPrice != null ? (
            <>
              {hasPromo && (
                <p className="text-xs text-zinc-400 line-through leading-none mb-0.5">
                  ${hit.price_inc_gst!.toLocaleString()}
                </p>
              )}
              <p className="leading-none">
                <span className="text-xl font-black text-zinc-900">${displayPrice.toLocaleString()}</span>
                <span className="text-sm font-semibold text-zinc-400 ml-1">Each</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-zinc-400 italic font-medium">Price on request</p>
          )}
          <div className="mt-1">
            <StockBadge stock={hit.total_stock} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-1.5 mt-3">
          {hit.total_stock === 0 ? (
            <InquiryModal
              productId={hit.product_id}
              sku={hit.sku}
              productName={`${hit.brand_name} ${hit.pattern_name}`}
              tyreSizeDisplay={hit.tyre_size_display}
              productUrl={href}
              trigger={
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:brightness-110 active:scale-95 transition-all duration-150 py-2.5 text-sm font-bold text-zinc-900"
                >
                  <Mail className="w-4 h-4" />
                  Send Inquiry
                </button>
              }
            />
          ) : (
            <button
              type="button"
              onClick={() => onAddToCart(hit)}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary hover:brightness-110 active:scale-95 transition-all duration-150 py-2.5 text-sm font-bold text-zinc-900"
            >
              <ShoppingCart className="w-4 h-4" />
              Add to cart
            </button>
          )}
          <a
            href={href}
            className="w-full flex items-center justify-center rounded-lg border-2 border-primary py-2 text-sm font-bold text-zinc-900 hover:bg-primary/10 transition-colors"
          >
            View details
          </a>
        </div>
      </div>
    </div>
  )
}
