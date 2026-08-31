import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'
import type { Dependency, Task } from './types'

export interface GanttRepository {
  insertTask(task: Task): Promise<void>
  updateTask(taskId: string, patch: Partial<Task>): Promise<void>
  deleteTask(taskId: string): Promise<void>
  insertDependency(dep: Dependency): Promise<void>
  deleteDependency(depId: string): Promise<void>
  reorderTasks(order: { taskId: string; sortOrder: number }[]): Promise<void>
}

export function rowToTask(row: Tables<'tasks'>): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    progress: row.progress,
    color: row.color,
    assigneeId: row.assignee_id,
    sortOrder: row.sort_order,
    collapsed: row.collapsed,
    updatedAt: row.updated_at,
  }
}

export function rowToDependency(row: Tables<'dependencies'>): Dependency {
  return { id: row.id, projectId: row.project_id, fromTaskId: row.from_task_id, toTaskId: row.to_task_id }
}

export function taskToRow(t: Task): TablesInsert<'tasks'> {
  return {
    id: t.id,
    project_id: t.projectId,
    parent_id: t.parentId,
    title: t.title,
    type: t.type,
    start_date: t.startDate,
    end_date: t.endDate,
    progress: t.progress,
    color: t.color,
    assignee_id: t.assigneeId,
    sort_order: t.sortOrder,
    collapsed: t.collapsed,
  }
}

const COLUMN: { [K in keyof Task]?: keyof TablesUpdate<'tasks'> } = {
  parentId: 'parent_id',
  title: 'title',
  type: 'type',
  startDate: 'start_date',
  endDate: 'end_date',
  progress: 'progress',
  color: 'color',
  assigneeId: 'assignee_id',
  sortOrder: 'sort_order',
  collapsed: 'collapsed',
}

export function patchToRow(patch: Partial<Task>): TablesUpdate<'tasks'> {
  const row: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(COLUMN) as [keyof Task, string][]) {
    if (key in patch && patch[key] !== undefined) row[col] = patch[key]
  }
  return row as TablesUpdate<'tasks'>
}

export function createSupabaseRepository(client: SupabaseClient<Database>): GanttRepository {
  // `.eq('id', …)` cible au plus une ligne : `count` doit valoir exactement 1 en cas de
  // succès réel. Rejeter tout ce qui n'est pas strictement égal à 1 (formulation fermée) est
  // indispensable : `count === 0` laisserait passer un `count` null — en-tête content-range
  // absente de la réponse PostgREST — comme un faux succès, alors que la RLS a en réalité
  // refusé l'écriture en silence (aucune erreur levée par UPDATE/DELETE filtrés par une
  // policy USING).
  const check = (error: { message: string } | null, count?: number | null) => {
    if (error) throw new Error(error.message)
    if (count !== undefined && count !== 1) throw new Error('no_row_affected')
  }
  return {
    async insertTask(task) {
      const { error } = await client.from('tasks').insert(taskToRow(task))
      check(error)
    },
    async updateTask(taskId, patch) {
      const { error, count } = await client.from('tasks').update(patchToRow(patch), { count: 'exact' }).eq('id', taskId)
      check(error, count)
    },
    async deleteTask(taskId) {
      const { error, count } = await client.from('tasks').delete({ count: 'exact' }).eq('id', taskId)
      check(error, count)
    },
    async insertDependency(dep) {
      const { error } = await client
        .from('dependencies')
        .insert({ id: dep.id, project_id: dep.projectId, from_task_id: dep.fromTaskId, to_task_id: dep.toTaskId })
      check(error)
    },
    async deleteDependency(depId) {
      const { error, count } = await client.from('dependencies').delete({ count: 'exact' }).eq('id', depId)
      check(error, count)
    },
    async reorderTasks(order) {
      const results = await Promise.all(
        order.map((o) => client.from('tasks').update({ sort_order: o.sortOrder }, { count: 'exact' }).eq('id', o.taskId)),
      )
      for (const r of results) check(r.error, r.count)
    },
  }
}
