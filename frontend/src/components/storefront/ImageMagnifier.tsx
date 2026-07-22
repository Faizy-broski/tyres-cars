'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image, { getImageProps } from 'next/image'

const LENS_SIZE = 160
const ZOOM = 2.2

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)')
    setIsTouch(mql.matches)
    const onChange = () => setIsTouch(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isTouch
}

export default function ImageMagnifier({
  src, alt, zoom = ZOOM, onClick, className,
}: {
  src: string
  alt: string
  zoom?: number
  onClick?: () => void
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showLens, setShowLens] = useState(false)
  const [lensPos, setLensPos] = useState({ left: 0, top: 0 })
  const [bgPos, setBgPos] = useState({ x: 50, y: 50 })
  const isTouch = useIsTouchDevice()

  const { props: optimizedProps } = useMemo(
    () => getImageProps({ src, alt, width: 1600, height: 1600, quality: 90 }),
    [src, alt]
  )

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100)
    setBgPos({ x: xPct, y: yPct })
    setLensPos({
      left: clamp(e.clientX - rect.left - LENS_SIZE / 2, 0, rect.width - LENS_SIZE),
      top: clamp(e.clientY - rect.top - LENS_SIZE / 2, 0, rect.height - LENS_SIZE),
    })
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className ?? ''}`}
      onMouseEnter={() => !isTouch && setShowLens(true)}
      onMouseLeave={() => setShowLens(false)}
      onMouseMove={isTouch ? undefined : handleMouseMove}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain p-8"
        sizes="(max-width: 1024px) 100vw, 50vw"
        priority
      />
      {showLens && !isTouch && (
        <div
          className="absolute rounded-full ring-2 ring-white shadow-xl pointer-events-none"
          style={{
            left: lensPos.left,
            top: lensPos.top,
            width: LENS_SIZE,
            height: LENS_SIZE,
            backgroundImage: `url(${optimizedProps.src})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${zoom * 100}% ${zoom * 100}%`,
            backgroundPosition: `${bgPos.x}% ${bgPos.y}%`,
          }}
        />
      )}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
