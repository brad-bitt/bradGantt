import type { Dependency, Task } from '@/lib/gantt/types'

let seq = 0
export function makeTask(partial: Partial<Task> = {}): Task {
  seq++
  return {
    id: partial.id ?? `t${seq}`,
    projectId: 'p1',
    parentId: null,
    title: `Tâche ${seq}`,
    type: 'task',
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    progress: 0,
    color: '#FF8A3D',
    assigneeId: null,
    sortOrder: seq,
    collapsed: false,
    updatedAt: '2026-08-31T00:00:00Z',
    ...partial,
  }
}

export function makeDep(fromTaskId: string, toTaskId: string, id = `${fromTaskId}->${toTaskId}`): Dependency {
  return { id, projectId: 'p1', fromTaskId, toTaskId }
}
