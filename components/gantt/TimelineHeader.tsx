'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { monthCells, subCells } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'

export function TimelineHeader() {
  const zoom = useGanttStore((s) => s.zoom)
  const { layout } = useGanttView()
  const months = monthCells(layout.range, zoom)
  const subs = subCells(layout.range, zoom)
  return (
    <div className="relative border-b-[3px] border-ink bg-paper" style={{ width: layout.width, height: '100%' }}>
      {months.map((m) => (
        <div
          key={m.key}
          className="absolute top-0 h-7 border-r border-ink/20 px-2 font-display text-xs uppercase leading-7 truncate"
          style={{ left: m.x, width: m.width }}
        >
          {m.label}
        </div>
      ))}
      {subs.map((c) => (
        <div
          key={c.key}
          className="absolute top-7 h-7 border-r border-ink/20 border-t border-t-ink/20 text-center font-mono text-[11px] leading-7 truncate"
          style={{ left: c.x, width: c.width }}
        >
          {/* En dessous de ~24 px la cellule ne peut pas afficher son libellé sans le tronquer
              en bouillie : on la laisse vide, elle ne sert plus que de graduation. */}
          {c.width >= 24 ? c.label : ''}
        </div>
      ))}
    </div>
  )
}
