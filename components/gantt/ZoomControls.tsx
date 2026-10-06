'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Zoom } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

const LEVELS: { value: Zoom; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
]

/**
 * Segments de zoom : une commande de niveau 2 (bordure, pas d'ombre), le segment courant en
 * jaune — le jaune ne signifie que « actif ».
 */
export function ZoomControls() {
  const zoom = useGanttStore((s) => s.zoom)
  const setZoom = useGanttStore((s) => s.setZoom)
  return (
    <div role="group" aria-label="Zoom" className="inline-flex border-[3px] border-ink bg-paper">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setZoom(l.value)}
          aria-pressed={zoom === l.value}
          // Le nom accessible reste le mot entier quel que soit l'écran : sur un téléphone, seule
          // l'initiale est PEINTE, pour que zoom et boutons tiennent sur une ligne.
          aria-label={l.label}
          className={cn(
            'px-2 py-1 text-sm font-bold border-r-[3px] border-ink last:border-r-0 brutal-focus sm:px-3',
            zoom === l.value ? 'bg-yellow text-on-data' : 'hover:bg-band',
          )}
        >
          <span aria-hidden className="sm:hidden">{l.label[0]}</span>
          <span aria-hidden className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  )
}
