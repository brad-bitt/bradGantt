'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { ROW_HEIGHT, dayColumns, dateToX, monthCells, PX_PER_DAY } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'

export function TimelineGrid() {
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const { layout } = useGanttView()
  const cols = dayColumns(layout.range, zoom, today)
  const months = monthCells(layout.range, zoom)
  const todayX = dateToX(today, layout.range, zoom)
  const inRange = today >= layout.range.start && today <= layout.range.end

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Bandes de mois alternées. Aux zooms semaine et mois, la grille n'avait aucun repère
          et la timeline se lisait comme une étendue de crème : le rythme des mois donne
          l'échelle sans ajouter de trait. Posées en premier, donc sous tout le reste. */}
      {months.map((m, i) => (
        i % 2 === 1 && <div key={m.key} className="absolute top-0 bottom-0 bg-band" style={{ left: m.x, width: m.width }} />
      ))}
      {cols.filter((c) => c.isWeekend).map((c) => (
        <div
          key={c.date}
          className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(135deg,rgba(17,17,17,0.16)_0_3px,transparent_3px_8px)]"
          style={{ left: c.x, width: c.width }}
        />
      ))}
      {zoom === 'day' && cols.map((c) => (
        <div key={c.date} className="absolute top-0 bottom-0 border-r border-ink/20" style={{ left: c.x, width: c.width }} />
      ))}
      {layout.rows.map((r) => (
        <div key={r.task.id} className="absolute left-0 right-0 border-b border-ink/20" style={{ top: r.index * ROW_HEIGHT, height: ROW_HEIGHT }} />
      ))}
      {inRange && (
        // Centrée sur la colonne du jour, d'où le décalage d'une demi-colonne moins la moitié
        // de l'épaisseur du trait.
        <div data-testid="today-line" className="absolute top-0 bottom-0 bg-today" style={{ left: todayX + PX_PER_DAY[zoom] / 2 - 1.5, width: 3 }} />
      )}
    </div>
  )
}
