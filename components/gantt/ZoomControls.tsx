'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Zoom } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

const LEVELS: { value: Zoom; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
]

export function ZoomControls() {
  const zoom = useGanttStore((s) => s.zoom)
  const setZoom = useGanttStore((s) => s.setZoom)
  return (
    <div role="group" aria-label="Zoom" className="inline-flex border-[3px] border-ink shadow-brutal bg-paper">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setZoom(l.value)}
          aria-pressed={zoom === l.value}
          className={cn(
            'px-3 py-1 font-bold uppercase text-sm border-r-[3px] border-ink last:border-r-0 brutal-focus',
            zoom === l.value ? 'bg-ink text-paper' : 'hover:bg-yellow',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
