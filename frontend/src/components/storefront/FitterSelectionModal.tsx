'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api'
import { X, MapPin, Car, Wrench, ChevronLeft, Check, AlertCircle } from 'lucide-react'
import { useCartStore, type FittingSelection } from '@/stores/cart.store'

const API    = process.env.NEXT_PUBLIC_API_URL     ?? 'http://localhost:3001'
const GMKEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

// ── Types ─────────────────────────────────────────────────────────────────────

interface Centre {
  fitment_centre_id:        string
  business_name:            string
  contact_phone:            string | null
  fitting_price:            number | null
  wheel_alignment_price:    number | null   // single price from fitment_centres
  mobile_fitting_available: boolean
  latitude:                 number | null
  longitude:                number | null
  distance_km:              number | null
  duration_min:             number | null
  addresses: {
    address_line1: string
    suburb:        string
    state:         string
    postcode:      string
  } | null
}

type AlignmentType = '2_wheel' | '4_wheel' | 'single'
type SortBy = 'distance' | 'price'

interface Props {
  open:          boolean
  onClose:       () => void
  tyreQty:       number
  cartSubtotal:  number
}

// ── Map config ────────────────────────────────────────────────────────────────

const MAP_CONTAINER = { width: '100%', height: '100%' }
const MAP_OPTIONS   = {
  disableDefaultUI:    true,
  zoomControl:         true,
  clickableIcons:      false,
  styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDist(km: number | null) {
  if (km === null) return null
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

function fmtDur(min: number | null) {
  if (min === null) return null
  return min < 60 ? `${min} min drive` : `${Math.floor(min / 60)}h ${min % 60}m drive`
}

function centreAddress(c: Centre) {
  if (!c.addresses) return ''
  const { suburb, state, postcode } = c.addresses
  return [suburb, state, postcode].filter(Boolean).join(', ')
}

// ── Step 1: How it works + postcode ──────────────────────────────────────────

function HowItWorksStep({
  onContinue,
}: {
  onContinue: (postcode: string) => void
}) {
  const [postcode, setPostcode] = useState('')
  const valid = /^\d{4}$/.test(postcode.trim())

  return (
    <div className="flex flex-col h-full">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
          <Car className="w-8 h-8 text-zinc-900" />
        </div>
      </div>

      <h2 className="font-oswald text-xl font-bold text-center text-zinc-900 uppercase tracking-wide mb-6">How it works</h2>

      <div className="space-y-0 mb-8">
        {[
          {
            icon: <MapPin className="w-5 h-5 text-zinc-600" />,
            title: 'Select a local fitting partner',
            desc:  'Prices start from the fitting partner\'s rate. Enter your postcode to see nearby fitters.',
          },
          {
            icon: <Wrench className="w-5 h-5 text-zinc-600" />,
            title: 'We will ship the tyre directly to the fitter',
            desc:  null,
          },
          {
            icon: (
              <svg className="w-5 h-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            ),
            title: 'The fitter will contact you to arrange fitting',
            desc:  'Quick delivery after your purchase',
          },
        ].map((step, i) => (
          <div key={i} className="flex gap-4 py-4 border-b border-zinc-100 last:border-0">
            <div className="w-9 h-9 rounded-full border-2 border-zinc-200 flex items-center justify-center shrink-0">
              {step.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
              {step.desc && <p className="text-xs text-zinc-500 mt-0.5">{step.desc}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <p className="text-sm font-semibold text-zinc-900 text-center mb-3">Find your nearest fitting partner</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Enter postcode"
            value={postcode}
            onChange={e => setPostcode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && valid && onContinue(postcode)}
            className="min-w-0 flex-1 rounded-lg border-2 border-zinc-300 focus:border-primary px-4 py-2.5 text-sm focus:outline-none"
          />
          <button
            type="button"
            disabled={!valid}
            onClick={() => onContinue(postcode)}
            className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: Fitting stations ──────────────────────────────────────────────────

function StationsStep({
  postcode,
  centres,
  origin,
  loading,
  fetchError,
  onSelect,
  onChangePostcode,
  onSkip,
}: {
  postcode:         string
  centres:          Centre[]
  origin:           { lat: number; lng: number } | null
  loading:          boolean
  fetchError:       string | null
  onSelect:         (c: Centre) => void
  onChangePostcode: () => void
  onSkip:           () => void
}) {
  const [sortBy,     setSortBy]     = useState<SortBy>('distance')
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const listRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const { isLoaded } = useLoadScript({ googleMapsApiKey: GMKEY })

  const sorted = [...centres].sort((a, b) => {
    if (sortBy === 'price') {
      return (a.fitting_price ?? Infinity) - (b.fitting_price ?? Infinity)
    }
    if (a.distance_km === null && b.distance_km === null) return 0
    if (a.distance_km === null) return 1
    if (b.distance_km === null) return -1
    return a.distance_km - b.distance_km
  })

  const firstCentreWithCoords = centres.find(c => c.latitude && c.longitude)
  const mapCenter = origin
    ?? (firstCentreWithCoords
      ? { lat: firstCentreWithCoords.latitude!, lng: firstCentreWithCoords.longitude! }
      : { lat: -33.8688, lng: 151.2093 })  // Sydney fallback

  function handleMarkerClick(id: string) {
    setHighlighted(id)
    listRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function handleMapLoad(map: google.maps.Map) {
    const coordCentres = centres.filter(c => c.latitude && c.longitude)
    if (coordCentres.length > 1 || (coordCentres.length >= 1 && origin)) {
      const bounds = new window.google.maps.LatLngBounds()
      if (origin) bounds.extend(origin)
      coordCentres.forEach(c => bounds.extend({ lat: c.latitude!, lng: c.longitude! }))
      map.fitBounds(bounds, 60)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-48 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="flex flex-col gap-4 flex-1 min-h-0 sm:flex-row">
          <div className="space-y-3 overflow-y-auto sm:w-1/2">
            {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-zinc-100 animate-pulse" />)}
          </div>
          <div className="h-40 rounded-xl bg-zinc-100 animate-pulse sm:h-auto sm:w-1/2" />
        </div>
      </div>
    )
  }

  // Network / API error
  if (!loading && fetchError) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center gap-5 py-8">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="font-semibold text-zinc-900">Something went wrong</p>
          <p className="text-sm text-zinc-500 mt-1 max-w-xs">
            We couldn&apos;t load fitting stations right now. Please try again.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={onChangePostcode}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-xl border border-zinc-300 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Skip fitting — Continue to checkout
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!loading && centres.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center gap-5 py-8">
        <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-zinc-400" />
        </div>
        <div>
          <p className="font-semibold text-zinc-900">No fitting partners near {postcode}</p>
          <p className="text-sm text-zinc-500 mt-1 max-w-xs">
            Sorry, we don&apos;t have any fitting partners in this area yet. Your tyres will be shipped directly to you.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <button
            type="button"
            onClick={onSkip}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors"
          >
            Skip fitting — Continue to checkout
          </button>
          <button
            type="button"
            onClick={onChangePostcode}
            className="w-full rounded-xl border border-zinc-300 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Try another postcode
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className="text-sm font-semibold text-zinc-900">
          Fitting stations in <span className="text-primary">{postcode}</span>
        </p>
        <button type="button" onClick={onChangePostcode}
          className="text-xs text-primary hover:underline">
          Change postcode
        </button>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-1 mb-3 shrink-0">
        {(['distance', 'price'] as SortBy[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSortBy(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              sortBy === s
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'border-zinc-300 text-zinc-600 hover:border-zinc-500'
            }`}
          >
            {s === 'distance' ? 'Distance (asc)' : 'Price (asc)'}
          </button>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col gap-4 flex-1 min-h-0 sm:flex-row sm:min-h-[320px]">
        {/* List */}
        <div className="overflow-y-auto space-y-2 pr-1 sm:w-[48%]">
          {sorted.map(c => (
            <button
              key={c.fitment_centre_id}
              ref={el => { listRefs.current[c.fitment_centre_id] = el }}
              type="button"
              onClick={() => onSelect(c)}
              className={`w-full text-left rounded-2xl border-2 p-3 transition-colors ${
                highlighted === c.fitment_centre_id
                  ? 'border-primary bg-primary/5'
                  : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 leading-tight">
                    {c.business_name}
                  </p>
                  {c.mobile_fitting_available && (
                    <span className="inline-block text-[10px] font-semibold text-primary bg-primary/10 rounded px-1 py-0.5 mb-0.5">
                      Mobile Fitter
                    </span>
                  )}
                  {c.addresses && !c.mobile_fitting_available && (
                    <p className="text-xs text-zinc-500 truncate">{centreAddress(c)}</p>
                  )}
                  {c.distance_km !== null && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {fmtDist(c.distance_km)}{c.duration_min ? ` · ${fmtDur(c.duration_min)}` : ''}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-zinc-500">Fitting Price:</p>
                  {c.fitting_price != null
                    ? <p className="text-sm font-bold text-zinc-900">${c.fitting_price.toFixed(2)}</p>
                    : <p className="text-xs text-zinc-400">POA</p>
                  }
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Map */}
        <div className="h-56 shrink-0 rounded-2xl overflow-hidden border border-zinc-200 sm:h-auto sm:flex-1 sm:min-h-[320px]">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER}
              center={mapCenter}
              zoom={10}
              options={MAP_OPTIONS}
              onLoad={handleMapLoad}
            >
              {/* Blue pin for searched postcode */}
              {origin && (
                <Marker
                  position={origin}
                  title="Your postcode"
                  icon={{ url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' }}
                />
              )}
              {/* Red pins for each fitting centre */}
              {centres.filter(c => c.latitude && c.longitude).map(c => (
                <Marker
                  key={c.fitment_centre_id}
                  position={{ lat: c.latitude!, lng: c.longitude! }}
                  onClick={() => handleMarkerClick(c.fitment_centre_id)}
                  title={c.business_name}
                />
              ))}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-zinc-100 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Station detail + pricing breakdown ────────────────────────────────

function StationDetailStep({
  centre,
  tyreQty,
  cartSubtotal,
  onSave,
  onBack,
}: {
  centre:       Centre
  tyreQty:      number
  cartSubtotal: number
  onSave:       (selection: FittingSelection) => void
  onBack:       () => void
}) {
  // Alignment: single price from fitment_centres.wheel_alignment_price
  const hasAny = centre.wheel_alignment_price != null

  type AlignOpt = { type: AlignmentType; label: string; price: number }
  const alignOptions: AlignOpt[] = hasAny
    ? [{ type: 'single', label: 'Wheel Alignment', price: centre.wheel_alignment_price! }]
    : []

  const [selectedAlignment, setSelectedAlignment] = useState<AlignmentType | null>(null)

  const fittingCost  = (centre.fitting_price ?? 0) * tyreQty
  const alignCost    = selectedAlignment
    ? (alignOptions.find(o => o.type === selectedAlignment)?.price ?? 0)
    : 0
  const displayTotal = cartSubtotal + fittingCost + alignCost

  function handleSave() {
    const alignOpt = alignOptions.find(o => o.type === selectedAlignment) ?? null
    onSave({
      centreId:            centre.fitment_centre_id,
      centreName:          centre.business_name,
      address:             centreAddress(centre),
      distanceKm:          centre.distance_km,
      durationMin:         centre.duration_min,
      isMobile:            centre.mobile_fitting_available,
      fittingPricePerTyre: centre.fitting_price ?? 0,
      totalFittingCost:    +(fittingCost + alignCost).toFixed(2),
      wheelAlignment:      alignOpt ? { type: alignOpt.type, price: alignOpt.price } : null,
      wheelAlignmentPrice: centre.wheel_alignment_price,
    })
  }

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 mb-4 self-start shrink-0">
        <ChevronLeft className="w-4 h-4" /> Show all
      </button>

      <p className="font-oswald text-lg font-bold text-zinc-900 uppercase tracking-wide mb-0.5">
        {centre.mobile_fitting_available ? 'Mobile Fitting Partner' : centre.business_name}
      </p>
      {centre.addresses && !centre.mobile_fitting_available && (
        <p className="text-xs text-zinc-500 mb-0.5">{centreAddress(centre)}</p>
      )}
      {centre.distance_km !== null && (
        <p className="text-xs text-zinc-400 mb-4">
          {fmtDist(centre.distance_km)}{centre.duration_min ? ` · ${fmtDur(centre.duration_min)}` : ''}
          {!centre.mobile_fitting_available && ' · Fitting Station'}
        </p>
      )}

      {/* Pricing details */}
      <div className="rounded-2xl border border-zinc-200 divide-y divide-zinc-100 mb-4">
        <div className="px-4 py-2.5 bg-zinc-50 rounded-t-2xl">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Pricing details</p>
        </div>

        {/* Tyres */}
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-zinc-700">{tyreQty}× Tyres</span>
          <span className="font-semibold text-zinc-900">${cartSubtotal.toFixed(2)}</span>
        </div>

        {/* Fitting */}
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-zinc-700">Fitting</span>
          <span className="font-semibold text-zinc-900">
            {centre.fitting_price != null ? `$${fittingCost.toFixed(2)}` : 'POA'}
          </span>
        </div>

        {/* Shipping */}
        <div className="flex justify-between px-4 py-3 text-sm">
          <span className="text-zinc-700">Shipping</span>
          <span className="text-zinc-500">Calculated at checkout</span>
        </div>

        {/* Additional services */}
        {hasAny && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Additional Services</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-700 font-semibold">
                <Wrench className="w-3.5 h-3.5 text-primary" />
                <span className="text-primary">Wheel Alignment</span>
                <span className="text-zinc-400 font-normal">— recommended for longer tyre life</span>
              </div>
              {alignOptions.map(opt => (
                <label key={opt.type}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedAlignment === opt.type
                      ? 'bg-primary border-primary'
                      : 'border-zinc-300 group-hover:border-zinc-500'
                  }`}
                    onClick={() => setSelectedAlignment(selectedAlignment === opt.type ? null : opt.type)}
                  >
                    {selectedAlignment === opt.type && <Check className="w-3 h-3 text-zinc-900" />}
                  </div>
                  <span className="flex-1 text-sm font-medium text-zinc-800">{opt.label}</span>
                  <span className="text-sm text-zinc-600">${opt.price.toFixed(2)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Included services */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Included Services</p>
          <div className="space-y-1.5">
            {[
              { label: 'Balancing', tag: 'BALANCING' },
              { label: 'Tyre Disposal', tag: 'TYRE DISPOSAL' },
            ].map(s => (
              <div key={s.tag} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 shrink-0" />
                <span className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide">
                  {s.tag}
                </span>
                <span className="text-sm text-zinc-700 flex-1">{s.label}</span>
                <span className="text-sm font-semibold text-green-600">FREE</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="flex justify-between text-base font-bold text-zinc-900 mb-1 px-1">
        <span>Estimated Total</span>
        <span>${displayTotal.toFixed(2)}</span>
      </div>
      <p className="text-xs text-zinc-400 px-1 mb-4">Excl. shipping, calculated at checkout</p>

      <button
        type="button"
        onClick={handleSave}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-zinc-900 hover:bg-primary/90 transition-colors shrink-0"
      >
        Save station &amp; Continue
      </button>
    </div>
  )
}

// ── Step 4: Confirmation ──────────────────────────────────────────────────────

function ConfirmationStep({
  centreName,
  onContinueShopping,
  onGoToCheckout,
}: {
  centreName:          string
  onContinueShopping:  () => void
  onGoToCheckout:      () => void
}) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-6 h-full justify-center">
      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
        <Car className="w-8 h-8 text-zinc-900" />
      </div>
      <div>
        <p className="text-lg font-bold text-zinc-900">Great! We saved your fitting partner choice.</p>
        <p className="text-sm text-green-600 font-semibold mt-1">You&apos;re all set now and ready to checkout!</p>
      </div>
      <div className="w-full border-t border-b border-zinc-100 py-4">
        <p className="font-semibold text-zinc-900">{centreName}</p>
        <p className="text-sm text-zinc-500">Order now and get it in 1–3 business days</p>
      </div>
      <div className="flex gap-3 w-full">
        <button
          type="button"
          onClick={onContinueShopping}
          className="flex-1 rounded-xl border border-zinc-300 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Continue shopping
        </button>
        <button
          type="button"
          onClick={onGoToCheckout}
          className="flex-1 rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white hover:bg-zinc-700 transition-colors"
        >
          Go to checkout
        </button>
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function FitterSelectionModal({ open, onClose, tyreQty, cartSubtotal }: Props) {
  const router = useRouter()
  const { setFittingSelection } = useCartStore()

  const [step,     setStep]     = useState<0 | 1 | 2 | 3>(0)
  const [postcode, setPostcode] = useState('')
  const [centres,  setCentres]  = useState<Centre[]>([])
  const [origin,   setOrigin]   = useState<{ lat: number; lng: number } | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Centre | null>(null)
  const [savedName, setSavedName] = useState('')

  // Reset state when modal reopens
  useEffect(() => {
    if (open) { setStep(0); setPostcode(''); setCentres([]); setOrigin(null); setSelected(null) }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const fetchCentres = useCallback(async (pc: string) => {
    setLoading(true)
    setFetchError(null)
    try {
      const res  = await fetch(`${API}/api/stripe/fitment-centres?postcode=${pc}`)
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      if (data && typeof data === 'object' && Array.isArray(data.centres)) {
        setCentres(data.centres)
        setOrigin(data.origin ?? null)
      } else {
        setCentres(Array.isArray(data) ? data : [])
        setOrigin(null)
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load fitting stations')
      setCentres([])
      setOrigin(null)
    } finally { setLoading(false) }
  }, [])

  function handlePostcodeContinue(pc: string) {
    setPostcode(pc)
    setStep(1)
    fetchCentres(pc)
  }

  function handleSelectCentre(c: Centre) {
    setSelected(c)
    setStep(2)
  }

  function handleSaveSelection(sel: FittingSelection) {
    setFittingSelection(sel)
    setSavedName(sel.centreName)
    setStep(3)
  }

  function handleSkip() {
    setFittingSelection(null)
    onClose()
  }

  if (!open) return null

  const stepTitles: Record<number, string> = {
    0: 'How it works',
    1: `Fitting stations in ${postcode}`,
    2: selected ? (selected.mobile_fitting_available ? 'Mobile Fitter' : `Fitting Partner in ${selected.addresses?.suburb ?? ''}`) : '',
    3: 'Fitting Partner Saved',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} aria-hidden />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col"
          style={{ maxHeight: 'min(90vh, 680px)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
            <h2 className="font-oswald text-sm font-bold text-zinc-900 uppercase tracking-wide">{stepTitles[step]}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-zinc-400 hover:text-zinc-700 hover:!bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col">
            {step === 0 && (
              <HowItWorksStep onContinue={handlePostcodeContinue} />
            )}
            {step === 1 && (
              <StationsStep
                postcode={postcode}
                centres={centres}
                origin={origin}
                loading={loading}
                fetchError={fetchError}
                onSelect={handleSelectCentre}
                onChangePostcode={() => setStep(0)}
                onSkip={handleSkip}
              />
            )}
            {step === 2 && selected && (
              <StationDetailStep
                centre={selected}
                tyreQty={tyreQty}
                cartSubtotal={cartSubtotal}
                onSave={handleSaveSelection}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <ConfirmationStep
                centreName={savedName}
                onContinueShopping={onClose}
                onGoToCheckout={() => { onClose(); router.push('/checkout') }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
