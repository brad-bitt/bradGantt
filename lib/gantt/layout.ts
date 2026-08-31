import type { DragState, GanttData, Range, Rect, Row, Task, Zoom } from './types'
import { ROW_HEIGHT, barRect, computeRange, timelineWidth } from './geometry'
import { buildRows, groupBounds, resizeDates, shiftDates } from './scheduling'

export interface Layout {
  rows: Row[]
  rects: Record<string, Rect>
  effective: Record<string, Task>
  range: Range
  width: number
  height: number
}

export function computeLayout(data: GanttData, drag: DragState | null, zoom: Zoom, today: string): Layout {
  const tasks = Object.values(data.tasks)
  const effective: Record<string, Task> = {}

  for (const t of tasks) {
    let dates = { startDate: t.startDate, endDate: t.endDate }
    if (drag && 'taskId' in drag && drag.taskId === t.id) {
      if (drag.mode === 'move') dates = shiftDates(t, drag.deltaDays)
      else if (drag.mode === 'resize-start') dates = resizeDates(t, 'start', drag.deltaDays)
      else if (drag.mode === 'resize-end') dates = resizeDates(t, 'end', drag.deltaDays)
    }
    effective[t.id] = { ...t, ...dates }
  }

  for (const g of tasks) {
    if (g.type !== 'group') continue
    const bounds = groupBounds(tasks.filter((t) => t.parentId === g.id).map((c) => effective[c.id]))
    if (bounds) effective[g.id] = { ...effective[g.id], ...bounds }
  }

  // La plage ignore les dates stockées des groupes non vides (elles ne sont pas affichées)
  const forRange = Object.values(effective).filter((t) => t.type !== 'group' || !tasks.some((c) => c.parentId === t.id))
  const range = computeRange(forRange, today)
  const rows = buildRows(Object.values(effective))
  const rects: Record<string, Rect> = {}
  for (const row of rows) rects[row.task.id] = barRect(row.task, row.index, range, zoom)

  return { rows, rects, effective, range, width: timelineWidth(range, zoom), height: rows.length * ROW_HEIGHT }
}
