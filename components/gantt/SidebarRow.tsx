'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { ROW_HEIGHT } from '@/lib/gantt/geometry'
import { siblingsOf } from '@/lib/gantt/scheduling'
import type { Row } from '@/lib/gantt/types'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function SidebarRow({ row }: { row: Row }) {
  const { task, depth } = row
  const { canEdit, reorder } = useGanttView()
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  /**
   * Cette ligne est la place VISÉE par le geste en cours. Le sélecteur retourne un booléen et
   * non l'objet de geste : la sidebar entière se re-rendrait à chaque image, alors que seules
   * deux lignes changent d'apparence.
   */
  const isDropTarget = useGanttStore((s) => {
    const d = s.drag
    if (!d || d.mode !== 'reorder' || d.taskId === task.id) return false
    const moving = s.tasks[d.taskId]
    if (!moving || moving.parentId !== task.parentId) return false
    return siblingsOf(Object.values(s.tasks), task).findIndex((x) => x.id === task.id) === d.targetIndex
  })
  const select = useGanttStore((s) => s.select)
  const openEditor = useGanttStore((s) => s.openEditor)
  const assignee = useGanttStore((s) => s.members.find((m) => m.userId === task.assigneeId))

  return (
    <div
      data-row-task-id={task.id}
      className={cn(
        'flex items-center gap-2 border-b border-ink/20 pr-2 select-none',
        selected && 'bg-yellow',
        isDropTarget && 'shadow-[inset_0_3px_0_#111]',
      )}
      style={{ height: ROW_HEIGHT, paddingLeft: depth === 1 ? 32 : 8 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      {/* Largeur réservée même pour un lecteur : sans elle, les colonnes de la sidebar se
          décaleraient d'un rôle à l'autre. */}
      {canEdit ? (
        <button
          type="button"
          aria-label="Réordonner"
          className="w-4 shrink-0 cursor-grab font-mono leading-none text-ink/40 active:cursor-grabbing brutal-focus"
          onPointerDown={(e) => reorder.onGripPointerDown(e, task.id)}
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      {/* Le repli n'est PAS un pli d'affichage : `collapsed` est persisté et partagé par tout le
          projet. Un lecteur en voit donc l'état, sans pouvoir le changer — le bouton deviendrait
          une commande refusée par la RLS, c'est-à-dire un toast d'erreur à chaque clic. */}
      {task.type === 'group' && canEdit ? (
        <button
          type="button"
          aria-label={task.collapsed ? 'Déplier' : 'Replier'}
          className="w-5 shrink-0 text-center font-mono brutal-focus"
          onClick={(e) => { e.stopPropagation(); void getGanttCommands().toggleGroup(task.id) }}
        >
          {task.collapsed ? '▸' : '▾'}
        </button>
      ) : task.type === 'group' ? (
        <span className="w-5 shrink-0 text-center font-mono text-ink/60" aria-hidden>{task.collapsed ? '▸' : '▾'}</span>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      {task.type === 'milestone' && <span className="size-3 shrink-0 rotate-45 bg-ink" aria-hidden />}
      <span className={cn('flex-1 truncate text-sm', task.type === 'group' && 'font-display uppercase')}>{task.title}</span>
      {assignee && <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />}
      {task.type === 'group' && canEdit && (
        <button
          type="button"
          aria-label="Ajouter une tâche au groupe"
          className="size-6 shrink-0 border-[3px] border-ink bg-paper font-bold leading-none hover:bg-yellow brutal-focus"
          onClick={(e) => { e.stopPropagation(); openEditor({ mode: 'create', parentId: task.id, type: 'task' }) }}
        >
          +
        </button>
      )}
    </div>
  )
}
