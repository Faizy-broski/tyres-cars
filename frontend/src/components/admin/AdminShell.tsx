'use client'

import { useState, useEffect } from 'react'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import { Toaster } from '@/components/ui/sonner'
import { ReactQueryProvider } from '@/lib/query/client'
import NavigationProgress from '@/components/NavigationProgress'

interface Props {
  userEmail: string
  children: React.ReactNode
}

const COLLAPSE_KEY = 'admin-sidebar-collapsed'

export default function AdminShell({ userEmail, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Restore the desktop collapse preference (rail vs full width) once on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY)
    if (stored === '1') setSidebarCollapsed(true)
  }, [])

  function toggleSidebarCollapsed() {
    setSidebarCollapsed(prev => {
      const next = !prev
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }

  // Prevent the browser's native body scrollbar while admin layout is active.
  // The only scroll that should exist is on <main>.
  useEffect(() => {
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <ReactQueryProvider>
    <div className="flex h-screen bg-zinc-100 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AdminSidebar
        userEmail={userEmail}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <AdminHeader
          userEmail={userEmail}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <NavigationProgress />
      <Toaster
        position="top-right"
        richColors
        closeButton
        expand={false}
        visibleToasts={4}
        toastOptions={{
          duration: 4000,
          classNames: {
            toast:       'font-medium text-sm shadow-lg rounded-xl border',
            success:     'border-green-200 bg-green-50 text-green-900',
            error:       'border-red-200 bg-red-50 text-red-900',
            loading:     'border-zinc-200 bg-white text-zinc-800',
            description: 'text-xs opacity-75 mt-0.5',
          },
        }}
      />
    </div>
    </ReactQueryProvider>
  )
}

