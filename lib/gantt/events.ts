import type { Dependency, GanttData, Task } from './types'

export type GanttEvent =
  | { type: 'task.created'; task: Task }
  | { type: 'task.updated'; taskId: string; patch: Partial<Omit<Task, 'id' | 'projectId'>> }
  | { type: 'task.deleted'; taskId: string }
  | { type: 'dependency.created'; dependency: Dependency }
  | { type: 'dependency.deleted'; dependencyId: string }
  | { type: 'tasks.reordered'; order: { taskId: string; sortOrder: number }[] }

export function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]))
}

export function applyEvent(data: GanttData, event: GanttEvent): GanttData {
  switch (event.type) {
    case 'task.created':
      return { ...data, tasks: { ...data.tasks, [event.task.id]: event.task } }

    case 'task.updated': {
      const current = data.tasks[event.taskId]
      if (!current) return data
      return { ...data, tasks: { ...data.tasks, [event.taskId]: { ...current, ...event.patch } } }
    }

    case 'task.deleted': {
      if (!data.tasks[event.taskId]) return data
      const removed = new Set<string>([event.taskId])
      for (const t of Object.values(data.tasks)) if (t.parentId === event.taskId) removed.add(t.id)
      const tasks = Object.fromEntries(Object.entries(data.tasks).filter(([id]) => !removed.has(id)))
      const dependencies = Object.fromEntries(
        Object.entries(data.dependencies).filter(([, d]) => !removed.has(d.fromTaskId) && !removed.has(d.toTaskId)),
      )
      return { tasks, dependencies }
    }

    case 'dependency.created':
      return { ...data, dependencies: { ...data.dependencies, [event.dependency.id]: event.dependency } }

    case 'dependency.deleted': {
      if (!data.dependencies[event.dependencyId]) return data
      const { [event.dependencyId]: _removed, ...dependencies } = data.dependencies
      return { ...data, dependencies }
    }

    case 'tasks.reordered': {
      const tasks = { ...data.tasks }
      for (const { taskId, sortOrder } of event.order) {
        if (tasks[taskId]) tasks[taskId] = { ...tasks[taskId], sortOrder }
      }
      return { ...data, tasks }
    }
  }
}
