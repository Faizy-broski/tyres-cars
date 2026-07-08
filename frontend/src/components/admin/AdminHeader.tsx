'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell, ChevronDown, Menu, Search, Settings, X,
  Gauge, ClipboardList, LayoutDashboard, Truck, Archive,
  Users, Tag, CircleDollarSign, ShoppingCart, PackageOpen,
  CircleDot, Car, Ship, Wrench, Package, Wrench as WrenchIcon,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'

// ── All navigable admin pages ─────────────────────────────────────────────────

interface NavPage {
  label:    string
  href:     string
  icon:     LucideIcon
  keywords: string[]   // extra terms to match on
}

const ALL_PAGES: NavPage[] = [
  { label: 'Dashboard',              href: '/admin/dashboard',                    icon: Gauge,            keywords: ['home', 'overview', 'stats', 'kpi'] },
  { label: 'Orders',                 href: '/admin/orders',                       icon: ClipboardList,    keywords: ['sales', 'purchase', 'invoice'] },
  { label: 'Products',               href: '/admin/products',                     icon: LayoutDashboard,  keywords: ['skus', 'tyres', 'catalogue'] },
  { label: 'Brands',                 href: '/admin/products/brands',              icon: LayoutDashboard,  keywords: ['brand', 'manufacturer'] },
  { label: 'Patterns',               href: '/admin/products/patterns',            icon: LayoutDashboard,  keywords: ['tread', 'model', 'pattern'] },
  // { label: 'Collections',            href: '/admin/products/collections',         icon: LayoutDashboard,  keywords: ['group', 'set'] },
  { label: 'Categories',             href: '/admin/products/categories',          icon: LayoutDashboard,  keywords: ['tags', 'type'] },
  { label: 'Warehouses',             href: '/admin/warehouses',                   icon: Archive,          keywords: ['storage', 'location', 'stock'] },
  { label: 'Suppliers',              href: '/admin/suppliers',                    icon: Truck,            keywords: ['vendor', 'wholesaler'] },
  { label: 'Inventory',              href: '/admin/inventory',                    icon: Archive,          keywords: ['stock', 'mapping', 'supplier map'] },
  { label: 'Customers',              href: '/admin/customers',                    icon: Users,            keywords: ['buyer', 'client', 'accounts'] },
  { label: 'Customer Groups',        href: '/admin/customers/groups',             icon: Users,            keywords: ['segment', 'tier', 'group'] },
  { label: 'Promotions',             href: '/admin/promotions',                   icon: Tag,              keywords: ['discount', 'coupon', 'deal', 'sale'] },
  { label: 'Price Lists',            href: '/admin/pricing',                      icon: CircleDollarSign, keywords: ['pricing', 'rate', 'wholesale'] },
  { label: 'Purchase Orders',        href: '/admin/purchase-orders',              icon: ShoppingCart,     keywords: ['po', 'restock', 'procurement'] },
  { label: 'Shipments',              href: '/admin/shipments',                    icon: PackageOpen,      keywords: ['delivery', 'shipping', 'dispatch'] },
  { label: 'Wheels',                 href: '/admin/wheels',                       icon: CircleDot,        keywords: ['rim', 'alloy'] },
  { label: 'Wheel Brands',           href: '/admin/wheels/brands',               icon: CircleDot,        keywords: ['rim brand', 'alloy brand'] },
  { label: 'Vehicles',               href: '/admin/vehicles',                     icon: Car,              keywords: ['car', 'make', 'model', 'fitment'] },
  { label: 'Shipping Methods',       href: '/admin/shipping-methods',            icon: Ship,             keywords: ['courier', 'freight', 'delivery method'] },
  { label: 'Fitment Centres',        href: '/admin/fitters/centres',             icon: Wrench,           keywords: ['fitter', 'fitment', 'garage', 'workshop'] },
  { label: 'Fitter Applications',    href: '/admin/fitters/applications',        icon: Wrench,           keywords: ['fitter application', 'approval', 'onboard'] },
  { label: 'New Product',            href: '/admin/products/new',                icon: LayoutDashboard,  keywords: ['add product', 'create product'] },
  { label: 'New Brand',              href: '/admin/products/brands/new',         icon: LayoutDashboard,  keywords: ['add brand'] },
  { label: 'New Pattern',            href: '/admin/products/patterns/new',       icon: LayoutDashboard,  keywords: ['add pattern'] },
  { label: 'New Purchase Order',     href: '/admin/purchase-orders/new',         icon: ShoppingCart,     keywords: ['create po', 'add po'] },
  { label: 'New Shipment',           href: '/admin/shipments/new',               icon: PackageOpen,      keywords: ['create shipment'] },
]

function matchPage(page: NavPage, q: string): boolean {
  const s = q.toLowerCase()
  return (
    page.label.toLowerCase().includes(s) ||
    page.href.toLowerCase().includes(s)  ||
    page.keywords.some(k => k.includes(s))
  )
}

// ── Highlight match ───────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/40 text-zinc-900 rounded-sm not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ── Notification types ────────────────────────────────────────────────────────

interface Notification {
  notification_id: string
  type:            string
  title:           string
  body:            string | null
  metadata:        Record<string, string>
  is_read:         boolean
  created_at:      string
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userEmail:     string
  onMenuToggle?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminHeader({ userEmail, onMenuToggle }: Props) {
  const router      = useRouter()
  const initials    = userEmail.slice(0, 2).toUpperCase()
  const displayName = userEmail.split('@')[0].split('.').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

  const [query,         setQuery]         = useState('')
  const [open,          setOpen]          = useState(false)
  const [focused,       setFocused]       = useState(0)
  const [notifs,        setNotifs]        = useState<Notification[]>([])
  const [bellOpen,      setBellOpen]      = useState(false)

  const inputRef  = useRef<HTMLInputElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)
  const bellRef   = useRef<HTMLDivElement>(null)

  const unreadCount = notifs.filter(n => !n.is_read).length

  // ── Load initial notifications + subscribe to new ones ─────────────────────
  useEffect(() => {
    const supabase = createClient()
    let userId: string | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      userId = user.id

      // Fetch latest 20 notifications
      const { data } = await supabase
        .from('notifications')
        .select('notification_id, type, title, body, metadata, is_read, created_at')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifs(data as Notification[])

      // Subscribe to new inserts
      supabase
        .channel(`admin-notifs:${userId}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'notifications',
            filter: `recipient_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new as Notification
            setNotifs(prev => [n, ...prev].slice(0, 20))
            // Toast with link to the relevant page
            const href = n.metadata?.order_id
              ? `/admin/orders/${n.metadata.order_id}`
              : n.metadata?.job_id
              ? `/admin/fitters`
              : '/admin/orders'
            toast(n.title, {
              description: n.body ?? undefined,
              duration:    6000,
              action: {
                label:   'View',
                onClick: () => router.push(href),
              },
            })
          }
        )
        .subscribe()
    }

    init()
    return () => { supabase.removeAllChannels() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }, [unreadCount])

  const handleBellOpen = useCallback(async () => {
    setBellOpen(v => !v)
    await markAllRead()
  }, [markAllRead])

  // Click-outside closes bell dropdown
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const matches = query.trim().length >= 1
    ? ALL_PAGES.filter(p => matchPage(p, query.trim())).slice(0, 8)
    : []

  // Click-outside → close
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Global shortcut: Ctrl+K / Cmd+K opens search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function close() { setOpen(false); setQuery(''); setFocused(0) }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setFocused(0)
    setOpen(true)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) {
      if (e.key === 'Escape') { close(); return }
      return
    }
    if (e.key === 'Escape')    { close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, matches.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const page = matches[focused]
      if (page) { router.push(page.href); close() }
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <header className="h-14 bg-white border-b-2 border-primary/20 flex items-center gap-3 px-4 sm:px-6 shrink-0 shadow-sm">
      {/* Mobile hamburger */}
      <button type="button" onClick={onMenuToggle}
        className="lg:hidden p-2 -ml-1 rounded-lg text-zinc-600 hover:!bg-zinc-100 transition-colors" aria-label="Open menu">
        <Menu className="w-5 h-5" />
      </button>

      {/* ── Global page search ─────────────────────────────────────────────── */}
      <div ref={dropRef} className="flex-1 max-w-sm relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder="Search pages… (Ctrl+K)"
          className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 focus:bg-white transition-all"
        />
        {query && (
          <button type="button" onClick={close}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Dropdown */}
        {open && query.trim().length >= 1 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden">
            {matches.length === 0 ? (
              <div className="px-4 py-5 text-center">
                <p className="text-xs text-zinc-400">No pages match <strong className="text-zinc-600">&ldquo;{query}&rdquo;</strong></p>
              </div>
            ) : (
              <ul className="py-1.5">
                {matches.map((page, i) => {
                  const Icon = page.icon
                  const isFocused = focused === i
                  return (
                    <li key={page.href}>
                      <button
                        type="button"
                        onMouseEnter={() => setFocused(i)}
                        onClick={() => { router.push(page.href); close() }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isFocused ? 'bg-primary/10' : 'hover:bg-zinc-50'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isFocused ? 'bg-primary text-zinc-900' : 'bg-zinc-100 text-zinc-500'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold truncate ${isFocused ? 'text-zinc-900' : 'text-zinc-700'}`}>
                            <Highlight text={page.label} query={query} />
                          </p>
                          <p className="text-[10px] text-zinc-400 truncate font-mono">{page.href}</p>
                        </div>
                        {isFocused && (
                          <kbd className="shrink-0 text-[9px] font-mono bg-zinc-100 text-zinc-500 rounded px-1.5 py-0.5 border border-zinc-200">
                            ↵
                          </kbd>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="border-t border-zinc-100 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">
                {matches.length} page{matches.length !== 1 ? 's' : ''} found
              </span>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span><kbd className="font-mono bg-zinc-100 rounded px-1 py-0.5 border border-zinc-200">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono bg-zinc-100 rounded px-1 py-0.5 border border-zinc-200">↵</kbd> go</span>
                <span><kbd className="font-mono bg-zinc-100 rounded px-1 py-0.5 border border-zinc-200">Esc</kbd> close</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right side ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 ml-auto">
        <button type="button"
          className="md:hidden p-2 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" aria-label="Search"
          onClick={() => inputRef.current?.focus()}>
          <Search className="w-[18px] h-[18px]" />
        </button>

        {/* ── Live notification bell ─────────────────────────────────── */}
        <div ref={bellRef} className="relative">
          <button
            type="button"
            onClick={handleBellOpen}
            className="relative p-2 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <>
                <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white px-1 ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 animate-ping opacity-40" />
              </>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-2xl border border-zinc-200 bg-white shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-500" />
                  <p className="text-sm font-bold text-zinc-800">Notifications</p>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-zinc-900 leading-none">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setBellOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {notifs.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Bell className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-zinc-400">No notifications yet</p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                  {notifs.map(n => {
                    const href = n.metadata?.order_id
                      ? `/admin/orders/${n.metadata.order_id}`
                      : '/admin/orders'
                    const age = (() => {
                      const diff = Date.now() - new Date(n.created_at).getTime()
                      const m = Math.floor(diff / 60_000)
                      if (m < 1)  return 'just now'
                      if (m < 60) return `${m}m ago`
                      const h = Math.floor(m / 60)
                      if (h < 24) return `${h}h ago`
                      return `${Math.floor(h / 24)}d ago`
                    })()
                    return (
                      <li key={n.notification_id}>
                        <Link
                          href={href}
                          onClick={() => setBellOpen(false)}
                          className={`flex gap-3.5 px-5 py-4 hover:bg-zinc-50 transition-colors ${!n.is_read ? 'bg-amber-50/50' : ''}`}
                        >
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${!n.is_read ? 'bg-amber-100' : 'bg-zinc-100'}`}>
                            {n.type === 'new_order'    ? <Package className={`w-4 h-4 ${!n.is_read ? 'text-amber-600' : 'text-zinc-500'}`} />
                           : n.type === 'job_assigned' ? <WrenchIcon className={`w-4 h-4 ${!n.is_read ? 'text-amber-600' : 'text-zinc-500'}`} />
                           : <Bell className={`w-4 h-4 ${!n.is_read ? 'text-amber-600' : 'text-zinc-500'}`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${!n.is_read ? 'text-zinc-900' : 'text-zinc-600'}`}>
                              {n.title}
                            </p>
                            {n.body && <p className="text-xs text-zinc-500 truncate mt-0.5">{n.body}</p>}
                            <p className="text-[11px] text-zinc-400 mt-1 font-medium">{age}</p>
                          </div>
                          {!n.is_read && (
                            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}

              {/* Footer */}
              <div className="border-t border-zinc-100 px-5 py-3 bg-zinc-50 flex items-center justify-between">
                <Link href="/admin/orders" onClick={() => setBellOpen(false)}
                  className="text-sm font-bold text-primary hover:underline">
                  View all jobs →
                </Link>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                    Mark all read
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <Link href="/admin/settings"
          className="p-2 rounded-lg text-violet-500 hover:bg-violet-50 transition-colors" aria-label="Settings">
          <Settings className="w-[18px] h-[18px]" />
        </Link>

        <div className="w-px h-6 bg-gradient-to-b from-primary/60 via-primary/30 to-transparent mx-2" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button"
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all group">
              <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 ring-2 ring-primary/30">
                {initials}
              </div>
              <span className="text-xs font-semibold text-zinc-800 hidden sm:block">{displayName}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 mt-1">
            <div className="px-3 py-2.5 border-b border-zinc-100">
              <p className="text-xs font-semibold text-zinc-800">{displayName}</p>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{userEmail}</p>
            </div>
            <div className="py-1">
              <DropdownMenuItem asChild>
                <Link href="/admin/profile" className="text-sm">Profile &amp; Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/support" className="text-sm">Support</Link>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer text-sm"
              onSelect={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
