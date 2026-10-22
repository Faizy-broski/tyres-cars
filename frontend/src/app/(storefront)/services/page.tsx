import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Disc3, Gauge, Sparkles, ShieldCheck, Wrench } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Services',
  description: 'Tyre fitting, wheel alignment, balancing and car valeting — explore the services Tyres & Car Valeting offers.',
}

const services = [
  {
    icon: Disc3,
    title: 'Tyre Fitting',
    desc: 'Professional tyre fitting carried out by our experienced team.',
  },
  {
    icon: Gauge,
    title: 'Wheel Alignment',
    desc: 'Precision alignment to reduce uneven wear, improve handling, and extend the life of your tyres.',
  },
  {
    icon: Wrench,
    title: 'Wheel Balancing',
    desc: 'Smooth out vibrations and protect your suspension with accurate computerised wheel balancing.',
  },
  {
    icon: Sparkles,
    title: 'Car Valeting',
    desc: 'Interior and exterior detailing packages that leave your vehicle looking and feeling brand new.',
  },
  {
    icon: ShieldCheck,
    title: 'Puncture Repair & Warranty',
    desc: 'Fast puncture repairs and manufacturer-backed warranty support on every tyre we sell.',
  },
]

const steps = [
  { id: '01', title: 'Choose Your Service', desc: 'Browse tyres or select a valeting package that fits your vehicle and needs.' },
  { id: '02', title: 'Book Online', desc: 'Send a booking request with your preferred date and we\'ll confirm it with you.' },
  { id: '03', title: 'Sit Back & Relax', desc: 'Our certified team handles the rest, so you drive away safe, sorted, and spotless.' },
]

export default function ServicesPage() {
  return (
    <div className="-mt-[104px] min-h-screen bg-white">
      {/* Hero */}
      <section className="relative flex h-[420px] w-full items-center justify-center overflow-hidden pt-[104px] md:h-[520px]">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1621361365424-06f0e1eb0f5e?q=80&w=1920&auto=format&fit=crop"
            alt="Tyre fitting service"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="font-oswald text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            Services That <span className="text-primary">Keep You Moving</span>
          </h1>
          <p className="mt-5 text-lg text-zinc-300 md:text-xl">
            From tyre fitting to full car valeting, our team has you covered end to end.
          </p>
        </div>
      </section>

      {/* Services grid */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-bold uppercase tracking-[0.2em] text-primary text-sm">What We Offer</p>
            <h2 className="mt-2 font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
              Everything Your Vehicle Needs
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div
                key={s.title}
                className="group relative overflow-hidden rounded-[2rem] border border-zinc-100 p-8 text-left transition-all duration-500 hover:-translate-y-2 hover:border-transparent hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50 transition-colors duration-500 group-hover:bg-primary">
                  <s.icon className="h-7 w-7 text-zinc-400 transition-colors duration-500 group-hover:text-zinc-900" strokeWidth={2} />
                </div>
                <h3 className="mt-6 text-xl font-bold text-zinc-950">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{s.desc}</p>
                <s.icon className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 text-zinc-50/80 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-12 group-hover:text-primary/[0.05]" strokeWidth={1} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-zinc-950 py-20 md:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-bold uppercase tracking-[0.2em] text-primary text-sm">How It Works</p>
            <h2 className="mt-2 font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-white sm:text-4xl">
              Simple, Fast, Hassle-Free
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.id} className="relative rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-left backdrop-blur-sm">
                <span className="font-oswald text-6xl font-black leading-none text-white/10">{s.id}</span>
                <h3 className="mt-4 text-xl font-bold text-white">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-[32px] bg-primary px-8 py-14 text-center sm:px-16 sm:py-16">
            <h2 className="font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
              Book Your Service Today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base font-medium text-zinc-900/80 sm:text-lg">
              Book your fitting or valet online, or reach out and our team will help you choose the right service.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/book"
                className="h-12 rounded-full bg-zinc-950 px-8 font-oswald text-lg font-bold italic text-white transition-all duration-200 hover:bg-zinc-800 flex items-center"
              >
                Book Now
              </Link>
              <Link
                href="/contact"
                className="h-12 rounded-full border-2 border-zinc-950 px-8 font-oswald text-lg font-bold italic text-zinc-950 transition-all duration-200 hover:bg-zinc-950 hover:text-white flex items-center"
              >
                Get In Touch
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
