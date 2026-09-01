'use client'
import { useGanttStore } from '@/lib/gantt/store'
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
      className={cn('absolute flex items-center select-none touch-none', canEdit && 'cursor-grab active:cursor-grabbing')}
      style={{ left: rect.x + rect.width / 2 - size / 2, top: rect.y, width: size, height: rect.height }}
      onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'move')}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      <div
        className={cn('rotate-45 border-[3px] border-ink shadow-brutal', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
        style={{ width: size, height: size, backgroundColor: task.color }}
      />
      <span className="absolute left-full ml-3 whitespace-nowrap text-sm font-bold">{task.title}</span>
    </div>
  )
}
