import { rowToTask, rowToDependency, taskToRow, patchToRow, createSupabaseRepository } from '@/lib/gantt/repository'
import { makeTask, makeDep } from './fixtures'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

describe('mappers', () => {
  it('rowToTask ↔ taskToRow sont inverses (hors created_at)', () => {
    const task = makeTask({ id: 'x', parentId: 'g', assigneeId: 'u1' })
    const row = taskToRow(task)
    expect(row).toMatchObject({
      id: 'x',
      project_id: 'p1',
      parent_id: 'g',
      start_date: task.startDate,
      end_date: task.endDate,
      assignee_id: 'u1',
      sort_order: task.sortOrder,
    })
    expect(
      rowToTask({ ...row, created_at: 'c', updated_at: task.updatedAt } as Parameters<typeof rowToTask>[0]),
    ).toEqual(task)
  })

  it('patchToRow ne mappe que les clés présentes', () => {
    expect(patchToRow({ startDate: '2026-09-01', collapsed: true })).toEqual({ start_date: '2026-09-01', collapsed: true })
    expect(patchToRow({})).toEqual({})
  })

  it('rowToDependency', () => {
    expect(rowToDependency({ id: 'd', project_id: 'p', from_task_id: 'a', to_task_id: 'b' })).toEqual({
      id: 'd',
      projectId: 'p',
      fromTaskId: 'a',
      toTaskId: 'b',
    })
  })
})

// Client Supabase factice : `insert`/`update`/`delete` renvoient des thenables imitant le
// query builder Supabase. `update`/`delete` supportent `{ count: 'exact' }` puis `.eq(...)`
// qui exécute réellement la requête — c'est ce couple qu'on doit contrôler dans les tests.
interface FakeResult {
  error: { message: string } | null
  count?: number | null
}

function makeFakeClient(resultByTable: Record<string, FakeResult | FakeResult[]>) {
  const calls: { table: string; op: string; arg?: unknown; id?: string }[] = []
  const nextResult = (table: string): FakeResult => {
    const r = resultByTable[table]
    if (Array.isArray(r)) {
      const next = r.shift()
      if (!next) throw new Error(`plus de résultat factice pour ${table}`)
      return next
    }
    return r
  }
  const from = vi.fn((table: string) => ({
    insert: vi.fn(async (arg: unknown) => {
      calls.push({ table, op: 'insert', arg })
      return nextResult(table)
    }),
    update: vi.fn((arg: unknown) => ({
      eq: vi.fn(async (_col: string, id: string) => {
        calls.push({ table, op: 'update', arg, id })
        return nextResult(table)
      }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(async (_col: string, id: string) => {
        calls.push({ table, op: 'delete', id })
        return nextResult(table)
      }),
    })),
  }))
  return { client: { from } as unknown as SupabaseClient<Database>, calls }
}

describe('createSupabaseRepository', () => {
  it('insertTask : réussit quand error est null', async () => {
    const { client } = makeFakeClient({ tasks: { error: null } })
    const repo = createSupabaseRepository(client)
    await expect(repo.insertTask(makeTask())).resolves.toBeUndefined()
  })

  it('insertTask : échoue quand error est renvoyée', async () => {
    const { client } = makeFakeClient({ tasks: { error: { message: 'boom' } } })
    const repo = createSupabaseRepository(client)
    await expect(repo.insertTask(makeTask())).rejects.toThrow('boom')
  })

  it('updateTask : réussit quand count vaut exactement 1', async () => {
    const { client } = makeFakeClient({ tasks: { error: null, count: 1 } })
    const repo = createSupabaseRepository(client)
    await expect(repo.updateTask('t1', { title: 'x' })).resolves.toBeUndefined()
  })

  it('updateTask : échoue quand count vaut 0 (RLS a refusé)', async () => {
    const { client } = makeFakeClient({ tasks: { error: null, count: 0 } })
    const repo = createSupabaseRepository(client)
    await expect(repo.updateTask('t1', { title: 'x' })).rejects.toThrow()
  })

  // Point de vigilance central : `count` peut valoir `null` (en-tête content-range absente
  // de la réponse PostgREST) sans qu'il y ait d'`error`. `count === 0` laisserait passer ce
  // cas comme un faux succès silencieux — la requête doit rejeter tout ce qui n'est pas
  // strictement égal à 1.
  it('updateTask : échoue quand count vaut null (en-tête content-range absente)', async () => {
    const { client } = makeFakeClient({ tasks: { error: null, count: null } })
    const repo = createSupabaseRepository(client)
    await expect(repo.updateTask('t1', { title: 'x' })).rejects.toThrow()
  })

  it('deleteTask : échoue quand count vaut null', async () => {
    const { client } = makeFakeClient({ tasks: { error: null, count: null } })
    const repo = createSupabaseRepository(client)
    await expect(repo.deleteTask('t1')).rejects.toThrow()
  })

  it('deleteTask : réussit quand count vaut exactement 1', async () => {
    const { client } = makeFakeClient({ tasks: { error: null, count: 1 } })
    const repo = createSupabaseRepository(client)
    await expect(repo.deleteTask('t1')).resolves.toBeUndefined()
  })

  it('insertDependency : réussit quand error est null', async () => {
    const { client } = makeFakeClient({ dependencies: { error: null } })
    const repo = createSupabaseRepository(client)
    await expect(repo.insertDependency(makeDep('a', 'b'))).resolves.toBeUndefined()
  })

  it('deleteDependency : échoue quand count vaut null', async () => {
    const { client } = makeFakeClient({ dependencies: { error: null, count: null } })
    const repo = createSupabaseRepository(client)
    await expect(repo.deleteDependency('d1')).rejects.toThrow()
  })

  it('deleteDependency : réussit quand count vaut exactement 1', async () => {
    const { client } = makeFakeClient({ dependencies: { error: null, count: 1 } })
    const repo = createSupabaseRepository(client)
    await expect(repo.deleteDependency('d1')).resolves.toBeUndefined()
  })

  it('reorderTasks : réussit quand chaque écriture affecte exactement 1 ligne', async () => {
    const { client } = makeFakeClient({
      tasks: [
        { error: null, count: 1 },
        { error: null, count: 1 },
      ],
    })
    const repo = createSupabaseRepository(client)
    await expect(
      repo.reorderTasks([
        { taskId: 't1', sortOrder: 0 },
        { taskId: 't2', sortOrder: 1 },
      ]),
    ).resolves.toBeUndefined()
  })

  it('reorderTasks : échoue si une seule des écritures a un count null (RLS a refusé une ligne)', async () => {
    const { client } = makeFakeClient({
      tasks: [
        { error: null, count: 1 },
        { error: null, count: null },
      ],
    })
    const repo = createSupabaseRepository(client)
    await expect(
      repo.reorderTasks([
        { taskId: 't1', sortOrder: 0 },
        { taskId: 't2', sortOrder: 1 },
      ]),
    ).rejects.toThrow()
  })
})
