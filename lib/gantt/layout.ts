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

/**
 * Compute layout from tasks and optional drag state.
 * Assumes groups are non-nested (i.e., groups always have parentId === null).
 * This constraint ensures group bounds are computed correctly in a single pass
 * without requiring topological sort.
 */
export function computeLayout(data: GanttData, drag: DragState | null, zoom: Zoom, today: string): Layout {
  const tasks = Object.values(data.tasks)
  const effective: Record<string, Task> = {}

  // Build children index once to avoid repeated filtering
  const childrenIndex = new Map<string, string[]>()
  for (const task of tasks) {
    if (task.parentId !== null) {
      if (!childrenIndex.has(task.parentId)) {
        childrenIndex.set(task.parentId, [])
      }
      childrenIndex.get(task.parentId)!.push(task.id)
    }
  }

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
    const childIds = childrenIndex.get(g.id) || []
    const childTasks = childIds.map((id) => effective[id]).filter((t): t is Task => t !== undefined)
    const bounds = groupBounds(childTasks)
    if (bounds) effective[g.id] = { ...effective[g.id], ...bounds }
  }

  // La plage ignore les dates stockées des groupes non vides (elles ne sont pas affichées)
  const forRange = Object.values(effective).filter((t) => t.type !== 'group' || !childrenIndex.has(t.id))
  const range = computeRange(forRange, today)
  const rows = buildRows(Object.values(effective), childrenIndex)
  const rects: Record<string, Rect> = {}
  for (const row of rows) rects[row.task.id] = barRect(row.task, row.index, range, zoom)

  return { rows, rects, effective, range, width: timelineWidth(range, zoom), height: rows.length * ROW_HEIGHT }
}
