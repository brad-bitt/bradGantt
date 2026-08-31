import type { Dependency, Row, Task } from './types'
import { addDays, maxDate, minDate } from './dates'

type Dated = { startDate: string; endDate: string }

export function shiftDates(t: Dated, deltaDays: number): Dated {
  return { startDate: addDays(t.startDate, deltaDays), endDate: addDays(t.endDate, deltaDays) }
}

export function resizeDates(t: Dated, edge: 'start' | 'end', deltaDays: number): Dated {
  if (edge === 'start') {
    return { startDate: minDate(addDays(t.startDate, deltaDays), t.endDate), endDate: t.endDate }
  }
  return { startDate: t.startDate, endDate: maxDate(addDays(t.endDate, deltaDays), t.startDate) }
}

export function groupBounds(children: Dated[]): Dated | null {
  if (children.length === 0) return null
  return children.reduce<Dated>(
    (acc, c) => ({ startDate: minDate(acc.startDate, c.startDate), endDate: maxDate(acc.endDate, c.endDate) }),
    { startDate: children[0].startDate, endDate: children[0].endDate },
  )
}

/** Ajouter from→to crée un cycle ssi `from` est déjà atteignable depuis `to`. */
export function wouldCreateCycle(deps: Dependency[], fromId: string, toId: string): boolean {
  const next = new Map<string, string[]>()
  for (const d of deps) next.set(d.fromTaskId, [...(next.get(d.fromTaskId) ?? []), d.toTaskId])
  const stack = [toId]
  const seen = new Set<string>()
  while (stack.length) {
    const n = stack.pop()!
    if (n === fromId) return true
    if (seen.has(n)) continue
    seen.add(n)
    stack.push(...(next.get(n) ?? []))
  }
  return false
}

export type LinkReason = 'self' | 'duplicate' | 'cycle'
export type LinkCheck = { ok: true } | { ok: false; reason: LinkReason }

export const LINK_ERRORS: Record<LinkReason, string> = {
  self: "Une tâche ne peut pas dépendre d'elle-même",
  duplicate: 'Cette dépendance existe déjà',
  cycle: 'Dépendance refusée : cela créerait un cycle',
}

export function checkLink(deps: Dependency[], fromId: string, toId: string): LinkCheck {
  if (fromId === toId) return { ok: false, reason: 'self' }
  if (deps.some((d) => d.fromTaskId === fromId && d.toTaskId === toId)) return { ok: false, reason: 'duplicate' }
  if (wouldCreateCycle(deps, fromId, toId)) return { ok: false, reason: 'cycle' }
  return { ok: true }
}

const byOrder = (a: Task, b: Task) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)

export function buildRows(tasks: Task[]): Row[] {
  const rows: Row[] = []
  const roots = tasks.filter((t) => t.parentId === null).sort(byOrder)
  for (const root of roots) {
    rows.push({ task: root, depth: 0, index: rows.length })
    if (root.type === 'group' && !root.collapsed) {
      for (const child of tasks.filter((t) => t.parentId === root.id).sort(byOrder)) {
        rows.push({ task: child, depth: 1, index: rows.length })
      }
    }
  }
  return rows
}

export function siblingsOf(tasks: Task[], task: Pick<Task, 'parentId'>): Task[] {
  return tasks.filter((t) => t.parentId === task.parentId).sort(byOrder)
}

export function reorderSiblings(siblings: Task[], movedId: string, targetIndex: number): { taskId: string; sortOrder: number }[] {
  const moved = siblings.find((s) => s.id === movedId)
  if (!moved) return []
  const rest = siblings.filter((s) => s.id !== movedId)
  const idx = Math.max(0, Math.min(targetIndex, rest.length))
  rest.splice(idx, 0, moved)
  return rest.map((t, i) => ({ taskId: t.id, sortOrder: i }))
}

export function nextSortOrder(siblings: Task[]): number {
  return siblings.length ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 0
}
