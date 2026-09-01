'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

export function MilestoneMark({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  const size = rect.height * 0.75
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate}`}
      className="absolute flex items-center select-none"
      style={{ left: rect.x + rect.width / 2 - size / 2, top: rect.y, width: size, height: rect.height }}
      onClick={() => select({ kind: 'task', id: task.id })}
    >
      <div
        className={cn('rotate-45 border-[3px] border-ink shadow-brutal', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
        style={{ width: size, height: size, backgroundColor: task.color }}
      />
      <span className="absolute left-full ml-3 whitespace-nowrap text-sm font-bold">{task.title}</span>
    </div>
  )
}
