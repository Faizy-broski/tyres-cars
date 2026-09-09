'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FITTER_NAV } from '@/config/fitter-nav'

export default function FitterMobileMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="lg:hidden h-8 w-8 rounded-lg text-zinc-500"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-in drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-white border-r border-zinc-200 transform transition-transform duration-300 ease-in-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 border-b border-zinc-100 shrink-0">
          <Link href="/fitter/dashboard" onClick={() => setOpen(false)}>
            <Image src="/logo.svg" width={110} height={94} alt="Logo" className="h-10 w-auto" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="h-7 w-7 rounded-lg text-zinc-400"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {FITTER_NAV.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        <p className="px-4 py-3 text-[10px] text-zinc-400 border-t border-zinc-100 shrink-0">
          © 2025 Tyre Fitment Portal
        </p>
      </aside>
    </>
  )
}

