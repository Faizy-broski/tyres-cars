import type { Metadata } from 'next'
import Image from 'next/image'
import BookingSection from '@/components/home/BookingSection'

export const metadata: Metadata = {
  title: 'Book Now',
  description: 'Book tyre fitting, wheel alignment, balancing, puncture repair or car valeting with Tyres & Car Valeting.',
}

export default function BookPage() {
  return (
    <div className="-mt-[104px] min-h-screen bg-white">
      <section className="relative flex h-[320px] w-full items-center justify-center overflow-hidden pt-[104px] md:h-[380px]">
        <div className="absolute inset-0">
          <Image src="/contact.svg" alt="Book with Tyres & Car Valeting" fill priority className="object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="font-oswald text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            Book <span className="text-primary">Now</span>
          </h1>
          <p className="mt-5 text-lg text-zinc-300 md:text-xl">
            Tyre fitting, wheel services and car valeting — pick a date and we&apos;ll confirm.
          </p>
        </div>
      </section>

      <BookingSection />
    </div>
  )
}
