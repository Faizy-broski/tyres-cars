import type { Metadata } from 'next'
import { Montserrat, Geist_Mono, Oswald, Raleway } from 'next/font/google'
import './globals.css'
import { cn } from "@/lib/utils"

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  weight: ['400', '600', '700'],
  display: 'swap',
})

const raleway = Raleway({
  subsets: ['latin'],
  variable: '--font-raleway',
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Tyre Vault',
    template: '%s | Tyre Vault',
  },
  description: 'Premium tyres and autoparts — shop, compare, and book fitting online.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", montserrat.variable, oswald.variable, raleway.variable, geistMono.variable)}>
      <body suppressHydrationWarning className="antialiased">
        {children}
      </body>
    </html>
  )
}

