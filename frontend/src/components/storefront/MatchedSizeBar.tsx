'use client'

import { Disc } from 'lucide-react'

interface Props {
  width:   number
  profile: number
  rimSize: number
  onNotYourSize: () => void
}

export default function MatchedSizeBar({ width, profile, rimSize, onNotYourSize }: Props) {
  return (
    <div className="sticky top-14 z-20 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white/95 backdrop-blur-sm px-4 py-2.5 sm:rounded-xl sm:border sm:mb-4 sm:px-5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary shrink-0">
          <Disc className="w-4 h-4" />
        </span>
        <p className="text-sm font-bold text-zinc-800 truncate">
          Width {width} <span className="text-zinc-300 mx-0.5">·</span> Profile {profile} <span className="text-zinc-300 mx-0.5">·</span> Rim {rimSize}
        </p>
      </div>
      <button
        type="button"
        onClick={onNotYourSize}
        className="text-xs font-bold text-primary hover:underline whitespace-nowrap shrink-0"
      >
        Not your tyre size?
      </button>
    </div>
  )
}
