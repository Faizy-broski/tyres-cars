import { Clock, Phone, Mail } from "lucide-react";
import BookingForm from "@/components/storefront/BookingForm";

export default function BookingSection() {
  return (
    <section id="booking" className="w-full scroll-mt-28 py-20">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[380px_1fr] lg:gap-16 lg:px-10">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Book Online</p>
          <h2 className="mt-2 font-oswald text-3xl font-black uppercase leading-tight tracking-tight text-zinc-950 sm:text-4xl">
            Book Your Fitting Or Valet
          </h2>
          <p className="mt-4 text-base text-zinc-600">
            Tell us what you need and when suits you. We&apos;ll get back to you to confirm the booking.
          </p>

          <div className="mt-8 space-y-4 text-base font-medium text-zinc-700">
            <p className="flex items-center gap-3"><Phone className="h-5 w-5 text-primary" /> 886-540-0167</p>
            <p className="flex items-center gap-3"><Mail className="h-5 w-5 text-primary" /> info@tyrevault.com.au</p>
          </div>

          <div className="mt-8 rounded-[28px] bg-zinc-950 p-8">
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

        <div className="rounded-[32px] border border-zinc-100 bg-white p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.08)] sm:p-10">
          <BookingForm />
        </div>
      </div>
    </section>
  );
}
