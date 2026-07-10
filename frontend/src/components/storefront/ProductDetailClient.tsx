'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, ChevronLeft, ImageOff, Wrench, Truck, RotateCcw, ShieldCheck, PackageCheck, Clock, HelpCircle } from 'lucide-react'
import { useCartStore } from '@/stores/cart.store'
import FitterSelectionModal from '@/components/storefront/FitterSelectionModal'
import { DiscountBadge } from '@/components/storefront/TyreCard'

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

function SpecRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
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

  const displayPrice = product.promo_price != null && product.promo_price < (product.retail_price ?? 0)
    ? product.promo_price
    : product.retail_price

  async function handleAddToCart() {
    const result = await addItem({
      id:    product.product_id,
      sku:   product.sku,
      name:  `${product.brand_name ?? ''} ${product.pattern_name ?? ''}`.trim(),
      size:  product.tyre_size_display,
      price: product.retail_price ?? 0,
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

  const hasPromo = product.retail_price != null && product.promo_price != null && product.promo_price < product.retail_price

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
        <div className="min-w-0 flex flex-col-reverse sm:flex-row gap-3">
          {images.length > 1 && (
            <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto sm:max-h-[420px] pb-1 sm:pb-0 sm:w-16 shrink-0">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeImg ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  <Image src={img} alt="" width={64} height={64} className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
          <div className="aspect-[4/3] rounded-2xl bg-zinc-100 relative overflow-hidden flex-1 min-w-0">
            {hasPromo && (
              <div className="absolute top-3 left-3 z-10">
                <DiscountBadge original={product.retail_price!} promo={product.promo_price!} />
              </div>
            )}
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
            {hasPromo && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Limited Time Offer — Save More Today!
              </div>
            )}

            <div className="flex items-baseline justify-between">
              {product.retail_price != null ? (
                hasPromo ? (
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Was</p>
                    <p className="text-sm text-zinc-400 line-through leading-none">
                      ${product.retail_price!.toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mt-1.5">Now</p>
                    <p className="text-3xl font-bold text-primary">
                      ${product.promo_price!.toLocaleString()}
                    </p>
                    <p className="text-xs font-semibold text-green-600 mt-1">
                      You save ${(product.retail_price! - product.promo_price!).toLocaleString()}
                    </p>
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

            {/* Informational only — no real Afterpay/Zip integration exists */}
            {displayPrice != null && (
              <p className="text-xs text-zinc-500">
                or 4 payments of <span className="font-semibold text-zinc-700">${(displayPrice / 4).toFixed(2)}</span> with{' '}
                <span className="font-semibold">Afterpay</span> or <span className="font-semibold">Zip</span>
              </p>
            )}

            <p className="text-xs text-zinc-500 border-t border-zinc-100 pt-3">
              All-inclusive price — includes delivery, balancing, new valve and eco-friendly tyre disposal.
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            <p className="text-xs text-zinc-500 leading-relaxed">
              Not sure this is the right fit, or have questions about delivery and fitting? Use &ldquo;Choose a Fitter&rdquo; above to book a fitting station near you, or add to cart to see full delivery details at checkout.
            </p>
          </div>
        </div>
      </div>

      {/* Tyre details & What's included — full width below the order summary */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.1fr_340px] gap-8 items-start">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-1">Tyre Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
            <SpecRow label="Model"              value={product.pattern_name} />
            <SpecRow label="Product Code"       value={product.sku} />
            <SpecRow label="Brand"              value={product.brand_name} />
            <SpecRow label="Tyre Size"          value={product.tyre_size_display} />
            <SpecRow label="Load Index"         value={product.load_index} />
            <SpecRow label="Speed Rating"       value={product.speed_rating} />

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
  const [showOos, setShowOos] = useState(false)

  const inStock = siblings.filter(s => s.total_available_stock > 0)
  const oos     = siblings.filter(s => s.total_available_stock === 0)

  const pill = (s: Sibling) => (
    <Link
      key={s.product_id}
      href={s.product_slug ? `/tyres/${s.product_slug}` : '#'}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
    >
      {s.tyre_size_display}
    </Link>
  )

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Select Tyre Size</p>

      <div className="flex flex-wrap gap-2">
        {/* Current size — always first */}
        <span className="rounded-lg border-2 border-primary bg-primary px-3 py-1.5 text-xs font-bold text-zinc-900 shadow-sm whitespace-nowrap">
          {current.tyre_size_display}
        </span>

        {/* In-stock siblings */}
        {inStock.map(pill)}

        {/* OOS toggle */}
        {oos.length > 0 && !showOos && (
          <button
            type="button"
            onClick={() => setShowOos(true)}
            className="rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors whitespace-nowrap"
          >
            +{oos.length} more (OOS)
          </button>
        )}

        {/* OOS sizes revealed */}
        {showOos && oos.map(s => (
          <Link
            key={s.product_id}
            href={s.product_slug ? `/tyres/${s.product_slug}` : '#'}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 transition-colors whitespace-nowrap"
          >
            {s.tyre_size_display}
          </Link>
        ))}

        {showOos && (
          <button
            type="button"
            onClick={() => setShowOos(false)}
            className="rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 transition-colors whitespace-nowrap"
          >
            Hide OOS
          </button>
        )}
      </div>
    </div>
  )
}
