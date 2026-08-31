import type { StoreApi } from 'zustand'
import type { GanttState } from './store'
import type { GanttRepository } from './repository'
import type { GanttEvent } from './events'
import type { Task, TaskType } from './types'
import { checkLink, LINK_ERRORS, nextSortOrder, reorderSiblings, resizeDates, shiftDates, siblingsOf } from './scheduling'
import { nextColor } from './palette'

export const PERSIST_ERROR = 'Modification non enregistrée'

export interface CreateTaskInput {
  title: string
  type: TaskType
  startDate: string
  endDate: string
  parentId?: string | null
  color?: string
  assigneeId?: string | null
  progress?: number
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

export function createCommands({ store, repo, notify, newId = () => crypto.randomUUID(), now = () => new Date().toISOString() }: CommandDeps): GanttCommands {
  /** Applique l'événement (optimiste), persiste, restaure le snapshot en cas d'échec. */
  async function run(event: GanttEvent, persist: () => Promise<void>): Promise<boolean> {
    const { tasks, dependencies } = store.getState()
    store.getState().apply(event)
    try {
      await persist()
      return true
    } catch {
      store.getState().replaceData({ tasks, dependencies })
      notify(PERSIST_ERROR)
      return false
    }
  }

  const allTasks = () => Object.values(store.getState().tasks)
  const allDeps = () => Object.values(store.getState().dependencies)

  return {
    async createTask(input) {
      const s = store.getState()
      const parentId = input.type === 'group' ? null : (input.parentId ?? null)
      const endDate = input.type === 'milestone' ? input.startDate : input.endDate
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
        sortOrder: nextSortOrder(siblingsOf(allTasks(), { parentId })),
        collapsed: false,
        updatedAt: now(),
      }
      const ok = await run({ type: 'task.created', task }, () => repo.insertTask(task))
      return ok ? task : null
    },

    updateTask(taskId, patch) {
      if (!store.getState().tasks[taskId]) return Promise.resolve(false)
      const full = { ...patch, updatedAt: now() }
      return run({ type: 'task.updated', taskId, patch: full }, () => repo.updateTask(taskId, patch))
    },

    moveTask(taskId, deltaDays) {
      const t = store.getState().tasks[taskId]
      if (!t || t.type === 'group' || deltaDays === 0) return Promise.resolve(false)
      const patch = shiftDates(t, deltaDays)
      return run({ type: 'task.updated', taskId, patch: { ...patch, updatedAt: now() } }, () => repo.updateTask(taskId, patch))
    },

    resizeTask(taskId, edge, deltaDays) {
      const t = store.getState().tasks[taskId]
      if (!t || t.type !== 'task' || deltaDays === 0) return Promise.resolve(false)
      const patch = resizeDates(t, edge, deltaDays)
      if (patch.startDate === t.startDate && patch.endDate === t.endDate) return Promise.resolve(false)
      return run({ type: 'task.updated', taskId, patch: { ...patch, updatedAt: now() } }, () => repo.updateTask(taskId, patch))
    },

    deleteTask(taskId) {
      if (!store.getState().tasks[taskId]) return Promise.resolve(false)
      return run({ type: 'task.deleted', taskId }, () => repo.deleteTask(taskId))
    },

    linkTasks(fromId, toId) {
      const check = checkLink(allDeps(), fromId, toId)
      if (!check.ok) { notify(LINK_ERRORS[check.reason]); return Promise.resolve(false) }
      const dependency = { id: newId(), projectId: store.getState().projectId, fromTaskId: fromId, toTaskId: toId }
      return run({ type: 'dependency.created', dependency }, () => repo.insertDependency(dependency))
    },

    unlinkTasks(depId) {
      if (!store.getState().dependencies[depId]) return Promise.resolve(false)
      return run({ type: 'dependency.deleted', dependencyId: depId }, () => repo.deleteDependency(depId))
    },

    toggleGroup(groupId) {
      const g = store.getState().tasks[groupId]
      if (!g || g.type !== 'group') return Promise.resolve(false)
      const patch = { collapsed: !g.collapsed }
      return run({ type: 'task.updated', taskId: groupId, patch }, () => repo.updateTask(groupId, patch))
    },

    reorderTask(taskId, targetIndex) {
      const t = store.getState().tasks[taskId]
      if (!t) return Promise.resolve(false)
      const order = reorderSiblings(siblingsOf(allTasks(), t), taskId, targetIndex)
      return run({ type: 'tasks.reordered', order }, () => repo.reorderTasks(order))
    },
  }
}
