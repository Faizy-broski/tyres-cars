'use client'

import { Sheet } from '@/components/ui/sheet'
import WheelForm from './WheelForm'
import type { WheelBrand } from '@/types/admin.types'

interface Props {
  open:    boolean
  brands:  WheelBrand[]
  onClose: () => void
  onSaved: () => void
}

export function WheelAddSheet({ open, brands, onClose, onSaved }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Add Wheel Model" width="w-full max-w-2xl">
      <WheelForm brands={brands} onSuccess={onSaved} onCancel={onClose} />
    </Sheet>
  )
}
