import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, Users, Award, Truck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about Tyres & Car Valeting — our story, our values, and why thousands of drivers trust us for tyres and car care.',
}

const stats = [
  { label: 'Years in Business', value: '12+' },
  { label: 'Tyres Fitted', value: '150k+' },
  { label: 'Happy Customers', value: '40k+' },
  { label: 'Tyre Brands', value: '30+' },
]

const values = [
  {
    icon: ShieldCheck,
    title: 'Trusted Quality',
    desc: 'Every tyre we sell comes from leading global manufacturers, backed by genuine warranty and honest advice.',
  },
  {
    icon: Users,
    title: 'Customer First',
    desc: 'Our team helps you find the exact fit for your vehicle and budget — no guesswork, no upselling.',
  },
  {
    icon: Award,
    title: 'Certified Quality',
    desc: 'Every tyre is fitted by our own trained, certified technicians who take pride in their craft.',
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    desc: 'From warehouse to your door, we keep you moving with reliable, tracked shipping.',
  },
]

export default function AboutPage() {
  return (
    <div className="-mt-[104px] min-h-screen bg-white">
      {/* Hero */}
      <section className="relative flex h-[420px] w-full items-center justify-center overflow-hidden pt-[104px] md:h-[520px]">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?q=80&w=1920&auto=format&fit=crop"
            alt="Tyres & Car Valeting workshop"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="font-oswald text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            About <span className="text-primary">Tyres &amp; Car Valeting</span>
          </h1>
          <p className="mt-5 text-lg text-zinc-300 md:text-xl">
            Premium tyres, expert fitting, and professional car valeting — trusted by thousands of drivers nationwide.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 md:py-24">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10">
          <div className="relative h-[320px] w-full overflow-hidden rounded-[32px] md:h-[420px]">
            <Image
              src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=1400&auto=format&fit=crop"
              alt="Our tyre fitting team at work"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="font-bold uppercase tracking-[0.2em] text-primary text-sm">Our Story</p>
            <h2 className="mt-2 font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
              Built By Drivers, For Drivers
            </h2>
            <p className="mt-5 text-base leading-relaxed text-zinc-600 md:text-lg">
              Tyres &amp; Car Valeting started with a simple frustration: buying tyres shouldn&apos;t mean guessing sizes,
              overpaying at the shop, or waiting weeks for a fitting slot. We built an online platform that matches
              you with the exact right tyre for your vehicle and delivers it fast — all in a few clicks.
            </p>
            <p className="mt-4 text-base leading-relaxed text-zinc-600 md:text-lg">
              Today we work with leading global tyre brands to keep drivers safe, informed, and on the road — plus
              full car valeting services to keep your ride looking its best.
            </p>
            <Link
              href="/tyres"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 font-oswald text-lg font-bold italic text-zinc-950 transition-all duration-200 hover:bg-[#c89907]"
            >
              Shop Tyres
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-zinc-950 py-16">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-oswald text-4xl font-black text-primary sm:text-5xl">{s.value}</p>
              <p className="mt-2 text-sm font-medium uppercase tracking-wide text-zinc-400 sm:text-base">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="bg-white py-20 md:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-bold uppercase tracking-[0.2em] text-primary text-sm">Why Choose Us</p>
            <h2 className="mt-2 font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
              Driven By Our Values
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div
                key={v.title}
                className="group relative overflow-hidden rounded-[2rem] border border-zinc-100 p-8 text-left transition-all duration-500 hover:-translate-y-2 hover:border-transparent hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-50 transition-colors duration-500 group-hover:bg-primary">
                  <v.icon className="h-7 w-7 text-zinc-400 transition-colors duration-500 group-hover:text-zinc-900" strokeWidth={2} />
                </div>
                <h3 className="mt-6 text-xl font-bold text-zinc-950">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 md:pb-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-[32px] bg-primary px-8 py-14 text-center sm:px-16 sm:py-16">
            <h2 className="font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
              Ready To Get Rolling?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base font-medium text-zinc-900/80 sm:text-lg">
              Find the perfect tyres for your vehicle or get in touch with our team for expert advice.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/tyres"
                className="h-12 rounded-full bg-zinc-950 px-8 font-oswald text-lg font-bold italic text-white transition-all duration-200 hover:bg-zinc-800 flex items-center"
              >
                Shop Tyres
              </Link>
              <Link
                href="/contact"
                className="h-12 rounded-full border-2 border-zinc-950 px-8 font-oswald text-lg font-bold italic text-zinc-950 transition-all duration-200 hover:bg-zinc-950 hover:text-white flex items-center"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
