'use client'
import { SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'
import { SidebarRow } from './SidebarRow'

export function Sidebar() {
  const { layout, reorder } = useGanttView()
  return (
    // Le suivi et le relâchement du geste sont écoutés ICI, pas sur la poignée : dès le premier
    // pixel parcouru le pointeur en sort. `touch-none` empêche le doigt de faire défiler la page
    // au lieu de déplacer la ligne. Un `pointercancel` vaut relâchement : le geste n'écrit que si
    // la place visée a changé, il n'y a donc rien à annuler.
    <div
      data-testid="gantt-sidebar"
      className="sticky left-0 z-20 touch-none border-r-[3px] border-ink bg-paper"
      style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
      onPointerMove={reorder.onPointerMove}
      onPointerUp={reorder.onPointerUp}
      onPointerCancel={reorder.onPointerUp}
    >
      {layout.rows.map((row) => <SidebarRow key={row.task.id} row={row} />)}
    </div>
  )
}
