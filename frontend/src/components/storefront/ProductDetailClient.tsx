'use client'

import { useState } from 'react'
import type { ComponentType } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, ChevronLeft, ImageOff, Wrench, Truck, RotateCcw, ShieldCheck, PackageCheck,
  Clock, HelpCircle, Check, Tag, Hash, Award, Ruler, Gauge, Mail, BadgeCheck,
} from 'lucide-react'
import { useCartStore } from '@/stores/cart.store'
import FitterSelectionModal from '@/components/storefront/FitterSelectionModal'
import { DiscountBadge, RibbonBadge } from '@/components/storefront/TyreCard'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'

const SUPPORT_EMAIL = 'support@tyrevault.com.au'

interface Sibling {
  product_id:        string
  product_slug:      string | null
  tyre_size_display: string
  width:             number | null
  profile:           number | null
  rim_size:          number | null
  total_available_stock: number
}

interface Product {
  product_id:        string
  sku:               string
  product_slug:      string | null
  tyre_size_display: string
  brand_name:        string | null
  brand_slug:        string | null
  pattern_name:      string | null
  pattern_slug:      string | null
  pattern_short_description: string | null
  application_type:  string | null
  retail_price:      number | null
  promo_price:       number | null
  compare_at_price:  number | null
  total_available_stock: number
  gallery_images:    string[]
  variant_images:    string[] | null
  runflat:           boolean
  xl_reinforced:     boolean
  speed_rating:      string | null
  load_index:        string | null
  ply_rating:        string | null
  load_range:        string | null
  construction_type: string | null
  sidewall:          string | null
  country_of_origin: string | null
  overall_diameter:  number | null
  tread_depth:       number | null
  tyre_weight:       number | null
  e_mark:            string | null
  utqg:              string | null
  fuel_rating:       string | null
  wet_grip:          string | null
  noise_db:          string | null
  noise_class:       string | null
  width:             number | null
  profile:           number | null
  rim_size:          number | null
  siblings:          Sibling[]
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="text-sm font-medium text-red-600">Out of stock</span>
  if (stock <= 4)  return <span className="text-sm font-medium text-amber-600">Low stock — {stock} left</span>
  return <span className="text-sm font-medium text-green-700">In stock</span>
}

function EULabel({ fuel, wet, noise, noiseClass }: {
  fuel?: string | null; wet?: string | null; noise?: string | null; noiseClass?: string | null
}) {
  if (!fuel && !wet && !noise) return null
  const ratingColour = (r?: string | null) => {
    if (!r) return 'text-zinc-400'
    const map: Record<string, string> = { A: 'text-green-600', B: 'text-lime-600', C: 'text-yellow-600', D: 'text-amber-600', E: 'text-orange-600', F: 'text-red-600', G: 'text-red-700' }
    return map[r.toUpperCase()] ?? 'text-zinc-600'
  }
  return (
    <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      {fuel && (
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-0.5">Fuel</p>
          <p className={`text-xl font-bold ${ratingColour(fuel)}`}>{fuel}</p>
        </div>
      )}
      {wet && (
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-0.5">Wet Grip</p>
          <p className={`text-xl font-bold ${ratingColour(wet)}`}>{wet}</p>
        </div>
      )}
      {noise && (
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-0.5">Noise</p>
          <p className="text-base font-bold text-zinc-800">{noise} dB {noiseClass ? `(${noiseClass})` : ''}</p>
        </div>
      )}
    </div>
  )
}

function SpecRow({ label, value, icon: Icon }: {
  label: string; value?: string | number | null; icon?: ComponentType<{ className?: string }>
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 last:border-0">
      <span className="flex items-center gap-2 text-sm text-zinc-500">
        {Icon && <Icon className="w-4 h-4 text-zinc-400 shrink-0" />}
        {label}
      </span>
      <span className="text-sm font-medium text-zinc-800">{String(value)}</span>
    </div>
  )
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const [activeImg, setActiveImg] = useState(0)
  const [fitterOpen, setFitterOpen] = useState(false)
  const [qty, setQty] = useState(1)
  const { addItem, openCart } = useCartStore()

  const images = [
    ...(product.variant_images ?? []),
    ...(product.gallery_images ?? []),
  ].filter(Boolean)

  // A time-limited promotion (promotions table) takes priority over the evergreen
  // "Compare At" price set directly on the SKU — if neither applies, there's no discount.
  const hasActivePromo = product.retail_price != null && product.promo_price != null && product.promo_price < product.retail_price
  const hasCompareDiscount = !hasActivePromo && product.retail_price != null && product.compare_at_price != null && product.compare_at_price > product.retail_price
  const hasPromo = hasActivePromo || hasCompareDiscount

  const wasPrice = hasActivePromo ? product.retail_price : hasCompareDiscount ? product.compare_at_price : null
  const nowPrice = hasActivePromo ? product.promo_price   : product.retail_price
  const displayPrice = nowPrice

  async function handleAddToCart() {
    const result = await addItem({
      id:    product.product_id,
      sku:   product.sku,
      name:  `${product.brand_name ?? ''} ${product.pattern_name ?? ''}`.trim(),
      size:  product.tyre_size_display,
      price: displayPrice ?? 0,
      image: images[0]?.startsWith('http') ? images[0] : null,
      stock: product.total_available_stock,
    }, qty)
    if (result.error === 'out_of_stock') {
      alert('Sorry, this item is out of stock.')
      return
    }
    if (result.error === 'insufficient_stock') {
      alert(`Only ${result.available} unit(s) available. Cart updated to maximum.`)
    }
    openCart()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/tyres" className="flex items-center gap-1 hover:text-zinc-800">
          <ChevronLeft className="w-3.5 h-3.5" />
          Shop Tyres
        </Link>
        <span>/</span>
        {product.brand_name && (
          <>
            <Link href={`/tyres?brand=${encodeURIComponent(product.brand_name)}`} className="hover:text-zinc-800">
              {product.brand_name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-zinc-800">{product.tyre_size_display}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr_340px] gap-8 items-start">
        {/* Column 1 — Gallery */}
        <div className="min-w-0 flex flex-col gap-3">
          <div className="aspect-[4/3] rounded-2xl bg-zinc-100 relative overflow-hidden">
            <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
              {product.pattern_name && <RibbonBadge tone="premium" label={product.pattern_name} />}
              {hasPromo && <DiscountBadge original={wasPrice!} promo={nowPrice!} />}
            </div>
            {images.length > 0 && (images[activeImg]?.startsWith('http') || images[activeImg]?.startsWith('/')) ? (
              <Image
                src={images[activeImg]}
                alt={product.tyre_size_display}
                fill
                className="object-contain p-8"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100/50">
                <div className="relative flex items-center justify-center w-28 h-28 mb-4">
                  <div className="absolute inset-0 rounded-full border-[4px] border-dashed border-zinc-300 animate-[spin_20s_linear_infinite]" />
                  <div className="absolute inset-5 rounded-full border-[3px] border-zinc-300/80" />
                  <ImageOff className="w-8 h-8 text-zinc-500 relative z-10" />
                </div>
                <span className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Image Coming Soon</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeImg ? 'border-primary' : 'border-zinc-200'
                  }`}
                >
                  <Image src={img} alt="" width={64} height={64} className="w-full h-full object-contain p-1 bg-zinc-50" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Column 2 — Product info & pricing */}
        <div className="min-w-0 space-y-5">
          <div>
            {product.brand_name && (
              <p className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">{product.brand_name}</p>
            )}
            <h1 className="text-2xl font-black text-zinc-900 mt-1 font-oswald uppercase tracking-wide">
              {product.pattern_name ?? product.sku}
            </h1>
            <p className="text-lg text-zinc-600 mt-0.5">{product.tyre_size_display}</p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {product.runflat      && <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">Runflat</span>}
            {product.xl_reinforced && <span className="rounded-full bg-purple-50 text-purple-700 px-3 py-1 text-xs font-medium">XL / Extra Load</span>}
            {product.application_type && <span className="rounded-full bg-zinc-100 text-zinc-700 px-3 py-1 text-xs font-medium">{product.application_type}</span>}
          </div>

          {/* EU Label */}
          <EULabel fuel={product.fuel_rating} wet={product.wet_grip} noise={product.noise_db} noiseClass={product.noise_class} />

          {/* Price */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
            <div className="flex items-start justify-between">
              {product.retail_price != null ? (
                hasPromo ? (
                  <div className="flex items-stretch divide-x divide-zinc-200">
                    <div className="pr-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Was</p>
                      <p className="text-lg text-zinc-400 line-through leading-tight">
                        ${wasPrice!.toLocaleString()}
                      </p>
                    </div>
                    <div className="pl-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Now</p>
                      <p className="text-3xl font-bold text-primary leading-tight">
                        ${nowPrice!.toLocaleString()}
                        <span className="text-sm font-medium text-zinc-500"> /each</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-zinc-900">
                    ${product.retail_price.toLocaleString()}
                  </p>
                )
              ) : (
                <p className="text-base text-zinc-500">Price on request</p>
              )}
              <StockBadge stock={product.total_available_stock} />
            </div>

            {hasActivePromo && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Limited Time Offer — Save More Today!
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-zinc-500 border-t border-zinc-100 pt-3">
              <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span><span className="font-semibold text-zinc-700">All-Inclusive Price:</span> Includes delivery, balancing, new valve and eco-friendly tyre disposal.</span>
            </p>
          </div>

          {/* Size selector */}
          {product.siblings.length > 0 && (
            <SizeSelector current={product} siblings={product.siblings} />
          )}
        </div>

        {/* Column 3 — Sidebar */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3">
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">Order Summary</h2>

            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Quantity</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    disabled={n > product.total_available_stock}
                    onClick={() => setQty(n)}
                    className={`w-9 h-9 rounded-lg border-2 text-sm font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      qty === n ? 'border-primary bg-primary text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:border-primary'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-baseline justify-between border-t border-zinc-100 pt-3">
              <span className="text-sm text-zinc-500">Order Total</span>
              <span className="text-xl font-bold text-primary">
                {displayPrice != null ? `$${(displayPrice * qty).toLocaleString()}` : '—'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.total_available_stock === 0}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold uppercase tracking-wide text-zinc-900 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
              {product.total_available_stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <button
              type="button"
              onClick={() => setFitterOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 py-3 text-sm font-semibold text-zinc-700 hover:border-primary hover:text-primary transition-colors"
            >
              <Wrench className="w-4 h-4" />
              Choose a Fitter
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <div className="flex items-center gap-2 mb-1.5">
              <HelpCircle className="w-4 h-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900">Need Help?</h2>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-3">
              Our team is here to help you. We&apos;ll get back to you shortly.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Enquiry about ${product.pattern_name ?? product.sku} ${product.tyre_size_display}`)}`}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 bg-white py-2.5 text-xs font-semibold text-zinc-700 hover:border-primary hover:text-primary transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Send an Enquiry
            </a>
          </div>
        </div>
      </div>

      {/* Tyre details & What's included — full width below the order summary */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.1fr_340px] gap-8 items-start">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-1">Tyre Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
            <SpecRow label="Model"              value={product.pattern_name} icon={Tag} />
            <SpecRow label="Product Code"       value={product.sku} icon={Hash} />
            <SpecRow label="Brand"              value={product.brand_name} icon={Award} />
            <SpecRow label="Tyre Size"          value={product.tyre_size_display} icon={Ruler} />
            <SpecRow label="Load Index"         value={product.load_index} icon={Gauge} />
            <SpecRow label="Speed Rating"       value={product.speed_rating} icon={Gauge} />

            <SpecRow label="Width"              value={product.width ? `${product.width} mm` : null} />
            <SpecRow label="Profile"            value={product.profile ? `${product.profile}%` : null} />
            <SpecRow label="Rim Size"           value={product.rim_size ? `${product.rim_size}"` : null} />
            <SpecRow label="Construction"       value={product.construction_type} />
            <SpecRow label="Ply Rating"         value={product.ply_rating} />
            <SpecRow label="Load Range"         value={product.load_range} />
            <SpecRow label="Sidewall"           value={product.sidewall} />
            <SpecRow label="Overall Diameter"   value={product.overall_diameter ? `${product.overall_diameter} mm` : null} />
            <SpecRow label="Tread Depth"        value={product.tread_depth ? `${product.tread_depth} mm` : null} />
            <SpecRow label="Tyre Weight"        value={product.tyre_weight ? `${product.tyre_weight} kg` : null} />
            <SpecRow label="E-Mark"             value={product.e_mark} />
            <SpecRow label="UTQG"               value={product.utqg} />
          </div>
        </div>

        <WhatsIncluded />
      </div>

      {/* Description — full width below the 3-column grid */}
      {product.pattern_short_description && (
        <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-3">About this tyre</h2>
          <div
            className="text-sm text-zinc-600 leading-relaxed space-y-2 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1"
            dangerouslySetInnerHTML={{ __html: product.pattern_short_description }}
          />
        </div>
      )}

      <FitterSelectionModal
        open={fitterOpen}
        onClose={() => setFitterOpen(false)}
        tyreQty={qty}
        cartSubtotal={product.retail_price ?? 0}
      />
    </div>
  )
}

function WhatsIncluded() {
  const items = [
    { icon: Truck,        label: 'Free Delivery' },
    { icon: Wrench,       label: 'Professional Balancing' },
    { icon: ShieldCheck,  label: 'New Valve' },
    { icon: RotateCcw,    label: 'Eco-Friendly Tyre Disposal' },
    { icon: PackageCheck, label: 'Dispatch in 1–2 Business Days' },
    { icon: Truck,        label: 'Delivery in 2–7 Business Days' },
    { icon: ShieldCheck,  label: '100% Genuine Product' },
  ]
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-3">What&apos;s Included</h2>
      <ul className="space-y-2.5">
        {items.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2.5 text-sm text-zinc-700">
            <Icon className="w-4 h-4 text-primary shrink-0" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SizeSelector({ current, siblings }: { current: { tyre_size_display: string }; siblings: Sibling[] }) {
  const router = useRouter()

  const options = [
    { product_id: 'current', product_slug: null, tyre_size_display: current.tyre_size_display, total_available_stock: 1 } as Sibling,
    ...siblings,
  ]

  function handleChange(slug: string) {
    if (slug) router.push(`/tyres/${slug}`)
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Select Tyre Size</p>

      <div className="flex flex-wrap items-center gap-3">
        <select
          defaultValue=""
          onChange={e => handleChange(e.target.value)}
          className="flex-1 min-w-[160px] rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          {options.map(s => (
            <option
              key={s.product_id}
              value={s.product_slug ?? ''}
              disabled={s.product_id !== 'current' && s.total_available_stock === 0}
            >
              {s.tyre_size_display}{s.product_id !== 'current' && s.total_available_stock === 0 ? ' (Out of stock)' : ''}
            </option>
          ))}
        </select>

        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              <BadgeCheck className="w-4 h-4" />
              Price Match
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Price Match Promise</DialogTitle>
              <DialogDescription>
                Found this tyre cheaper elsewhere? Send us the details and we&apos;ll do our best to match it.{' '}
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Price match request — ${current.tyre_size_display}`)}`}>
                  Email {SUPPORT_EMAIL}
                </a>{' '}
                with a link to the competitor&apos;s listing.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
