'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, CheckCircle, LogIn, UserPlus } from 'lucide-react'
import { useCartStore } from '@/stores/cart.store'
import { createClient } from '@/lib/supabase/client'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Address {
  line1:    string
  line2:    string
  suburb:   string
  state:    string
  postcode: string
}

interface CustomerInfo {
  email:      string
  first_name: string
  last_name:  string
  phone:      string
}

// ── Step bar ──────────────────────────────────────────────────────────────────

const STEPS = ['Shipping', 'Payment', 'Confirmation']

function StepBar({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
            i < current   ? 'bg-primary border-primary text-zinc-900'
            : i === current ? 'border-primary text-primary bg-white'
            : 'border-zinc-300 text-zinc-400 bg-white'
          }`}>
            {i < current ? <CheckCircle className="w-4 h-4" /> : i + 1}
          </div>
          <span className={`text-sm font-medium hidden sm:block ${i === current ? 'text-zinc-900' : 'text-zinc-400'}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />}
        </li>
      ))}
    </ol>
  )
}

// ── Guest login banner ────────────────────────────────────────────────────────

function GuestLoginBanner() {
  const [isGuest, setIsGuest] = useState<boolean | null>(null)

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setIsGuest(!session))
  }, [])

  if (isGuest === null || !isGuest) return null

  return (
    <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-zinc-800">Have an account? Sign in for faster checkout</p>
        <p className="text-xs text-zinc-500 mt-0.5">Your saved address and order history will be available.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/login?redirect=${encodeURIComponent('/checkout')}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <LogIn className="w-3.5 h-3.5" />
          Sign in
        </Link>
        <Link
          href={`/register?redirect=${encodeURIComponent('/checkout')}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Create account
        </Link>
      </div>
    </div>
  )
}

// ── Step 0: Shipping Address ──────────────────────────────────────────────────

function AddressStep({ onNext }: { onNext: (addr: Address, customer: CustomerInfo) => void }) {
  const [addr, setAddr] = useState<Address>({ line1: '', line2: '', suburb: '', state: '', postcode: '' })
  const [cust, setCust] = useState<CustomerInfo>({ email: '', first_name: '', last_name: '', phone: '' })

  // Pre-fill from logged-in user profile
  useEffect(() => {
    async function prefill() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const user = session.user
      // Fill email from auth
      setCust(c => ({
        ...c,
        email:      c.email      || (user.email ?? ''),
        first_name: c.first_name || (user.user_metadata?.first_name ?? ''),
        last_name:  c.last_name  || (user.user_metadata?.last_name  ?? ''),
        phone:      c.phone      || (user.user_metadata?.phone       ?? ''),
      }))
      // Try fetching saved address from customer profile
      try {
        const res = await fetch(`${API}/api/account/profile`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const profile = await res.json()
          if (profile.phone)            setCust(c => ({ ...c, phone:      c.phone      || profile.phone }))
          if (profile.default_address) {
            const a = profile.default_address
            setAddr(prev => ({
              line1:    prev.line1    || a.line1    || '',
              line2:    prev.line2    || a.line2    || '',
              suburb:   prev.suburb   || a.suburb   || '',
              state:    prev.state    || a.state    || '',
              postcode: prev.postcode || a.postcode || '',
            }))
          }
        }
      } catch { /* profile fetch is best-effort */ }
    }
    prefill()
  }, [])

  const valid =
    addr.line1 && addr.suburb && addr.state && addr.postcode &&
    cust.email && cust.first_name && cust.last_name && cust.phone

  function addrField(key: keyof Address) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddr(f => ({ ...f, [key]: e.target.value }))
  }
  function custField(key: keyof CustomerInfo) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setCust(f => ({ ...f, [key]: e.target.value }))
  }

  return (
    <div className="space-y-5">
      <GuestLoginBanner />
      <h2 className="text-lg font-semibold text-zinc-900">Contact &amp; shipping</h2>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">First name *</label>
            <input value={cust.first_name} onChange={custField('first_name')} placeholder="Jane"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Last name *</label>
            <input value={cust.last_name} onChange={custField('last_name')} placeholder="Smith"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email *</label>
          <input type="email" value={cust.email} onChange={custField('email')} placeholder="jane@example.com"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Phone number *</label>
          <input type="tel" value={cust.phone} onChange={custField('phone')} placeholder="04XX XXX XXX"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Address line 1 *</label>
          <input value={addr.line1} onChange={addrField('line1')} placeholder="123 Main St"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Address line 2</label>
          <input value={addr.line2} onChange={addrField('line2')} placeholder="Unit / Apartment (optional)"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Suburb *</label>
            <input value={addr.suburb} onChange={addrField('suburb')} placeholder="Suburb"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Postcode *</label>
            <input value={addr.postcode} onChange={addrField('postcode')} placeholder="4000" maxLength={4}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">State *</label>
          <select value={addr.state} onChange={addrField('state')}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white">
            <option value="">Select state</option>
            {['QLD','NSW','VIC','SA','WA','TAS','NT','ACT'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onNext(addr, cust)}
        disabled={!valid}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continue to Payment
      </button>
    </div>
  )
}

// ── Step 1: Payment ───────────────────────────────────────────────────────────

function PaymentForm({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    setLoading(false)
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-zinc-400 hover:text-zinc-700">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-zinc-900">Payment</h2>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Test Mode</span>
        <span className="text-xs text-amber-600">— Stripe is disabled. Clicking Place Order will create a real order record.</span>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? 'Processing…' : 'Place Order (Test)'}
      </button>
    </form>
  )
}

// ── Step 3: Confirmation ──────────────────────────────────────────────────────

function GuestAccountCTA({ email }: { email: string }) {
  const [isGuest, setIsGuest] = useState<boolean | null>(null)
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setIsGuest(!session))
  }, [])
  if (!isGuest) return null
  return (
    <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center space-y-2 max-w-xs">
      <p className="text-sm font-medium text-zinc-800">Track future orders easily</p>
      <p className="text-xs text-zinc-500">Create an account with <strong>{email}</strong> to view your order history anytime.</p>
      <Link
        href={`/register?email=${encodeURIComponent(email)}`}
        className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-primary/90 transition-colors"
      >
        Create free account
      </Link>
    </div>
  )
}

function ConfirmationStep({ orderRef, customerEmail }: { orderRef: string; customerEmail: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center text-center space-y-4 py-8">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900">Order confirmed!</h2>
      <p className="text-sm text-zinc-500">
        Reference: <span className="font-mono font-semibold text-zinc-800">{orderRef}</span>
      </p>
      <p className="text-sm text-zinc-500 max-w-xs">
        You&apos;ll receive a confirmation email shortly.
      </p>
      <GuestAccountCTA email={customerEmail} />
      <button
        type="button"
        onClick={() => router.push('/tyres')}
        className="mt-4 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors"
      >
        Continue Shopping
      </button>
    </div>
  )
}

// ── Main checkout ─────────────────────────────────────────────────────────────

function CheckoutInner() {
  const { items, qty, subtotal, clearCart } = useCartStore()
  const router = useRouter()

  const [step,           setStep]           = useState(0)
  const [address,        setAddress]        = useState<Address | null>(null)
  const [customer,       setCustomer]       = useState<CustomerInfo | null>(null)
  const [clientSecret,   setClientSecret]   = useState<string | null>(null)
  const [confirmedTotal, setConfirmedTotal] = useState<number>(0)
  const [orderRef,       setOrderRef]       = useState('')
  const [orderError,     setOrderError]     = useState<string | null>(null)
  const [mounted,        setMounted]        = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (items.length === 0 && step !== 2) router.push('/tyres')
  }, [items.length, step, router])

  async function handleAddressNext(addr: Address, cust: CustomerInfo) {
    setAddress(addr)
    setCustomer(cust)
    setOrderError(null)
    setConfirmedTotal(subtotal())
    setClientSecret('test_mode')
    setStep(1)
  }

  async function handlePaymentSuccess() {
    if (!customer || !address) return
    setOrderError(null)

    try {
      const { data: { session } } = await createClient().auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

      const res = await fetch(`${API}/api/orders`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({
          customer,
          items: items.map(item => ({
            product_id: item.id,
            quantity:   qty[item.id] ?? 1,
            unit_price: item.price,
          })),
          shipping_address:         address,
          stripe_payment_intent_id: null,
          total_amount:             confirmedTotal > 0 ? confirmedTotal : subtotal(),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setOrderError((body as { error?: string }).error ?? 'Failed to record order. Please contact support.')
        return
      }

      const data = await res.json() as { order_number?: string }
      setOrderRef(data.order_number ?? 'N/A')
      clearCart()
      setStep(2)
    } catch {
      setOrderError('Network error. Please contact support with your payment reference.')
    }
  }

  const orderLines = items.map(item => ({
    name:  item.name,
    size:  item.size,
    qty:   qty[item.id] ?? 0,
    price: item.price,
  }))

  const displayTotal = confirmedTotal > 0 ? confirmedTotal : subtotal()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Checkout</h1>
      <StepBar current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Steps */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-6">
          {step === 0 && <AddressStep onNext={handleAddressNext} />}

          {step === 1 && clientSecret && (
            <PaymentForm onSuccess={handlePaymentSuccess} onBack={() => setStep(0)} />
          )}
          {step === 1 && orderError && (
            <p className="mt-3 text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-4 py-2">{orderError}</p>
          )}

          {step === 2 && <ConfirmationStep orderRef={orderRef} customerEmail={customer?.email ?? ''} />}
        </div>

        {/* Order summary */}
        {step < 2 && (
          <aside className="bg-white rounded-2xl border border-zinc-200 p-5 h-fit space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">Order summary</h3>
            <ul className="space-y-3">
              {orderLines.map((line, i) => (
                <li key={i} className="flex justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-800 truncate">{line.name}</p>
                    <p className="text-zinc-500 text-xs">{line.size} × {line.qty}</p>
                  </div>
                  <span className="font-semibold text-zinc-900 shrink-0" suppressHydrationWarning>
                    {mounted ? (line.price > 0 ? `$${(line.price * line.qty).toFixed(2)}` : 'POA') : '—'}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-zinc-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-base font-bold text-zinc-900 pt-1">
                <span>Total</span>
                <span suppressHydrationWarning>A${mounted ? displayTotal.toFixed(2) : '0.00'}</span>
              </div>
              <p className="text-xs text-zinc-400">Prices include GST · Shipping calculated separately</p>
            </div>

            {address && (
              <div className="text-xs text-zinc-500 border-t border-zinc-100 pt-3 space-y-0.5">
                <p className="font-semibold text-zinc-700">Delivering to</p>
                <p>{address.line1}{address.line2 ? `, ${address.line2}` : ''}</p>
                <p>{address.suburb} {address.state} {address.postcode}</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return <CheckoutInner />
}
