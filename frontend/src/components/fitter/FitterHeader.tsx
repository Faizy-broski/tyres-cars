'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronDown, Wrench, X } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import FitterMobileMenu from '@/components/fitter/FitterMobileMenu'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useFitterProfile } from '@/lib/query/fitter-hooks'
import type { FitmentCentre } from '@/types/fitter.types'

interface Notification {
  notification_id: string
  type:            string
  title:           string
  body:            string | null
  metadata:        Record<string, string>
  is_read:         boolean
  created_at:      string
}

interface Props {
  centre:    FitmentCentre
  userEmail: string
}

export default function FitterHeader({ centre, userEmail }: Props) {
  const router      = useRouter()
  const initials    = userEmail.slice(0, 2).toUpperCase()
  const displayName = userEmail.split('@')[0].split('.').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

  // Live logo: updates immediately after upload without a page refresh
  const { data: profile } = useFitterProfile()
  const logoUrl = profile?.logo_url ?? centre.logo_url

  const [notifs,   setNotifs]   = useState<Notification[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifs.filter(n => !n.is_read).length

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const { data } = await supabase
        .from('notifications')
        .select('notification_id, type, title, body, metadata, is_read, created_at')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (!cancelled && data) setNotifs(data as Notification[])
      if (cancelled) return

      channel = supabase
        .channel(`fitter-notifs:${user.id}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as Notification
            setNotifs(prev => [n, ...prev].slice(0, 20))
            toast(n.title, {
              description: n.body ?? undefined,
              duration:    8000,
              action: {
                label:   'View jobs',
                onClick: () => router.push('/fitter/jobs'),
              },
            })
          }
        )
        .subscribe()
    }

    init()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBellOpen = useCallback(async () => {
    setBellOpen(v => !v)
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

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSignOut() {
    await createClient().auth.signOut()
    router.push('/')
  }

  return (
    <header className="h-14 bg-white border-b border-zinc-200 shadow-sm flex items-center gap-3 px-4 sm:px-6 shrink-0">
      <FitterMobileMenu />

      {/* Centre info */}
      <div className="flex-1 min-w-0 flex items-center gap-2.5">
        <span className="relative hidden sm:flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900 truncate leading-tight">{centre.business_name}</p>
          <p className="text-xs text-zinc-400 hidden sm:block leading-tight">Partner ID: {centre.partner_id}</p>
        </div>
      </div>

      {/* Right: bell + avatar */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Live notification bell */}
        <div ref={bellRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBellOpen}
            className="relative rounded-full text-zinc-500 hover:!bg-zinc-100 hover:text-zinc-900 h-8 w-8 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <>
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-zinc-900 ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary animate-ping opacity-40" />
              </>
            )}
          </Button>

          {bellOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-zinc-200 bg-white shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
                <p className="text-xs font-semibold text-zinc-700">Notifications</p>
                <button type="button" onClick={() => setBellOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {notifs.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-400">No notifications yet</div>
              ) : (
                <ul className="max-h-64 overflow-y-auto divide-y divide-zinc-50">
                  {notifs.map(n => {
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
                          href="/fitter/jobs"
                          onClick={() => setBellOpen(false)}
                          className={`flex gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                        >
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100">
                            <Wrench className="w-3.5 h-3.5 text-zinc-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-zinc-900' : 'text-zinc-700'}`}>{n.title}</p>
                            {n.body && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{n.body}</p>}
                            <p className="text-[10px] text-zinc-400 mt-0.5">{age}</p>
                          </div>
                          {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="border-t border-zinc-100 px-4 py-2">
                <Link href="/fitter/jobs" onClick={() => setBellOpen(false)}
                  className="text-[11px] text-primary hover:underline font-medium">
                  View all jobs →
                </Link>
              </div>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 h-auto hover:bg-zinc-50 transition-colors group"
            >
              <div className="w-7 h-7 rounded-full bg-primary overflow-hidden shrink-0 group-hover:ring-2 group-hover:ring-primary/30 transition-all relative">
                {logoUrl ? (
                  <Image src={logoUrl} alt={centre.business_name} fill className="object-cover" unoptimized />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-xs font-bold text-zinc-900">{initials}</span>
                )}
              </div>
              <span className="text-sm font-medium text-zinc-700 hidden sm:block">{displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 hidden sm:block transition-transform group-data-[state=open]:rotate-180 duration-200" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48 shadow-lg">
            <div className="px-3 py-2 border-b border-zinc-100">
              <p className="text-xs font-semibold text-zinc-900 truncate">{displayName}</p>
              <p className="text-[11px] text-zinc-400 truncate mt-0.5">{userEmail}</p>
            </div>
            <DropdownMenuItem asChild>
              <a href="/fitter/profile" className="cursor-pointer">Profile &amp; Settings</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/fitter/support" className="cursor-pointer">Support</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
              onSelect={handleSignOut}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

