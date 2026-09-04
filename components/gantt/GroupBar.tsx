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
      // Un groupe RÉSUME ses enfants : il ne doit pas peser plus lourd qu'eux. Le trait de 10 px
      // en encre pleine, terminé par deux losanges, dominait des barres de tâche pourtant
      // porteuses de l'information. Il devient une équerre fine en encre douce — même empan,
      // même lecture, un cran en retrait.
      className={cn('absolute bg-ink-soft select-none', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
      style={{ left: rect.x, top: rect.y + rect.height / 2 - 3, width: rect.width, height: 6 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      {/* Montants d'extrémité : ils bornent l'empan du groupe sans le fermer comme un objet. */}
      <span className="absolute left-0 -top-[6px] h-[18px] w-[3px] bg-ink-soft" aria-hidden />
      <span className="absolute right-0 -top-[6px] h-[18px] w-[3px] bg-ink-soft" aria-hidden />
    </div>
  )
}
