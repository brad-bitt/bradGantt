'use client'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

export function GroupBar({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  const openEditor = useGanttStore((s) => s.openEditor)
  const canEdit = useGanttStore(selectCanEdit)
  return (
    <div
      data-task-id={task.id}
      title={task.title}
      className={cn('absolute bg-ink select-none', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
      style={{ left: rect.x, top: rect.y + rect.height / 2 - 5, width: rect.width, height: 10 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      <span className="absolute -left-[3px] -top-[3px] size-4 rotate-45 bg-ink" aria-hidden />
      <span className="absolute -right-[3px] -top-[3px] size-4 rotate-45 bg-ink" aria-hidden />
    </div>
  )
}
