'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

export function TaskBar({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate} → ${task.endDate}`}
      className={cn(
        'absolute flex items-center overflow-hidden border-[3px] border-ink shadow-brutal select-none',
        selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2',
      )}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, backgroundColor: task.color }}
      onClick={() => select({ kind: 'task', id: task.id })}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,#111_0_4px,transparent_4px_8px)] opacity-40"
        style={{ width: `${task.progress}%` }}
        aria-hidden
      />
      <span className="relative truncate px-2 text-sm font-bold">{task.title}</span>
    </div>
  )
}
