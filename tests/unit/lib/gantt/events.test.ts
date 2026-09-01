import { applyEvent, indexById } from '@/lib/gantt/events'
import { makeTask, makeDep } from './fixtures'

const g = makeTask({ id: 'g', type: 'group' })
const c = makeTask({ id: 'c', parentId: 'g' })
const r = makeTask({ id: 'r' })
const base = { tasks: indexById([g, c, r]), dependencies: indexById([makeDep('c', 'r'), makeDep('r', 'g')]) }

function deepFreeze<T>(obj: T): T {
  Object.freeze(obj)
  if (obj !== null && typeof obj === 'object') {
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      if ((obj as Record<string, unknown>)[prop] !== null && typeof (obj as Record<string, unknown>)[prop] === 'object') {
        deepFreeze((obj as Record<string, unknown>)[prop])
      }
    })
  }
  return obj
}

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
  it('task.deleted cascade: false ne retire que la tâche visée et ses propres dépendances', () => {
    const next = applyEvent(base, { type: 'task.deleted', taskId: 'g', cascade: false })
    expect(next.tasks.g).toBeUndefined()
    // l'enfant survit (il redeviendra une racine à l'affichage, buildRows remonte les orphelines)
    expect(next.tasks.c).toBeDefined()
    expect(next.tasks.r).toBeDefined()
    // la dépendance qui touche 'g' part (elle ne peut pas survivre sans elle) ...
    expect(next.dependencies['r->g']).toBeUndefined()
    // ... celle qui ne la touche pas reste
    expect(next.dependencies['c->r']).toBeDefined()
  })
  it('task.deleted ignore un id inconnu (identité référentielle)', () => {
    expect(applyEvent(base, { type: 'task.deleted', taskId: 'zz' })).toBe(base)
  })
  it('dependency.created / deleted', () => {
    const d = makeDep('g', 'r', 'x')
    const withDep = applyEvent(base, { type: 'dependency.created', dependency: d })
    expect(withDep.dependencies.x).toEqual(d)
    expect(applyEvent(withDep, { type: 'dependency.deleted', dependencyId: 'x' }).dependencies.x).toBeUndefined()
  })
  it('dependency.deleted ignore un id inconnu', () => {
    expect(applyEvent(base, { type: 'dependency.deleted', dependencyId: 'zz' })).toBe(base)
  })
  it('tasks.reordered met à jour sortOrder', () => {
    const next = applyEvent(base, { type: 'tasks.reordered', order: [{ taskId: 'r', sortOrder: 0 }, { taskId: 'g', sortOrder: 1 }] })
    expect(next.tasks.r.sortOrder).toBe(0)
    expect(next.tasks.g.sortOrder).toBe(1)
  })
  it('tasks.reordered ignore les ids inconnus et ne crée pas d\'entrées fantômes', () => {
    const next = applyEvent(base, { type: 'tasks.reordered', order: [{ taskId: 'r', sortOrder: 0 }, { taskId: 'zz', sortOrder: 999 }] })
    expect(next.tasks.zz).toBeUndefined()
    expect(next.tasks.r.sortOrder).toBe(0)
  })

  describe('pureté : pas de mutations sur l\'état d\'entrée', () => {
    it('task.created ne mute rien', () => {
      const frozen = deepFreeze(JSON.parse(JSON.stringify(base)))
      applyEvent(frozen, { type: 'task.created', task: makeTask({ id: 'n' }) })
      // Si on arrive ici sans erreur, c'est qu'il n'y a eu aucune tentative de mutation sur frozen
    })
    it('task.updated ne mute rien', () => {
      const frozen = deepFreeze(JSON.parse(JSON.stringify(base)))
      applyEvent(frozen, { type: 'task.updated', taskId: 'r', patch: { title: 'X' } })
    })
    it('task.deleted ne mute rien', () => {
      const frozen = deepFreeze(JSON.parse(JSON.stringify(base)))
      applyEvent(frozen, { type: 'task.deleted', taskId: 'g' })
    })
    it('dependency.created ne mute rien', () => {
      const frozen = deepFreeze(JSON.parse(JSON.stringify(base)))
      applyEvent(frozen, { type: 'dependency.created', dependency: makeDep('g', 'r', 'x') })
    })
    it('dependency.deleted ne mute rien', () => {
      const d1 = makeDep('c', 'r')
      const frozen = deepFreeze(JSON.parse(JSON.stringify({ ...base, dependencies: indexById([d1]) })))
      applyEvent(frozen, { type: 'dependency.deleted', dependencyId: d1.id })
    })
    it('tasks.reordered ne mute rien', () => {
      const frozen = deepFreeze(JSON.parse(JSON.stringify(base)))
      applyEvent(frozen, { type: 'tasks.reordered', order: [{ taskId: 'r', sortOrder: 0 }] })
    })
  })

  describe('robustesse', () => {
    it('suppression d\'un groupe avec plusieurs enfants et dépendances entrecroisées', () => {
      const p = makeTask({ id: 'p', type: 'group' })
      const c1 = makeTask({ id: 'c1', parentId: 'p' })
      const c2 = makeTask({ id: 'c2', parentId: 'p' })
      const external = makeTask({ id: 'ext' })
      const data = {
        tasks: indexById([p, c1, c2, external]),
        dependencies: indexById([
          makeDep('external', 'c1', 'd1'), // entrante sur c1
          makeDep('c1', 'c2', 'd2'), // entre enfants
          makeDep('c2', 'external', 'd3'), // sortante sur c2
        ]),
      }
      const next = applyEvent(data, { type: 'task.deleted', taskId: 'p' })
      expect(Object.keys(next.tasks)).toEqual(['ext'])
      expect(Object.keys(next.dependencies)).toEqual([])
    })
    it('tasks.reordered avec identifiants mélangés valides et inconnus', () => {
      const next = applyEvent(base, {
        type: 'tasks.reordered',
        order: [
          { taskId: 'r', sortOrder: 5 },
          { taskId: 'unknown1', sortOrder: 10 },
          { taskId: 'g', sortOrder: 15 },
          { taskId: 'unknown2', sortOrder: 20 },
        ],
      })
      expect(next.tasks.r.sortOrder).toBe(5)
      expect(next.tasks.g.sortOrder).toBe(15)
      expect(next.tasks.unknown1).toBeUndefined()
      expect(next.tasks.unknown2).toBeUndefined()
    })
    it('dependency.deleted sur un identifiant inconnu ne plante pas', () => {
      expect(() => {
        applyEvent(base, { type: 'dependency.deleted', dependencyId: 'nonexistent-dep-id' })
      }).not.toThrow()
    })
  })
})
