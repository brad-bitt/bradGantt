import type { StoreApi } from 'zustand'
import type { GanttState } from './store'
import type { GanttRepository } from './repository'
import type { GanttEvent } from './events'
import type { Task, TaskType } from './types'
import { checkLink, LINK_ERRORS, nextSortOrder, planInsertAfter, reorderSiblings, resizeDates, shiftDates, siblingsOf } from './scheduling'
import { nextColor } from './palette'
import { createRunner } from '@/lib/optimistic/run'

export const PERSIST_ERROR = 'Modification non enregistrée'
export const UNKNOWN_TASK_ERROR = 'Tâche introuvable'

export interface CreateTaskInput {
  title: string
  type: TaskType
  startDate: string
  endDate: string
  parentId?: string | null
  color?: string
  assigneeId?: string | null
  progress?: number
  /**
   * Enchaînement : la tâche est rangée JUSTE APRÈS `taskId` dans la fratrie au lieu d'être
   * ajoutée en fin de liste, et une dépendance `taskId → nouvelle tâche` est créée si `link`.
   *
   * L'ancre doit être un frère (même `parentId`) : autrement l'insertion n'a pas de sens dans
   * l'ordre d'affichage, et la commande se rabat silencieusement sur l'ajout en fin.
   */
  after?: { taskId: string; link: boolean }
}

export interface GanttCommands {
  createTask(input: CreateTaskInput): Promise<Task | null>
  updateTask(taskId: string, patch: Partial<Omit<Task, 'id' | 'projectId'>>): Promise<boolean>
  moveTask(taskId: string, deltaDays: number): Promise<boolean>
  resizeTask(taskId: string, edge: 'start' | 'end', deltaDays: number): Promise<boolean>
  deleteTask(taskId: string): Promise<boolean>
  linkTasks(fromId: string, toId: string): Promise<boolean>
  unlinkTasks(depId: string): Promise<boolean>
  toggleGroup(groupId: string): Promise<boolean>
  reorderTask(taskId: string, targetIndex: number): Promise<boolean>
  /** Copie d'une tâche ou d'un jalon, rangée juste après l'original. Refusé pour un groupe. */
  duplicateTask(taskId: string): Promise<Task | null>
}

export interface CommandDeps {
  store: StoreApi<GanttState>
  repo: GanttRepository
  notify: (message: string) => void
  newId?: () => string
  now?: () => string
}

type TaskPatch = Partial<Omit<Task, 'id' | 'projectId'>>

export function createCommands({ store, repo, notify, newId = () => crypto.randomUUID(), now = () => new Date().toISOString() }: CommandDeps): GanttCommands {
  const run = createRunner<GanttEvent>({ store, notify, errorMessage: PERSIST_ERROR })

  const allTasks = () => Object.values(store.getState().tasks)
  const allDeps = () => Object.values(store.getState().dependencies)

  /** Construit l'événement de mise à jour et son inverse (valeurs précédentes des seuls champs touchés). */
  function buildUpdate(taskId: string, businessPatch: TaskPatch): { forward: GanttEvent; inverse: GanttEvent[] } | null {
    const before = store.getState().tasks[taskId]
    if (!before) return null
    const patch: TaskPatch = { ...businessPatch, updatedAt: now() }
    const inversePatch: Record<string, unknown> = {}
    for (const key of Object.keys(patch)) {
      inversePatch[key] = (before as unknown as Record<string, unknown>)[key]
    }
    return {
      forward: { type: 'task.updated', taskId, patch },
      inverse: [{ type: 'task.updated', taskId, patch: inversePatch as TaskPatch }],
    }
  }

  // Objet nommé et non littéral retourné à la volée : `duplicateTask` appelle `createTask`, et
  // une référence explicite survit à une déstructuration (`const { duplicateTask } = cmd`) là où
  // `this` ne survivrait pas.
  const commands: GanttCommands = {
    async createTask(input) {
      const s = store.getState()
      const parentId = input.type === 'group' ? null : (input.parentId ?? null)
      const endDate = input.type === 'milestone' ? input.startDate : input.endDate
      const siblings = siblingsOf(allTasks(), { parentId })
      // `null` dès que l'ancre n'est pas (ou n'est plus) dans cette fratrie : elle a pu être
      // supprimée par un autre membre pendant que la modale était ouverte. On ajoute alors en
      // fin de liste plutôt que de refuser une création par ailleurs valide.
      const plan = input.after ? planInsertAfter(siblings, input.after.taskId) : null
      const task: Task = {
        id: newId(),
        projectId: s.projectId,
        parentId,
        title: input.title.trim(),
        type: input.type,
        startDate: input.startDate,
        endDate,
        progress: input.progress ?? 0,
        color: input.color ?? nextColor(allTasks().map((t) => t.color)),
        assigneeId: input.assigneeId ?? null,
        sortOrder: plan ? plan.sortOrder : nextSortOrder(siblings),
        collapsed: false,
        updatedAt: now(),
      }
      const forward: GanttEvent[] = [{ type: 'task.created', task }]
      // `cascade: false` : défaire la création ne doit retirer QUE cette tâche. Une
      // suppression cascadante emporterait ce que l'utilisateur y a rattaché pendant
      // l'écriture (une tâche existante rangée dans le groupe qu'on est en train de
      // créer, par exemple) — des entités bien présentes en base disparaîtraient de
      // l'écran, exactement le défaut que le rollback ciblé corrige.
      const inverse: GanttEvent[] = [{ type: 'task.deleted', taskId: task.id, cascade: false }]

      if (plan && plan.shifts.length > 0) {
        forward.push({ type: 'tasks.reordered', order: plan.shifts })
        // Rangs D'AVANT, relevés sur le store et non recalculés : le rollback doit rendre la
        // fratrie telle qu'elle était, y compris si ses rangs étaient troués.
        inverse.push({
          type: 'tasks.reordered',
          order: plan.shifts.map((o) => ({ taskId: o.taskId, sortOrder: s.tasks[o.taskId].sortOrder })),
        })
      }
      // Le lien n'est créé que s'il est demandé ET recevable : une ancre déjà liée à cette
      // tâche est impossible (elle vient de naître), mais `checkLink` reste le seul endroit
      // qui décide, et une insertion refusée ne doit pas faire échouer la création elle-même.
      const dependency =
        input.after?.link && plan && checkLink(allDeps(), input.after.taskId, task.id).ok
          ? { id: newId(), projectId: s.projectId, fromTaskId: input.after.taskId, toTaskId: task.id }
          : null
      if (dependency) {
        forward.push({ type: 'dependency.created', dependency })
        inverse.push({ type: 'dependency.deleted', dependencyId: dependency.id })
      }

      const ok = await run(forward, inverse, async () => {
        // Écritures SÉQUENTIELLES et dans cet ordre : la dépendance référence la tâche, qui
        // doit donc exister en base avant elle (contrainte de clé étrangère). Même limite que
        // `reorderTasks` : ce n'est pas une transaction, un échec en cours de route laisse la
        // base partiellement écrite jusqu'au prochain rechargement.
        await repo.insertTask(task)
        if (plan && plan.shifts.length > 0) await repo.reorderTasks(plan.shifts)
        if (dependency) await repo.insertDependency(dependency)
      })
      return ok ? task : null
    },

    updateTask(taskId, patch) {
      if (Object.keys(patch).length === 0) return Promise.resolve(false)
      const built = buildUpdate(taskId, patch)
      if (!built) return Promise.resolve(false)
      return run(built.forward, built.inverse, () => repo.updateTask(taskId, patch))
    },

    moveTask(taskId, deltaDays) {
      const t = store.getState().tasks[taskId]
      if (!t || t.type === 'group' || deltaDays === 0) return Promise.resolve(false)
      const patch = shiftDates(t, deltaDays)
      const built = buildUpdate(taskId, patch)!
      return run(built.forward, built.inverse, () => repo.updateTask(taskId, patch))
    },

    resizeTask(taskId, edge, deltaDays) {
      const t = store.getState().tasks[taskId]
      if (!t || t.type !== 'task' || deltaDays === 0) return Promise.resolve(false)
      const patch = resizeDates(t, edge, deltaDays)
      if (patch.startDate === t.startDate && patch.endDate === t.endDate) return Promise.resolve(false)
      const built = buildUpdate(taskId, patch)!
      return run(built.forward, built.inverse, () => repo.updateTask(taskId, patch))
    },

    deleteTask(taskId) {
      const target = store.getState().tasks[taskId]
      if (!target) return Promise.resolve(false)
      const children = allTasks().filter((t) => t.parentId === taskId)
      const removedIds = new Set<string>([taskId, ...children.map((c) => c.id)])
      const removedDeps = allDeps().filter((d) => removedIds.has(d.fromTaskId) || removedIds.has(d.toTaskId))
      const inverse: GanttEvent[] = [
        { type: 'task.created', task: target },
        ...children.map((task): GanttEvent => ({ type: 'task.created', task })),
        ...removedDeps.map((dependency): GanttEvent => ({ type: 'dependency.created', dependency })),
      ]
      return run({ type: 'task.deleted', taskId }, inverse, () => repo.deleteTask(taskId))
    },

    linkTasks(fromId, toId) {
      const tasks = store.getState().tasks
      if (!tasks[fromId] || !tasks[toId]) {
        notify(UNKNOWN_TASK_ERROR)
        return Promise.resolve(false)
      }
      const check = checkLink(allDeps(), fromId, toId)
      if (!check.ok) { notify(LINK_ERRORS[check.reason]); return Promise.resolve(false) }
      const dependency = { id: newId(), projectId: store.getState().projectId, fromTaskId: fromId, toTaskId: toId }
      return run(
        { type: 'dependency.created', dependency },
        [{ type: 'dependency.deleted', dependencyId: dependency.id }],
        () => repo.insertDependency(dependency),
      )
    },

    unlinkTasks(depId) {
      const dependency = store.getState().dependencies[depId]
      if (!dependency) return Promise.resolve(false)
      return run(
        { type: 'dependency.deleted', dependencyId: depId },
        [{ type: 'dependency.created', dependency }],
        () => repo.deleteDependency(depId),
      )
    },

    toggleGroup(groupId) {
      const g = store.getState().tasks[groupId]
      if (!g || g.type !== 'group') return Promise.resolve(false)
      const patch = { collapsed: !g.collapsed }
      const built = buildUpdate(groupId, patch)!
      return run(built.forward, built.inverse, () => repo.updateTask(groupId, patch))
    },

    async duplicateTask(taskId) {
      const t = store.getState().tasks[taskId]
      // Un groupe ne se duplique pas : copier son contenant sans ses enfants donnerait un groupe
      // vide au même nom, et copier les enfants relève d'une autre commande.
      if (!t || t.type === 'group') return null
      return commands.createTask({
        title: `${t.title} (copie)`,
        type: t.type,
        startDate: t.startDate,
        endDate: t.endDate,
        color: t.color,
        assigneeId: t.assigneeId,
        progress: t.progress,
        parentId: t.parentId,
        // Rangée juste après l'original, sans flèche : une copie n'attend pas son modèle.
        after: { taskId: t.id, link: false },
      })
    },

    reorderTask(taskId, targetIndex) {
      const t = store.getState().tasks[taskId]
      if (!t) return Promise.resolve(false)
      const tasksBefore = store.getState().tasks
      const order = reorderSiblings(siblingsOf(allTasks(), t), taskId, targetIndex)
      const changed = order.some((o) => tasksBefore[o.taskId]?.sortOrder !== o.sortOrder)
      if (!changed) return Promise.resolve(false)
      const inverseOrder = order.map((o) => ({ taskId: o.taskId, sortOrder: tasksBefore[o.taskId]!.sortOrder }))
      return run(
        { type: 'tasks.reordered', order },
        [{ type: 'tasks.reordered', order: inverseOrder }],
        () => repo.reorderTasks(order),
      )
    },
  }
  return commands
}
