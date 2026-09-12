'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ShoppingCart, Search } from 'lucide-react'
import { useCartStore } from '@/stores/cart.store'

export default function StorefrontHeader() {
  const { itemCount, openCart } = useCartStore()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const count = mounted ? itemCount() : 0

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <div className="w-3 h-3 rounded-full border-2 border-zinc-800" />
            </div>
            <span className="font-bold text-zinc-900 text-sm tracking-wide">TYRES & CAR VALETING</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <Link href="/tyres"   className="hover:text-zinc-900 transition-colors">Shop Tyres</Link>
            <Link href="/tyres?application_type=4x4" className="hover:text-zinc-900 transition-colors">4×4 / SUV</Link>
            <Link href="/tyres?application_type=TBR" className="hover:text-zinc-900 transition-colors">Truck</Link>
            <Link href="/contact" className="hover:text-zinc-900 transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/search" className="rounded-lg p-2 text-zinc-500 hover:text-zinc-900 hover:!bg-zinc-100 transition-colors">
              <Search className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={openCart}
              className="relative rounded-lg p-2 text-zinc-500 hover:text-zinc-900 hover:!bg-zinc-100 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-zinc-900 px-1">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
