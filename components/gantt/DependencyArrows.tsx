'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { arrowPath } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'

export function DependencyArrows() {
  const deps = useGanttStore((s) => s.dependencies)
  const selection = useGanttStore((s) => s.selection)
  const select = useGanttStore((s) => s.select)
  const drag = useGanttStore((s) => s.drag)
  const { layout } = useGanttView()

  return (
    // Le SVG ne capte rien par défaut (`pointer-events-none`) pour laisser passer les clics
    // vers les barres qu'il recouvre ; seul chaque groupe de flèche réactive la capture.
    <svg className="absolute inset-0 overflow-visible pointer-events-none" width={layout.width} height={layout.height} aria-hidden>
      <defs>
        <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,4 L0,8 z" fill="#111111" />
        </marker>
      </defs>
      {Object.values(deps).map((d) => {
        const from = layout.rects[d.fromTaskId]
        const to = layout.rects[d.toTaskId]
        // Une extrémité repliée dans un groupe fermé n'a pas de rectangle : on ne trace rien.
        if (!from || !to) return null
        const path = arrowPath(from, to)
        const selected = selection?.kind === 'dependency' && selection.id === d.id
        return (
          <g
            key={d.id}
            data-dep-id={d.id}
            className="pointer-events-auto cursor-pointer"
            onClick={(e) => { e.stopPropagation(); select({ kind: 'dependency', id: d.id }) }}
          >
            {/* Tracé transparent épais : cible de clic confortable sur une flèche de 2,5 px. */}
            <path d={path} stroke="transparent" strokeWidth={14} fill="none" />
            {/* Halo crème sous le trait. Une flèche d'encre passant sur une barre colorée, une
                bande de week-end ou une autre flèche disparaissait dans le fond ; le liseré clair
                la détache de tout ce qu'elle traverse, sans l'épaissir. */}
            <path d={path} stroke="#FDF6E3" strokeWidth={selected ? 7 : 5} strokeLinecap="round" fill="none" />
            <path d={path} stroke="#111111" strokeWidth={selected ? 4 : 2.5} strokeDasharray={selected ? '6 4' : undefined} fill="none" markerEnd="url(#arrow-head)" />
          </g>
        )
      })}
      {/* Aperçu du lien en cours de tracé : de la source jusqu'au pointeur. En pointillé, pour
          qu'on ne le confonde pas avec une dépendance déjà enregistrée. La source repliée dans un
          groupe fermé n'a pas de rectangle — on ne trace alors rien. */}
      {drag?.mode === 'link' && layout.rects[drag.fromTaskId] && (() => {
        const r = layout.rects[drag.fromTaskId]
        return <line x1={r.x + r.width} y1={r.y + r.height / 2} x2={drag.x} y2={drag.y} stroke="#111111" strokeWidth={3} strokeDasharray="6 4" />
      })()}
    </svg>
  )
}
