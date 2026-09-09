import type { Metadata } from 'next'
import OnboardingForm from '@/components/fitter/OnboardingForm'

export const metadata: Metadata = {
  title: 'Fitment Centre Onboarding — Tyres & Car Valeting',
  description: 'Apply to become a Tyres & Car Valeting Fitment Centre partner.',
}

export default function FitterOnboardingPage() {
  return <OnboardingForm />
}

