'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { ChevronLeft, ChevronRight, XIcon } from 'lucide-react'
import { Dialog, DialogPortal, DialogOverlay, DialogTitle } from '@/components/ui/dialog'

export default function ImageLightbox({
  images, activeIndex, onActiveIndexChange, open, onOpenChange, alt,
}: {
  images: string[]
  activeIndex: number
  onActiveIndexChange: (i: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  alt: string
}) {
  const hasMultiple = images.length > 1
  const goPrev = () => onActiveIndexChange((activeIndex - 1 + images.length) % images.length)
  const goNext = () => onActiveIndexChange((activeIndex + 1) % images.length)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasMultiple) return
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, activeIndex, hasMultiple])

  if (!images[activeIndex]) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-4 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        >
          <DialogTitle className="sr-only">{alt} — image gallery</DialogTitle>

          <DialogPrimitive.Close className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors">
            <XIcon className="w-5 h-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          {hasMultiple && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
              <span className="sr-only">Previous image</span>
            </button>
          )}

          <div className="relative w-full max-w-4xl h-[70vh] max-h-[85vh]">
            <Image
              src={images[activeIndex]}
              alt={alt}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {hasMultiple && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
              <span className="sr-only">Next image</span>
            </button>
          )}

          {hasMultiple && (
            <div className="flex gap-2 overflow-x-auto max-w-full pb-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onActiveIndexChange(i)}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeIndex ? 'border-primary' : 'border-white/20'
                  }`}
                >
                  <Image src={img} alt="" width={56} height={56} className="w-full h-full object-contain bg-zinc-900 p-1" />
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
