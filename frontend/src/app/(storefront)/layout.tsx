import type { ReactNode } from 'react'
import StorefrontShell from '@/components/storefront/StorefrontShell'
import FooterSection from '@/components/home/FooterWrapper'
import CartDrawer from '@/components/storefront/CartDrawer'
import { Toaster } from '@/components/ui/sonner'
import { ReactQueryProvider } from '@/lib/query/client'

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StorefrontShell />
      <main className="min-h-screen bg-zinc-50 pt-[104px]">
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </main>
      <FooterSection />
      <CartDrawer />
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          style: { width: '420px', maxWidth: 'calc(100vw - 2rem)' },
          classNames: {
            toast:       'font-semibold text-base shadow-2xl rounded-2xl border px-5 py-4 gap-3',
            title:       'text-base',
            description: 'text-sm opacity-80 mt-1',
            success:     'border-green-200 bg-green-50 text-green-900',
            error:       'border-red-200 bg-red-50 text-red-900',
          },
        }}
      />
    </>
  )
}

