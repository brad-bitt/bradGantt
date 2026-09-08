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

export function buildRows(tasks: Task[], childrenIndex?: Map<string, string[]>): Row[] {
  const rows: Row[] = []
  const taskMap = new Map(tasks.map((t) => [t.id, t]))

  // Use provided index or build it on demand
  const childMap = childrenIndex || buildChildrenIndex(tasks)

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
    const childIds = childMap.get(root.id) || []
    const children = childIds
      .map((id) => taskMap.get(id)!)
      .filter((t): t is Task => t !== undefined)
      .sort(byOrder)
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

function buildChildrenIndex(tasks: Task[]): Map<string, string[]> {
  const index = new Map<string, string[]>()
  for (const task of tasks) {
    if (task.parentId !== null) {
      if (!index.has(task.parentId)) {
        index.set(task.parentId, [])
      }
      index.get(task.parentId)!.push(task.id)
    }
  }
  return index
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

export interface InsertAfterPlan {
  /** `sortOrder` à donner à la nouvelle tâche. */
  sortOrder: number
  /** Frères à renuméroter pour lui faire de la place. Vide si l'ancre est la dernière. */
  shifts: { taskId: string; sortOrder: number }[]
}

/**
 * Ordre d'insertion d'une nouvelle tâche JUSTE APRÈS `anchorId` dans sa fratrie.
 *
 * Renumérote la fratrie de 0 à n comme `reorderSiblings`, plutôt que d'incrémenter les
 * `sortOrder` existants : ces derniers peuvent être troués (une suppression laisse un trou) et
 * un simple +1 sur les suivants produirait alors deux frères au même rang. `buildRows` trie par
 * `sortOrder` puis, à égalité, par un critère qui n'a rien à voir avec l'intention de
 * l'utilisateur — la nouvelle tâche apparaîtrait au petit bonheur avant ou après sa voisine.
 *
 * `shifts` ne contient que les frères dont le rang change VRAIMENT : sur une fratrie déjà
 * numérotée sans trou et une ancre en dernière position, il est vide et aucune écriture de
 * réordonnancement n'est émise.
 *
 * Retourne `null` si l'ancre n'appartient pas à la fratrie fournie — l'appelant n'a alors rien
 * à insérer « après » et doit se rabattre sur `nextSortOrder`.
 */
export function planInsertAfter(siblings: Task[], anchorId: string): InsertAfterPlan | null {
  const ordered = [...siblings].sort(byOrder)
  const idx = ordered.findIndex((t) => t.id === anchorId)
  if (idx === -1) return null
  const shifts = ordered
    .slice(idx + 1)
    // `+ 2` : le rang final d'un frère qui suit est son index dans la fratrie triée
    // (`idx + 1 + i`) décalé d'un cran par la nouvelle tâche.
    .map((t, i) => ({ taskId: t.id, sortOrder: idx + 2 + i }))
    .filter((o) => siblings.find((t) => t.id === o.taskId)!.sortOrder !== o.sortOrder)
  return { sortOrder: idx + 1, shifts }
}

/**
 * Dates AFFICHÉES de `anchor` : pour un groupe non vide, l'empan de ses enfants, et non ses
 * dates stockées.
 *
 * Les deux diffèrent : `computeLayout` recalcule l'empan d'un groupe à chaque rendu et ne
 * réécrit jamais les colonnes `start_date` / `end_date` de la ligne. Enchaîner une tâche
 * « après » un groupe à partir de ses dates stockées la placerait donc à une date que personne
 * n'a jamais vue à l'écran (celle de la création du groupe, typiquement).
 */
export function anchorBounds(tasks: Task[], anchor: Task): Dated {
  if (anchor.type === 'group') {
    const bounds = groupBounds(tasks.filter((t) => t.parentId === anchor.id))
    if (bounds) return bounds
  }
  return { startDate: anchor.startDate, endDate: anchor.endDate }
}
