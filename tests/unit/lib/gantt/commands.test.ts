import { createCommands, PERSIST_ERROR } from '@/lib/gantt/commands'
import { useGanttStore } from '@/lib/gantt/store'
import type { GanttRepository } from '@/lib/gantt/repository'
import { LINK_ERRORS } from '@/lib/gantt/scheduling'
import { makeTask, makeDep } from './fixtures'

function fakeRepo(overrides: Partial<GanttRepository> = {}): GanttRepository {
  return {
    insertTask: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    insertDependency: vi.fn().mockResolvedValue(undefined),
    deleteDependency: vi.fn().mockResolvedValue(undefined),
    reorderTasks: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const g = makeTask({ id: 'g', type: 'group', sortOrder: 0 })
const a = makeTask({ id: 'a', parentId: 'g', sortOrder: 0, startDate: '2026-09-01', endDate: '2026-09-03' })
const b = makeTask({ id: 'b', parentId: 'g', sortOrder: 1 })
const m = makeTask({ id: 'm', type: 'milestone', startDate: '2026-09-10', endDate: '2026-09-10', sortOrder: 1 })

function setup(repo = fakeRepo()) {
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-08-31',
    tasks: [g, a, b, m], dependencies: [makeDep('a', 'b')],
  })
  const notify = vi.fn()
  const cmd = createCommands({ store: useGanttStore, repo, notify, newId: () => 'new-id', now: () => '2026-08-31T10:00:00Z' })
  return { cmd, repo, notify }
}

describe('createTask', () => {
  it('ajoute au store, persiste, choisit couleur et sortOrder', async () => {
    const { cmd, repo } = setup()
    const t = await cmd.createTask({ title: 'N', type: 'task', startDate: '2026-09-01', endDate: '2026-09-02' })
    expect(t).toMatchObject({ id: 'new-id', projectId: 'p1', sortOrder: 2, parentId: null })
    expect(useGanttStore.getState().tasks['new-id']).toBeDefined()
    expect(repo.insertTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id' }))
  })
  it('force endDate = startDate pour un jalon', async () => {
    const { cmd } = setup()
    const t = await cmd.createTask({ title: 'J', type: 'milestone', startDate: '2026-09-01', endDate: '2026-09-09' })
    expect(t?.endDate).toBe('2026-09-01')
  })
  it('rollback + toast si la persistance échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ insertTask: vi.fn().mockRejectedValue(new Error('boom')) }))
    const t = await cmd.createTask({ title: 'N', type: 'task', startDate: '2026-09-01', endDate: '2026-09-02' })
    expect(t).toBeNull()
    expect(useGanttStore.getState().tasks['new-id']).toBeUndefined()
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})

describe('moveTask / resizeTask', () => {
  it('décale les dates et persiste le patch', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.moveTask('a', 2)).toBe(true)
    expect(useGanttStore.getState().tasks.a).toMatchObject({ startDate: '2026-09-03', endDate: '2026-09-05' })
    expect(repo.updateTask).toHaveBeenCalledWith('a', { startDate: '2026-09-03', endDate: '2026-09-05' })
  })
  it('ignore un groupe et un delta nul', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.moveTask('g', 2)).toBe(false)
    expect(await cmd.moveTask('a', 0)).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('resize ignore un jalon', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.resizeTask('m', 'end', 3)).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('rollback si échec', async () => {
    const { cmd } = setup(fakeRepo({ updateTask: vi.fn().mockRejectedValue(new Error('x')) }))
    await cmd.moveTask('a', 2)
    expect(useGanttStore.getState().tasks.a.startDate).toBe('2026-09-01')
  })
})

describe('deleteTask', () => {
  it('supprime en cascade dans le store et persiste', async () => {
    const { cmd, repo } = setup()
    await cmd.deleteTask('g')
    expect(Object.keys(useGanttStore.getState().tasks)).toEqual(['m'])
    expect(repo.deleteTask).toHaveBeenCalledWith('g')
  })
})

describe('linkTasks / unlinkTasks', () => {
  it('crée une dépendance valide', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.linkTasks('b', 'm')).toBe(true)
    expect(repo.insertDependency).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', fromTaskId: 'b', toTaskId: 'm' }))
  })
  it('refuse un cycle avec le message dédié, sans toucher au store', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.linkTasks('b', 'a')).toBe(false)
    expect(notify).toHaveBeenCalledWith(LINK_ERRORS.cycle)
    expect(repo.insertDependency).not.toHaveBeenCalled()
  })
  it('unlink supprime et persiste', async () => {
    const { cmd, repo } = setup()
    await cmd.unlinkTasks('a->b')
    expect(useGanttStore.getState().dependencies['a->b']).toBeUndefined()
    expect(repo.deleteDependency).toHaveBeenCalledWith('a->b')
  })
})

describe('toggleGroup / reorderTask', () => {
  it('toggleGroup inverse collapsed', async () => {
    const { cmd, repo } = setup()
    await cmd.toggleGroup('g')
    expect(useGanttStore.getState().tasks.g.collapsed).toBe(true)
    expect(repo.updateTask).toHaveBeenCalledWith('g', { collapsed: true })
  })
  it('reorderTask renumérote les frères', async () => {
    const { cmd, repo } = setup()
    await cmd.reorderTask('b', 0)
    expect(useGanttStore.getState().tasks.b.sortOrder).toBe(0)
    expect(useGanttStore.getState().tasks.a.sortOrder).toBe(1)
    expect(repo.reorderTasks).toHaveBeenCalledWith([{ taskId: 'b', sortOrder: 0 }, { taskId: 'a', sortOrder: 1 }])
  })
})
