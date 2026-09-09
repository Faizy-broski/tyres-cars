import Link from 'next/link'

export default function StorefrontFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-white mt-16">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-zinc-800" />
              </div>
              <span className="font-bold text-zinc-900 text-sm">TYRES & CAR VALETING</span>
            </div>
            <p className="text-xs text-zinc-500">Premium tyres and autoparts — shop, compare, and book fitting online.</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            <Link href="/tyres"   className="hover:text-zinc-800">Shop Tyres</Link>
            <Link href="/account" className="hover:text-zinc-800">My Account</Link>
            <Link
              href="/fitter/onboarding"
              className="rounded-full bg-primary px-4 py-1.5 font-semibold text-zinc-900 hover:brightness-95"
            >
              Become a Fitter
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-xs text-zinc-400">© {new Date().getFullYear()} Tyres & Car Valeting. All rights reserved.</p>
      </div>
    </footer>
  )
}
