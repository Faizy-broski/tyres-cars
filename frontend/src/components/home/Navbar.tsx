"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart.store";
import { ECOMMERCE_ENABLED } from "@/lib/features";
import { createClient } from "@/lib/supabase/client";
import type { Session } from "@supabase/supabase-js";
import TyresDropdown from "./TyresDropdown";
import AuthModal from "@/components/storefront/account/AuthModal";
import GlobalSearchBar from "./GlobalSearchBar";
import MobileMenu from "./MobileMenu";

const navLinks = [
  { label: "Services", href: "/services" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar({ topbarScrolled }: { topbarScrolled: boolean }) {
  const { openCart, itemCount } = useCartStore();

  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tyresOpen, setTyresOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "register">("login");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const tyresRef = useRef<HTMLDivElement>(null);

  const openAuthModal = (tab: "login" | "register") => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  useEffect(() => {
    setMounted(true);
    createClient().auth.getSession().then(({ data: { session: s } }) => setSession(s));
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (tyresRef.current && !tyresRef.current.contains(e.target as Node)) {
        setTyresOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const count = mounted ? itemCount() : 0;

  async function handleSignOut() {
    await createClient().auth.signOut();
    setSession(null);
    window.location.href = '/';
  }

  return (
    <header
      className={`fixed left-0 right-0 z-50 w-full text-white transition-[top] duration-300 ${topbarScrolled ? "top-0" : "top-10"}`}
    >
      <div className="border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-5 xl:gap-8">
            <MobileMenu session={session} onSignOut={handleSignOut} onOpenAuth={openAuthModal} />
            <nav className="hidden items-center gap-6 xl:flex">
              {/* Shop Tyres — mega dropdown (e-commerce only) */}
              {ECOMMERCE_ENABLED && (
              <div ref={tyresRef} className="relative">
                <button
                  type="button"
                  onClick={() => setTyresOpen(o => !o)}
                  className={`flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold uppercase tracking-wide transition-colors duration-200 ${tyresOpen ? 'text-primary' : 'text-white hover:text-primary'}`}
                >
                  Shop Tyres
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${tyresOpen ? 'rotate-180 text-primary' : ''}`} />
                </button>
                {tyresOpen && <TyresDropdown onClose={() => setTyresOpen(false)} />}
              </div>
              )}

              {navLinks.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="whitespace-nowrap text-sm font-semibold uppercase tracking-wide text-white transition-colors duration-200 hover:text-primary"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <Link href="/" className="absolute left-1/2 hidden -translate-x-1/2 xl:block">
            <Image src="/logo.svg" width={110} height={94} alt="Tyres & Car Valeting" className="h-12 w-auto" />
          </Link>
          <Link href="/" className="xl:hidden">
            <Image src="/logo.svg" width={110} height={94} alt="Tyres & Car Valeting" className="h-10 w-auto" />
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 xl:flex">
              {!ECOMMERCE_ENABLED ? (
                <Link
                  href="/book"
                  className="mr-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-900 hover:bg-primary/90 transition-colors"
                >
                  Book Now
                </Link>
              ) : <>
              {/* Auth-aware user area */}
              {!mounted ? (
                // Fixed-size placeholder prevents layout shift during hydration
                <div className="w-[120px] h-8" />
              ) : session ? (
                // Logged-in: My Account dropdown
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(v => !v)}
                    aria-label="My Account"
                    aria-expanded={dropdownOpen}
                    className="flex items-center gap-1.5 text-white hover:text-primary transition-colors px-1 py-1"
                  >
                    <User className="h-5 w-5" />
                    <ChevronDown className={`h-3 w-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md shadow-xl py-1 z-50">
                      <Link
                        href="/account/orders"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:text-primary transition-colors"
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/account/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:text-primary transition-colors"
                      >
                        Profile
                      </Link>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-zinc-400 hover:text-red-400 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                // Guest: Sign in + Register
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => openAuthModal("login")}
                    className="text-sm font-medium text-white hover:text-primary transition-colors"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal("register")}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-primary/90 transition-colors"
                  >
                    Register
                  </button>
                </div>
              )}

              <div className="h-5 w-px bg-white/20 mx-1" />
              <button
                type="button"
                onClick={openCart}
                aria-label="Open cart"
                className="relative flex items-center justify-center h-10 w-10 rounded-lg text-white hover:text-primary transition-colors"
              >
                <ShoppingCart className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-zinc-900 px-1">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
              </>}
            </div>
            {/* Tyre search (e-commerce only) */}
            {ECOMMERCE_ENABLED && (
            <div className="relative hidden xl:block">
              <GlobalSearchBar />
            </div>
            )}
            {/* Mobile/tablet cart */}
            {ECOMMERCE_ENABLED && <button
              type="button"
              onClick={openCart}
              aria-label="Open cart"
              className="relative flex items-center justify-center h-10 w-10 rounded-lg text-white hover:text-primary transition-colors xl:hidden"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-zinc-900 px-1">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>}
            {ECOMMERCE_ENABLED ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Search"
              onClick={() => setMobileSearchOpen(o => !o)}
              className={`hover:bg-transparent hover:text-primary xl:hidden ${mobileSearchOpen ? "text-primary" : "text-white"}`}
            >
              <Search className="h-5 w-5" />
            </Button>
            ) : (
              <Link
                href="/book"
                className="whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-900 hover:bg-primary/90 transition-colors xl:hidden"
              >
                Book Now
              </Link>
            )}
          </div>
        </div>
        {ECOMMERCE_ENABLED && mobileSearchOpen && (
          <div className="border-t border-white/10 px-4 py-3 xl:hidden">
            <GlobalSearchBar fullWidth autoFocus />
          </div>
        )}
      </div>
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
        defaultTab={authModalTab} 
      />
    </header>
  );
}
