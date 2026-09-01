'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { RESIZE_HANDLE_PX } from '@/lib/gantt/geometry'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function TaskBar({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const openEditor = useGanttStore((s) => s.openEditor)
  const { drag, canEdit } = useGanttView()
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate} → ${task.endDate}`}
      className={cn(
        // Plus d'`overflow-hidden` ici : la poignée de liaison de la tâche 12 déborde de la
        // barre. Le rognage du titre est assuré par le `truncate` du <span>, à qui `min-w-0`
        // donne le droit de rétrécir sous sa largeur de contenu (un enfant flex ne le fait pas
        // de lui-même).
        'absolute flex items-center border-[3px] border-ink shadow-brutal select-none touch-none',
        canEdit && 'cursor-grab active:cursor-grabbing',
        selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2',
      )}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, backgroundColor: task.color }}
      // `onPointerDown` et non `onClick` : le geste doit être armé avant le premier déplacement.
      // La sélection reste assurée (le hook la pose même pour un lecteur).
      onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'move')}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,#111_0_4px,transparent_4px_8px)] opacity-40"
        style={{ width: `${task.progress}%` }}
        aria-hidden
      />
      {canEdit && (
        <>
          {/* Enfants de la barre : leur `stopPropagation` (dans le hook) empêche la barre
              d'armer un déplacement par-dessus le redimensionnement. */}
          <div
            data-handle="resize-start"
            className="absolute inset-y-0 left-0 z-10 cursor-ew-resize"
            style={{ width: RESIZE_HANDLE_PX }}
            onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'resize-start')}
          />
          <div
            data-handle="resize-end"
            className="absolute inset-y-0 right-0 z-10 cursor-ew-resize"
            style={{ width: RESIZE_HANDLE_PX }}
            onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'resize-end')}
          />
        </>
      )}
      <span className="relative min-w-0 truncate px-2 text-sm font-bold">{task.title}</span>
    </div>
  )
}
