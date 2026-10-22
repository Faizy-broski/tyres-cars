/** Shared between the booking form and the /api/booking route. */

export const BOOKING_SERVICES = [
  'Tyre Fitting',
  'Wheel Alignment',
  'Wheel Balancing',
  'Puncture Repair',
  'Car Valeting',
  'Other',
] as const

export const BOOKING_TIMES = ['Morning (8am – 12pm)', 'Afternoon (12pm – 4pm)', 'Late (4pm – 6pm)'] as const

export interface BookingRequest {
  name:      string
  email:     string
  phone:     string
  service:   string
  vehicle?:  string
  tyreSize?: string
  date:      string
  time?:     string
  message?:  string
  /** Honeypot — real users never see or fill this. */
  website?:  string
}
