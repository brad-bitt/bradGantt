'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { LINK_HANDLE_PX } from '@/lib/gantt/geometry'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function MilestoneMark({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const openEditor = useGanttStore((s) => s.openEditor)
  const { drag, canEdit } = useGanttView()
  const size = rect.height * 0.75
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate}`}
      // Un jalon se déplace mais ne se redimensionne pas : il tient sur un jour par contrainte
      // de base (`tasks_milestone_single_day`), et `resizeTask` le refuse déjà. Pas de poignée.
      className={cn('group/ms absolute flex items-center select-none touch-none', canEdit && 'cursor-grab active:cursor-grabbing')}
      style={{ left: rect.x + rect.width / 2 - size / 2, top: rect.y, width: size, height: rect.height }}
      onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'move')}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      <div
        className={cn('rotate-45 border-[3px] border-ink shadow-brutal', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
        style={{ width: size, height: size, backgroundColor: task.color }}
      />
      {/* Le conteneur du jalon n'a pas de bordure — contrairement à la barre, `-LINK_HANDLE_PX`
          suffit ici à poser la pastille juste à droite du losange. */}
      {canEdit && (
        <button
          type="button"
          aria-label="Créer une dépendance"
          style={{ width: LINK_HANDLE_PX, height: LINK_HANDLE_PX, right: -LINK_HANDLE_PX }}
          className={cn(
            'absolute top-1/2 z-20 -translate-y-1/2 border-[3px] border-ink bg-paper cursor-crosshair hover:bg-yellow',
            'opacity-0 transition-opacity group-hover/ms:opacity-100 focus-visible:opacity-100',
            selected && 'opacity-100',
          )}
          onPointerDown={(e) => drag.onLinkPointerDown(e, task.id)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {/* `ml-6` et non `ml-3` : la poignée de liaison déborde de 16 px à droite du losange et
          passait par-dessus les premières lettres du titre. */}
      <span className="absolute left-full ml-6 whitespace-nowrap text-sm font-bold">{task.title}</span>
    </div>
  )
}
