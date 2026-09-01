'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { ROW_HEIGHT } from '@/lib/gantt/geometry'
import type { Row } from '@/lib/gantt/types'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function SidebarRow({ row }: { row: Row }) {
  const { task, depth } = row
  const { canEdit } = useGanttView()
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  const openEditor = useGanttStore((s) => s.openEditor)
  const assignee = useGanttStore((s) => s.members.find((m) => m.userId === task.assigneeId))

  return (
    <div
      data-row-task-id={task.id}
      className={cn('flex items-center gap-2 border-b border-ink/20 pr-2 select-none', selected && 'bg-yellow')}
      style={{ height: ROW_HEIGHT, paddingLeft: depth === 1 ? 32 : 8 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      {task.type === 'group' ? (
        <span className="w-5 text-center font-mono">{task.collapsed ? '▸' : '▾'}</span>
      ) : (
        <span className="w-5" />
      )}
      {task.type === 'milestone' && <span className="size-3 rotate-45 bg-ink" aria-hidden />}
      <span className={cn('flex-1 truncate text-sm', task.type === 'group' && 'font-display uppercase')}>{task.title}</span>
      {assignee && <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />}
    </div>
  )
}
