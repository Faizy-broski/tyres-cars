import type { Metadata } from 'next'
import Image from 'next/image'
import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import ContactForm from '@/components/storefront/ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Tyres & Car Valeting — call, email, or send us a message and our team will get back to you shortly.',
}

const contactItems = [
  { icon: Phone, title: 'Call Us', value: '886-540-0167' },
  { icon: Mail, title: 'Email Us', value: 'info@tyrevault.com.au' },
  { icon: MapPin, title: 'Visit Us', value: '123 Workshop Lane, Auto City' },
]

export default function ContactPage() {
  return (
    <div className="-mt-[104px] min-h-screen bg-white">
      {/* Hero */}
      <section className="relative flex h-[380px] w-full items-center justify-center overflow-hidden pt-[104px] md:h-[460px]">
        <div className="absolute inset-0">
          <Image
            src="/contact.svg"
            alt="Contact Tyres & Car Valeting"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h1 className="font-oswald text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            Get In <span className="text-primary">Touch</span>
          </h1>
          <p className="mt-5 text-lg text-zinc-300 md:text-xl">
            Questions about tyres, fitting, or valeting? Our team is here to help.
          </p>
        </div>
      </section>

      {/* Contact info + form */}
      <section className="py-20 md:py-24">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[380px_1fr] lg:gap-16 lg:px-10">
          {/* Info column */}
          <div>
            <p className="font-bold uppercase tracking-[0.2em] text-primary text-sm">Contact Information</p>
            <h2 className="mt-2 font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950">
              We&apos;d Love To Hear From You
            </h2>

            <div className="mt-8 space-y-6">
              {contactItems.map((item) => (
                <div key={item.title} className="flex items-center gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-zinc-950 shadow-sm">
                    <item.icon className="h-7 w-7 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold leading-none text-zinc-950 sm:text-lg">{item.title}</h3>
                    <p className="mt-1.5 text-sm font-medium text-zinc-600 sm:text-base">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-[28px] bg-zinc-950 p-8">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-primary" />
                <h3 className="font-oswald text-xl font-black uppercase tracking-tight text-white">Opening Hours</h3>
              </div>
              <div className="mt-5 space-y-2 text-base font-medium text-zinc-300">
                <p>Mon - Fri: 8 AM - 6 PM (ET)</p>
                <p>Sat: 9 AM - 5 PM (ET)</p>
                <p>Sun: Closed</p>
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="rounded-[32px] border border-zinc-100 p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] sm:p-10">
            <h2 className="font-oswald text-2xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-3xl">
              Send Us A Message
            </h2>
            <p className="mt-2 text-sm text-zinc-500 sm:text-base">
              Fill out the form below and we&apos;ll respond as soon as possible.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
