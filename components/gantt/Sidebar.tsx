'use client'
import { ROW_HEIGHT, SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { useGanttStore } from '@/lib/gantt/store'
import { useGanttView } from './GanttView'
import { SidebarRow } from './SidebarRow'

export function Sidebar() {
  const { layout, canEdit, reorder } = useGanttView()
  const openEditor = useGanttStore((s) => s.openEditor)
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
      {/* Ligne fantôme. Elle prolonge la liste d'un cran au lieu de la laisser s'arrêter net sur
          le vide, et offre le point d'entrée qui manquait en bas de liste : jusqu'ici, ajouter
          une tâche imposait de remonter à la barre d'outils. Elle est en pointillé et en encre
          douce — c'est une invite, pas une ligne du projet. */}
      {canEdit && layout.rows.length > 0 && (
        <button
          type="button"
          data-testid="sidebar-add-row"
          className="flex w-full items-center gap-2 border-b border-dashed border-ink/30 pl-8 pr-2 text-left font-bold text-sm text-ink-soft hover:bg-band hover:text-ink brutal-focus"
          style={{ height: ROW_HEIGHT }}
          onClick={() => openEditor({ mode: 'create', parentId: null, type: 'task' })}
        >
          <span aria-hidden className="font-mono">+</span>
          Ajouter une tâche
        </button>
      )}
    </div>
  )
}
