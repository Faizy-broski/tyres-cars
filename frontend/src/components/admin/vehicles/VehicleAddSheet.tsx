'use client'

import { Sheet } from '@/components/ui/sheet'
import VehicleForm from './VehicleForm'

interface Props {
  open:    boolean
  onClose: () => void
  onSaved: () => void
}

export function VehicleAddSheet({ open, onClose, onSaved }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Add Vehicle" width="w-full max-w-2xl">
      <VehicleForm onSuccess={onSaved} onCancel={onClose} />
    </Sheet>
  )
}
