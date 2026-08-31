import { applyEvent, indexById } from '@/lib/gantt/events'
import { makeTask, makeDep } from './fixtures'

const g = makeTask({ id: 'g', type: 'group' })
const c = makeTask({ id: 'c', parentId: 'g' })
const r = makeTask({ id: 'r' })
const base = { tasks: indexById([g, c, r]), dependencies: indexById([makeDep('c', 'r'), makeDep('r', 'g')]) }

describe('applyEvent', () => {
  it('task.created ajoute la tâche sans muter l\'état d\'origine', () => {
    const next = applyEvent(base, { type: 'task.created', task: makeTask({ id: 'n' }) })
    expect(next.tasks.n).toBeDefined()
    expect(base.tasks.n).toBeUndefined()
  })
  it('task.updated fusionne le patch', () => {
    const next = applyEvent(base, { type: 'task.updated', taskId: 'r', patch: { title: 'X', progress: 50 } })
    expect(next.tasks.r).toMatchObject({ title: 'X', progress: 50, id: 'r' })
  })
  it('task.updated ignore un id inconnu', () => {
    expect(applyEvent(base, { type: 'task.updated', taskId: 'zz', patch: { title: 'X' } })).toBe(base)
  })
  it('task.deleted supprime la tâche, ses enfants et les dépendances liées', () => {
    const next = applyEvent(base, { type: 'task.deleted', taskId: 'g' })
    expect(Object.keys(next.tasks)).toEqual(['r'])
    expect(Object.keys(next.dependencies)).toEqual([])
  })
  it('dependency.created / deleted', () => {
    const d = makeDep('g', 'r', 'x')
    const withDep = applyEvent(base, { type: 'dependency.created', dependency: d })
    expect(withDep.dependencies.x).toEqual(d)
    expect(applyEvent(withDep, { type: 'dependency.deleted', dependencyId: 'x' }).dependencies.x).toBeUndefined()
  })
  it('tasks.reordered met à jour sortOrder', () => {
    const next = applyEvent(base, { type: 'tasks.reordered', order: [{ taskId: 'r', sortOrder: 0 }, { taskId: 'g', sortOrder: 1 }] })
    expect(next.tasks.r.sortOrder).toBe(0)
    expect(next.tasks.g.sortOrder).toBe(1)
  })
})
