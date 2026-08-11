'use client'

import { ReactNode } from 'react'

interface SplitViewProps {
  title:                string
  description?:         string
  headerAction?:        ReactNode
  list:                 ReactNode
  panel:                ReactNode
  /** Tailwind width class for the right-hand panel. Defaults to a standard split panel. */
  panelWidthClassName?: string
}

/**
 * Shared two-pane admin layout: a list on the left, a persistent create/edit
 * panel on the right. Clicking any row loads that record into the panel.
 */
export function SplitView({
  title,
  description,
  headerAction,
  list,
  panel,
  panelWidthClassName = 'w-full lg:w-[420px] xl:w-[460px]',
}: SplitViewProps) {
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
          {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
        </div>
        {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 w-full space-y-4">{list}</div>
        <div className={`${panelWidthClassName} shrink-0 lg:sticky lg:top-6`}>
          {panel}
        </div>
      </div>
    </div>
  )
}
