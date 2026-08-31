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
  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  // Racines légitimes (parentId === null) + orphans (parent inexistant).
  // Les orphans sont traités comme des racines pour le tri et l'affichage.
  // Cela assure que aucune tâche ne disparaît silencieusement.
  const roots = tasks
    .filter((t) => {
      if (t.parentId === null) return true
      const parent = taskMap.get(t.parentId)
      return !parent // Parent inexistant = orphan
    })
    .sort(byOrder)

  for (const root of roots) {
    rows.push({ task: root, depth: 0, index: rows.length })

    // Ajouter les enfants directs de cette tâche
    const children = tasks.filter((t) => t.parentId === root.id).sort(byOrder)
    if (root.type === 'group' && !root.collapsed) {
      // Enfants d'un groupe non-replié : depth 1
      for (const child of children) {
        rows.push({ task: child, depth: 1, index: rows.length })
      }
    } else if (children.length > 0 && root.type !== 'group') {
      // Enfants d'un non-groupe : depth 0
      // (Les enfants d'un groupe replié ne s'affichent pas)
      for (const child of children) {
        rows.push({ task: child, depth: 0, index: rows.length })
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
