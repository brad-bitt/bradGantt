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
          // Le nom accessible reste le mot entier quel que soit l'écran : sur un téléphone, seule
          // l'initiale est PEINTE, pour que zoom et boutons d'ajout tiennent sur une ligne.
          aria-label={l.label}
          className={cn(
            'px-2 py-1 font-bold uppercase text-sm border-r-[3px] border-ink last:border-r-0 brutal-focus sm:px-3',
            zoom === l.value ? 'bg-ink text-paper' : 'hover:bg-yellow hover:text-on-data',
          )}
        >
          <span aria-hidden className="sm:hidden">{l.label[0]}</span>
          <span aria-hidden className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  )
}
