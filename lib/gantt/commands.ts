import type { StoreApi } from 'zustand'
import type { GanttState } from './store'
import type { GanttRepository } from './repository'
import type { GanttEvent } from './events'
import type { Task, TaskType } from './types'
import { checkLink, LINK_ERRORS, nextSortOrder, planInsertAfter, reorderSiblings, resizeDates, shiftDates, siblingsOf } from './scheduling'
import { nextColor } from './palette'

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
  /**
   * Applique l'événement `event` (optimiste), persiste, puis en cas d'échec rejoue `inverse`
   * pour annuler *uniquement* ce que cette commande a fait — jamais un instantané global.
   *
   * Un instantané global casserait dès que deux commandes sont en vol en même temps (un
   * glisser-déposer suivi d'une autre action, typiquement) : le rollback de la première
   * effacerait le travail déjà réussi de la seconde. L'événement inverse, lui, ne touche
   * que les entités que cette commande a modifiées, donc il commute proprement avec le
   * reste — y compris, plus tard, avec des événements distants reçus en temps réel pendant
   * que l'écriture est en vol.
   *
   * Garde-fou de contexte : si les données affichées ont été remplacées pendant que la
   * commande était en vol, on n'annule rien. `epoch` change à chaque `hydrate`, ce qui
   * couvre les deux cas — navigation vers un autre projet (les entités de l'ancien
   * corrompraient le nouveau) et rechargement du même projet (l'état frais vient du
   * serveur, y réinjecter des entités d'avant y ferait réapparaître des fantômes). On
   * signale simplement l'échec.
   */
  async function run(event: GanttEvent | GanttEvent[], inverse: GanttEvent[], persist: () => Promise<void>): Promise<boolean> {
    const epoch = store.getState().epoch
    for (const e of Array.isArray(event) ? event : [event]) store.getState().apply(e)
    try {
      await persist()
      return true
    } catch (err) {
      // Cause technique préservée pour le diagnostic (RLS, réseau, requête) ; le message utilisateur reste générique.
      console.error(err)
      if (store.getState().epoch === epoch) {
        for (const e of inverse) store.getState().apply(e)
      }
      notify(PERSIST_ERROR)
      return false
    }
  }

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

  return {
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
}
