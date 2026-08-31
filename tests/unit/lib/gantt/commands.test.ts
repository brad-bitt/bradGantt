import { createCommands, PERSIST_ERROR, UNKNOWN_TASK_ERROR } from '@/lib/gantt/commands'
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

/** Promesse contrôlable manuellement, pour simuler une écriture lente dont on décide de l'issue. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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
    const { cmd, repo, notify } = setup()
    const t = await cmd.createTask({ title: 'N', type: 'task', startDate: '2026-09-01', endDate: '2026-09-02' })
    expect(t).toMatchObject({ id: 'new-id', projectId: 'p1', sortOrder: 2, parentId: null })
    expect(useGanttStore.getState().tasks['new-id']).toBeDefined()
    expect(repo.insertTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id' }))
    expect(notify).not.toHaveBeenCalled()
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

describe('updateTask', () => {
  it('applique un patch, persiste et pose l\'horodatage injecté', async () => {
    const { cmd, repo } = setup()
    const ok = await cmd.updateTask('a', { title: 'Nouveau titre' })
    expect(ok).toBe(true)
    expect(useGanttStore.getState().tasks.a.title).toBe('Nouveau titre')
    expect(useGanttStore.getState().tasks.a.updatedAt).toBe('2026-08-31T10:00:00Z')
    expect(repo.updateTask).toHaveBeenCalledWith('a', { title: 'Nouveau titre' })
  })
  it('ignore un patch vide (aucune écriture)', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.updateTask('a', {})).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('ignore une tâche inconnue', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.updateTask('inconnue', { title: 'x' })).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('rollback restaure uniquement les champs modifiés (pas tout l\'objet)', async () => {
    const { cmd } = setup(fakeRepo({ updateTask: vi.fn().mockRejectedValue(new Error('boom')) }))
    const before = useGanttStore.getState().tasks.a
    const ok = await cmd.updateTask('a', { title: 'Autre titre', progress: 50 })
    expect(ok).toBe(false)
    const after = useGanttStore.getState().tasks.a
    expect(after.title).toBe(before.title)
    expect(after.progress).toBe(before.progress)
    expect(after.updatedAt).toBe(before.updatedAt)
  })
})

describe('moveTask / resizeTask', () => {
  it('décale les dates, persiste le patch et pose l\'horodatage injecté', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.moveTask('a', 2)).toBe(true)
    expect(useGanttStore.getState().tasks.a).toMatchObject({ startDate: '2026-09-03', endDate: '2026-09-05' })
    expect(useGanttStore.getState().tasks.a.updatedAt).toBe('2026-08-31T10:00:00Z')
    expect(repo.updateTask).toHaveBeenCalledWith('a', { startDate: '2026-09-03', endDate: '2026-09-05' })
    expect(notify).not.toHaveBeenCalled()
  })
  it('ignore un groupe et un delta nul', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.moveTask('g', 2)).toBe(false)
    expect(await cmd.moveTask('a', 0)).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('resize ignore un jalon et un groupe', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.resizeTask('m', 'end', 3)).toBe(false)
    expect(await cmd.resizeTask('g', 'end', 3)).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('rollback si échec', async () => {
    const { cmd, notify } = setup(fakeRepo({ updateTask: vi.fn().mockRejectedValue(new Error('x')) }))
    await cmd.moveTask('a', 2)
    expect(useGanttStore.getState().tasks.a.startDate).toBe('2026-09-01')
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})

describe('deleteTask', () => {
  it('supprime en cascade dans le store et persiste', async () => {
    const { cmd, repo } = setup()
    await cmd.deleteTask('g')
    expect(Object.keys(useGanttStore.getState().tasks).sort()).toEqual(['m'])
    expect(repo.deleteTask).toHaveBeenCalledWith('g')
  })
  it('rollback restaure la tâche, ses enfants et les dépendances qui les touchaient', async () => {
    const { cmd, notify } = setup(fakeRepo({ deleteTask: vi.fn().mockRejectedValue(new Error('boom')) }))
    const ok = await cmd.deleteTask('g')
    expect(ok).toBe(false)
    expect(Object.keys(useGanttStore.getState().tasks).sort()).toEqual(['a', 'b', 'g', 'm'])
    expect(useGanttStore.getState().dependencies['a->b']).toBeDefined()
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})

describe('linkTasks / unlinkTasks', () => {
  it('crée une dépendance valide', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.linkTasks('b', 'm')).toBe(true)
    expect(repo.insertDependency).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', fromTaskId: 'b', toTaskId: 'm' }))
  })
  it('refuse une auto-référence, sans toucher au store', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.linkTasks('a', 'a')).toBe(false)
    expect(notify).toHaveBeenCalledWith(LINK_ERRORS.self)
    expect(repo.insertDependency).not.toHaveBeenCalled()
  })
  it('refuse un doublon, sans toucher au store', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.linkTasks('a', 'b')).toBe(false)
    expect(notify).toHaveBeenCalledWith(LINK_ERRORS.duplicate)
    expect(repo.insertDependency).not.toHaveBeenCalled()
  })
  it('refuse un cycle avec le message dédié, sans toucher au store', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.linkTasks('b', 'a')).toBe(false)
    expect(notify).toHaveBeenCalledWith(LINK_ERRORS.cycle)
    expect(repo.insertDependency).not.toHaveBeenCalled()
  })
  it('refuse une tâche inconnue avec un message dédié, sans toucher au store', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.linkTasks('inconnue', 'b')).toBe(false)
    expect(notify).toHaveBeenCalledWith(UNKNOWN_TASK_ERROR)
    expect(repo.insertDependency).not.toHaveBeenCalled()
    expect(useGanttStore.getState().dependencies['new-id']).toBeUndefined()
  })
  it('rollback si l\'insertion échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ insertDependency: vi.fn().mockRejectedValue(new Error('boom')) }))
    const ok = await cmd.linkTasks('b', 'm')
    expect(ok).toBe(false)
    expect(useGanttStore.getState().dependencies['new-id']).toBeUndefined()
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
  it('unlink supprime et persiste', async () => {
    const { cmd, repo } = setup()
    await cmd.unlinkTasks('a->b')
    expect(useGanttStore.getState().dependencies['a->b']).toBeUndefined()
    expect(repo.deleteDependency).toHaveBeenCalledWith('a->b')
  })
  it('unlink ignore un identifiant inconnu', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.unlinkTasks('nope')).toBe(false)
    expect(repo.deleteDependency).not.toHaveBeenCalled()
  })
  it('unlink rollback restaure la dépendance si la suppression échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ deleteDependency: vi.fn().mockRejectedValue(new Error('boom')) }))
    const ok = await cmd.unlinkTasks('a->b')
    expect(ok).toBe(false)
    expect(useGanttStore.getState().dependencies['a->b']).toBeDefined()
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})

describe('toggleGroup / reorderTask', () => {
  it('toggleGroup inverse collapsed dans les deux sens et pose updatedAt', async () => {
    const { cmd, repo } = setup()
    await cmd.toggleGroup('g')
    expect(useGanttStore.getState().tasks.g.collapsed).toBe(true)
    expect(useGanttStore.getState().tasks.g.updatedAt).toBe('2026-08-31T10:00:00Z')
    await cmd.toggleGroup('g')
    expect(useGanttStore.getState().tasks.g.collapsed).toBe(false)
    expect(repo.updateTask).toHaveBeenNthCalledWith(1, 'g', { collapsed: true })
    expect(repo.updateTask).toHaveBeenNthCalledWith(2, 'g', { collapsed: false })
  })
  it('reorderTask renumérote les frères', async () => {
    const { cmd, repo } = setup()
    await cmd.reorderTask('b', 0)
    expect(useGanttStore.getState().tasks.b.sortOrder).toBe(0)
    expect(useGanttStore.getState().tasks.a.sortOrder).toBe(1)
    expect(repo.reorderTasks).toHaveBeenCalledWith([{ taskId: 'b', sortOrder: 0 }, { taskId: 'a', sortOrder: 1 }])
  })
  it('reorderTask ne persiste rien si la position ne change pas', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.reorderTask('b', 1)).toBe(false)
    expect(repo.reorderTasks).not.toHaveBeenCalled()
  })
})

describe('concurrence : rollback ciblé par événement inverse', () => {
  it('une commande rapide qui réussit survit au rollback d\'une commande lente qui échoue (tâches différentes)', async () => {
    const slow = deferred<void>()
    const repo = fakeRepo({
      updateTask: vi.fn((taskId: string) => (taskId === 'a' ? slow.promise : Promise.resolve())),
    })
    const { cmd } = setup(repo)

    const pendingA = cmd.moveTask('a', 2) // optimiste appliqué, persist en attente (lente)
    const fastOk = await cmd.moveTask('b', 5) // se termine avant que 'a' échoue
    expect(fastOk).toBe(true)
    expect(useGanttStore.getState().tasks.b.startDate).toBe('2026-09-06')

    slow.reject(new Error('boom'))
    const slowOk = await pendingA
    expect(slowOk).toBe(false)

    // 'a' revient à son état d'origine
    expect(useGanttStore.getState().tasks.a.startDate).toBe('2026-09-01')
    // 'b' n'est PAS effacée par le rollback de 'a' : c'est le cœur du correctif
    expect(useGanttStore.getState().tasks.b.startDate).toBe('2026-09-06')
  })

  it('une création réussie survit au rollback d\'une commande lente qui échoue', async () => {
    const slow = deferred<void>()
    const repo = fakeRepo({ updateTask: vi.fn(() => slow.promise) })
    const { cmd } = setup(repo)

    const pendingMove = cmd.moveTask('a', 2)
    const created = await cmd.createTask({ title: 'X', type: 'task', startDate: '2026-09-05', endDate: '2026-09-06' })
    expect(created).not.toBeNull()
    expect(useGanttStore.getState().tasks['new-id']).toBeDefined()

    slow.reject(new Error('boom'))
    await pendingMove

    // la tâche créée avec succès est toujours là : pas de doublon potentiel côté utilisateur
    expect(useGanttStore.getState().tasks['new-id']).toBeDefined()
  })

  it('ne restaure rien si le projet a changé pendant que la commande était en vol', async () => {
    const slow = deferred<void>()
    const repo = fakeRepo({ updateTask: vi.fn(() => slow.promise) })
    const { cmd, notify } = setup(repo)

    const pending = cmd.moveTask('a', 2)
    useGanttStore.getState().hydrate({
      projectId: 'p2', projectName: 'Autre projet', myRole: 'editor', members: [], today: '2026-08-31',
      tasks: [], dependencies: [],
    })

    slow.reject(new Error('boom'))
    const ok = await pending
    expect(ok).toBe(false)
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
    // aucune fuite des données de l'ancien projet dans le projet courant
    expect(Object.keys(useGanttStore.getState().tasks)).toHaveLength(0)
    expect(useGanttStore.getState().projectId).toBe('p2')
  })
})
