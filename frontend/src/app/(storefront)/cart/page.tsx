'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, Lock, ChevronDown,
  Trash2, Truck, ShieldCheck, RotateCcw, ImageOff
} from 'lucide-react'
import { useCartStore } from '@/stores/cart.store'

function isAbsoluteUrl(url: string) {
  return url.startsWith('https://') || url.startsWith('http://')
}

function fmt(n: number) {
  return `A$${n.toFixed(2)}`
}

// ── Empty state ──────────────────────────────────────────────────────────────
function EmptyCart() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-5">
        <ShoppingCart className="w-9 h-9 text-zinc-400" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Your cart is empty</h1>
      <p className="text-sm text-zinc-500 mb-8">Add tyres from the shop to continue.</p>
      <Link
        href="/tyres"
        className="inline-block rounded-xl bg-primary px-8 py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors"
      >
        Browse Tyres
      </Link>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function CartPage() {
  const {
    items, qty, removeItem, updateQuantity,
    subtotal, itemCount,
  } = useCartStore()

  const router = useRouter()

  const count      = itemCount()
  const tyresTotal = subtotal()
  const total      = tyresTotal
  const gst        = +(total / 11).toFixed(2)

  if (items.length === 0) return <EmptyCart />

  return (
    <div className="bg-zinc-50 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Page heading */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary">
            <ShoppingCart className="w-5 h-5 text-zinc-900" />
          </div>
          <h1 className="text-xl font-black text-zinc-900 uppercase tracking-widest">
            Your Shopping Cart
          </h1>
          <span className="text-sm font-semibold text-zinc-400">
            ({count} {count === 1 ? 'item' : 'items'})
          </span>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* ── Left: items table ───────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Column headers — desktop only */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_100px] gap-4 pb-3 text-[15px] font-semibold uppercase text-zinc-700 tracking-wide mb-0">
              <span>PRODUCT</span>
              <span className="text-left">QTY</span>
              <span className="text-left">PRICE</span>
              <span className="text-left">SET-PRICE</span>
            </div>
            <div className="hidden sm:block border-b border-zinc-200 mb-2"></div>

            <div className="flex flex-col">
              {items.map(item => {
                const itemQty  = qty[item.id] ?? 0
                const lineTotal = item.price * itemQty
                const maxQty   = Math.min(item.stock, 8)

                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_80px_80px_100px] gap-4 items-start py-5 border-b border-zinc-100 last:border-b-0"
                  >
                    {/* Left: Product Info */}
                    <div className="flex gap-5 items-start w-full">
                      {/* Image & Remove Column */}
                      <div className="flex flex-col items-center gap-2 w-[110px] shrink-0">
                        <div className="w-full aspect-square bg-white border border-zinc-300 relative p-1 flex items-center justify-center">
                          {item.image && isAbsoluteUrl(item.image) ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-contain p-1"
                              sizes="110px"
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100/50">
                              <div className="relative flex items-center justify-center w-12 h-12">
                                <div className="absolute inset-0 rounded-full border-[2px] border-dashed border-zinc-300 animate-[spin_20s_linear_infinite]" />
                                <div className="absolute inset-2.5 rounded-full border-[1.5px] border-zinc-300/80" />
                                <ImageOff className="w-3.5 h-3.5 text-zinc-500 relative z-10" />
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-[13px] text-zinc-800 hover:text-black transition-colors"
                        >
                          Remove from cart
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        {/* Discount badge */}
                        <div className="h-7 mb-4">
                          {itemQty >= 4 && (
                            <div className="inline-flex items-center bg-[#3A76F0] text-white text-[13px] px-3 py-1 rounded-full">
                              <span>Save <span className="font-bold">15%</span> on 4 tyres</span>
                            </div>
                          )}
                        </div>

                        {/* Brand Logo Placeholder */}
                        <div className="flex items-center mb-4">
                           <div className="text-[15px] font-black italic tracking-widest uppercase text-green-700 flex items-center gap-1">
                             {item.sku ? item.sku.split('-')[0] : 'BRAND'}
                           </div>
                        </div>

                        <p className="text-[15px] font-bold text-zinc-800 leading-tight mb-1">{item.name}</p>
                        <p className="text-[15px] font-bold text-zinc-800">{item.size}</p>
                      </div>
                    </div>

                    {/* Right Columns */}
                    <div className="sm:mx-auto mt-2 sm:mt-0">
                      <div className="relative">
                        <select
                          value={itemQty}
                          onChange={e => updateQuantity(item.id, Number(e.target.value))}
                          className="appearance-none h-8 w-14 pl-3 pr-6 rounded-sm border border-zinc-200 text-[15px] text-zinc-800 bg-white focus:outline-none focus:border-zinc-400 cursor-pointer"
                        >
                          {Array.from({ length: maxQty }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      </div>
                    </div>

                    <div className="hidden sm:block text-left pt-1">
                       <span className="text-[15px] text-zinc-700">{item.price > 0 ? `$${item.price.toFixed(0)}` : 'POA'}</span>
                    </div>

                    <div className="hidden sm:block text-left pt-1">
                       <span className="text-[15px] font-bold text-zinc-900">{item.price > 0 ? `$${lineTotal.toFixed(0)}` : 'POA'}</span>
                    </div>

                    {/* Mobile fallback */}
                    <div className="sm:hidden flex flex-col gap-1 w-full text-right mt-2">
                       <span className="text-sm text-zinc-600">Price: {item.price > 0 ? `$${item.price.toFixed(0)}` : 'POA'}</span>
                       <span className="text-sm font-bold text-zinc-900">Total: {item.price > 0 ? `$${lineTotal.toFixed(0)}` : 'POA'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Trust strip */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: <Truck className="w-4 h-4 text-zinc-900" />,       bg: 'bg-primary', text: 'Fast delivery across Australia' },
                { icon: <ShieldCheck className="w-4 h-4 text-zinc-900" />, bg: 'bg-primary', text: 'Secure SSL checkout' },
                { icon: <RotateCcw className="w-4 h-4 text-zinc-900" />,   bg: 'bg-primary', text: 'Easy returns & exchanges' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-zinc-200 px-4 py-3">
                  <div className={`${t.bg} w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}>{t.icon}</div>
                  <span className="text-xs font-semibold text-zinc-700">{t.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: order summary ─────────────────────────────────── */}
          <div className="w-full lg:w-[340px] lg:shrink-0 space-y-3">

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">

              {/* Header */}
              <div className="px-5 py-3.5 border-b border-zinc-200 bg-zinc-900 flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white">Order Summary</p>
              </div>

              {/* Per-item rows */}
              <div className="divide-y divide-zinc-50">
                {items.map(item => {
                  const itemQty  = qty[item.id] ?? 0
                  const lineTotal = item.price * itemQty
                  return (
                    <div key={item.id} className="px-5 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold bg-zinc-900 text-white rounded px-1.5 py-0.5 uppercase">
                            {itemQty >= 4 ? `${itemQty} Set` : `${itemQty}×`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            aria-label="Remove"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-zinc-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-zinc-400">{item.size}</p>
                      </div>
                      <p className="text-sm font-bold text-zinc-900 shrink-0">
                        {item.price > 0 ? fmt(lineTotal) : 'POA'}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="px-5 py-4 border-t border-zinc-100 space-y-3">

                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Price of All Items</span>
                  <span className="text-sm font-bold text-zinc-900">{fmt(tyresTotal)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">
                    <Truck className="w-3.5 h-3.5 text-primary" />
                    Shipping Totals
                  </span>
                  <button
                    type="button"
                    className="text-primary hover:underline text-xs font-semibold"
                    onClick={() => router.push('/checkout')}
                  >
                    Calculated at checkout
                  </button>
                </div>

                {/* Grand total */}
                <div className="flex justify-between items-end border-t-2 border-zinc-900 pt-3">
                  <div>
                    <p className="text-base font-black text-zinc-900 uppercase tracking-wide">Total</p>
                    <p className="text-[11px] text-zinc-400 font-medium">(incl. {fmt(gst)} GST)</p>
                  </div>
                  <p className="text-2xl font-black text-zinc-900">{fmt(total)}</p>
                </div>
              </div>
            </div>

            {/* Secure Checkout CTA */}
            <button
              type="button"
              onClick={() => router.push('/checkout')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-extrabold text-zinc-900 hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Lock className="w-4 h-4" />
              Secure Checkout
            </button>

            <Link
              href="/tyres"
              className="block w-full rounded-xl border border-zinc-300 py-3.5 text-center text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Continue Shopping
            </Link>

          </div>
        </div>
      </div>
    </div>
  )
}
