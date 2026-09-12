'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ChevronDown, User } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

const TYRE_CATEGORIES = [
  { label: 'Car Tyres',            href: '/tyres?app_type=PCR' },
  { label: 'SUV Tyres',            href: '/tyres?app_type=4x4' },
  { label: '4×4 / Off-Road',       href: '/tyres?app_type=4x4' },
  { label: 'Sports Tyres',         href: '/tyres?app_type=PCR' },
  { label: 'Truck / Commercial',   href: '/tyres?app_type=TBR' },
  { label: 'All Tyres',            href: '/tyres' },
]

const navLinks = [
  { label: 'Services', href: '/services' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

interface Props {
  session: Session | null
  onSignOut: () => void
  onOpenAuth: (tab: 'login' | 'register') => void
}

export default function MobileMenu({ session, onSignOut, onOpenAuth }: Props) {
  const [open, setOpen]       = useState(false)
  const [tyresOpen, setTyresOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const close = () => setOpen(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    if (open) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  const drawer = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 xl:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
        aria-hidden="true"
      />

      {/* Slide-in drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col bg-zinc-900 transform transition-transform duration-300 ease-in-out xl:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4 shrink-0">
          <Link href="/" onClick={close}>
            <Image src="/logo.svg" width={110} height={94} alt="Tyres & Car Valeting" className="h-9 w-auto" />
          </Link>
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <button
            type="button"
            onClick={() => setTyresOpen(o => !o)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/5 transition-colors"
          >
            Shop Tyres
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${tyresOpen ? 'rotate-180 text-primary' : 'text-zinc-500'}`} />
          </button>
          {tyresOpen && (
            <div className="ml-2 mb-1 space-y-0.5 border-l border-white/10 pl-3">
              {TYRE_CATEGORIES.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={close}
                  className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-primary transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}

          {navLinks.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={close}
              className="block rounded-lg px-3 py-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-white/5 transition-colors"
            >
              {label}
            </Link>
          ))}

          <div className="my-3 border-t border-white/10" />

          {session ? (
            <>
              <p className="flex items-center gap-2 px-3 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
                <User className="h-3.5 w-3.5" /> My Account
              </p>
              <Link
                href="/account/orders"
                onClick={close}
                className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-primary transition-colors"
              >
                My Orders
              </Link>
              <Link
                href="/account/profile"
                onClick={close}
                className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-primary transition-colors"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => { close(); onSignOut() }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-zinc-400 hover:bg-white/5 hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 px-3 pt-1">
              <button
                type="button"
                onClick={() => { close(); onOpenAuth('login') }}
                className="w-full rounded-lg border border-white/15 py-2.5 text-sm font-semibold text-white hover:border-white/30 transition-colors"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { close(); onOpenAuth('register') }}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors"
              >
                Register
              </button>
            </div>
          )}
        </nav>
      </aside>
    </>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:text-primary transition-colors xl:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && createPortal(drawer, document.body)}
    </>
  )
}
