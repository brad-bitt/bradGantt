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

  /**
   * La grille s'arrête une ligne sous la dernière tâche. Elle courait auparavant jusqu'en bas du
   * conteneur : sur un projet de quatre lignes dans une fenêtre de 900 px, 80 % de l'écran était
   * de la grille sans données. Le plancher de trois lignes garde une timeline lisible comme un
   * calendrier sur un projet vide ou presque.
   */
  const gridHeight = Math.max(layout.height + ROW_HEIGHT, ROW_HEIGHT * 3)

  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: gridHeight }} aria-hidden>
      {/* Bandes de mois alternées. Aux zooms semaine et mois, la grille n'avait aucun repère
          et la timeline se lisait comme une étendue de crème : le rythme des mois donne
          l'échelle sans ajouter de trait. Posées en premier, donc sous tout le reste. */}
      {months.map((m, i) => (
        i % 2 === 1 && <div key={m.key} className="absolute top-0 bottom-0 bg-band" style={{ left: m.x, width: m.width }} />
      ))}
      {/* Aplat et non plus hachures diagonales. Le motif rayé se répétait sur toute la hauteur et
          sur toutes les colonnes de week-end : au zoom semaine, où une colonne fait 12 px, il
          produisait un moiré permanent dans lequel quatre barres se noyaient. Une bande unie dit
          la même chose — ce jour n'est pas ouvré — sans disputer l'attention aux données. */}
      {cols.filter((c) => c.isWeekend).map((c) => (
        <div key={c.date} className="absolute top-0 bottom-0 bg-ink/[0.07]" style={{ left: c.x, width: c.width }} />
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
