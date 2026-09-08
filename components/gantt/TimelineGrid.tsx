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
   * Hauteur de la zone de DONNÉES : une ligne sous la dernière tâche, trois au minimum pour
   * qu'un projet vide se lise encore comme un calendrier.
   *
   * Le décor, lui, descend désormais jusqu'en bas du conteneur (`inset-0`) et non plus jusqu'à
   * cette limite : sur un projet de quatre lignes, la moitié basse de l'écran n'était qu'un
   * aplat crème où l'axe du temps s'interrompait sans raison. Il ne redevient pas pour autant
   * « 80 % de grille sans données » : sous cette limite, le voile ci-dessous l'atténue et les
   * traits de ligne s'arrêtent net. Le calendrier continue, la grille non.
   */
  const dataHeight = Math.max(layout.height + ROW_HEIGHT, ROW_HEIGHT * 3)

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
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
      {/* Traits de ligne : POUR LES LIGNES RÉELLES seulement. Les prolonger sous la dernière
          tâche redessinerait un tableau vide, ce que le voile ne rattraperait pas — un trait
          horizontal se lit comme une ligne à remplir, une bande de mois non. */}
      {layout.rows.map((r) => (
        <div key={r.task.id} className="absolute left-0 right-0 border-b border-ink/20" style={{ top: r.index * ROW_HEIGHT, height: ROW_HEIGHT }} />
      ))}
      {inRange && (
        // Centrée sur la colonne du jour, d'où le décalage d'une demi-colonne moins la moitié
        // de l'épaisseur du trait.
        <div data-testid="today-line" className="absolute top-0 bottom-0 bg-today" style={{ left: todayX + PX_PER_DAY[zoom] / 2 - 1.5, width: 3 }} />
      )}
      {/* Voile. Posé EN DERNIER, donc par-dessus tout le décor : sous la zone de données, bandes
          de mois, week-ends et trait du jour s'estompent au lieu de disputer l'attention aux
          barres. Il laisse l'axe du temps lisible sans le laisser dominer. */}
      <div className="absolute inset-x-0 bottom-0 bg-cream/55" style={{ top: dataHeight }} />
    </div>
  )
}
