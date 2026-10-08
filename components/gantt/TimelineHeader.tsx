'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { PX_PER_DAY, dateToX, monthCells, subCells } from '@/lib/gantt/geometry'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function TimelineHeader() {
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const { layout } = useGanttView()
  const months = monthCells(layout.range, zoom)
  const subs = subCells(layout.range, zoom)
  const todayInRange = today >= layout.range.start && today <= layout.range.end
  const todayX = dateToX(today, layout.range, zoom) + PX_PER_DAY[zoom] / 2 - 1.5
  return (
    <div className="relative border-b border-line bg-surface" style={{ width: layout.width, height: '100%' }}>
      {/* Même alternance que la grille, pour que l'en-tête et le corps se lisent d'un bloc. */}
      {months.map((m, i) => (
        <div
          key={m.key}
          className={cn(
            'absolute top-0 h-7 border-r border-line px-2 font-display text-xs font-medium leading-7 truncate',
            i % 2 === 1 && 'bg-paper',
          )}
          style={{ left: m.x, width: m.width }}
        >
          {m.label}
        </div>
      ))}
      {subs.map((c) => (
        <div
          key={c.key}
          className="absolute top-7 h-7 border-r border-line border-t border-t-line text-center font-mono text-xs leading-7 truncate text-ink-soft"
          style={{ left: c.x, width: c.width }}
        >
          {/* En dessous de ~24 px la cellule ne peut pas afficher son libellé sans le tronquer
              en bouillie : on la laisse vide, elle ne sert plus que de graduation. */}
          {c.width >= 24 ? c.label : ''}
        </div>
      ))}
      {/* La ligne du jour s'arrête désormais avec la grille ; ce talon la prolonge dans l'en-tête,
          qui reste collé en haut. Après un défilement vertical, c'est lui qui dit où l'on est. */}
      {todayInRange && (
        <div className="absolute bottom-0 z-10 bg-today" style={{ left: todayX, width: 3, height: 14 }} aria-hidden />
      )}
    </div>
  )
}
