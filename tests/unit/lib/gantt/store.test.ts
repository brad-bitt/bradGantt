import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { makeTask, makeDep } from './fixtures'

const payload = {
  projectId: 'p1', projectName: 'Démo', myRole: 'editor' as const, members: [], today: '2026-08-31',
  tasks: [makeTask({ id: 'a' }), makeTask({ id: 'b' })], dependencies: [makeDep('a', 'b')],
}

describe('useGanttStore', () => {
  beforeEach(() => useGanttStore.getState().hydrate(payload))

  it('hydrate indexe tâches et dépendances et remet l\'état d\'interaction à zéro', () => {
    const s = useGanttStore.getState()
    expect(Object.keys(s.tasks)).toEqual(['a', 'b'])
    expect(s.dependencies['a->b']).toBeDefined()
    expect(s.selection).toBeNull()
    expect(s.drag).toBeNull()
    expect(s.editor).toBeNull()
  })
  it('apply passe par applyEvent', () => {
    useGanttStore.getState().apply({ type: 'task.deleted', taskId: 'a' })
    expect(useGanttStore.getState().tasks.a).toBeUndefined()
    expect(Object.keys(useGanttStore.getState().dependencies)).toEqual([])
  })
  it('hydrate incrémente epoch à chaque appel, y compris sur le même projet', () => {
    const before = useGanttStore.getState().epoch
    useGanttStore.getState().hydrate(payload)
    expect(useGanttStore.getState().epoch).toBe(before + 1)
    useGanttStore.getState().hydrate({ ...payload, projectId: 'p2' })
    expect(useGanttStore.getState().epoch).toBe(before + 2)
  })
  it('selectCanEdit', () => {
    expect(selectCanEdit(useGanttStore.getState())).toBe(true)
    useGanttStore.getState().hydrate({ ...payload, myRole: 'viewer' })
    expect(selectCanEdit(useGanttStore.getState())).toBe(false)
  })
  it('setters d\'interaction', () => {
    const s = useGanttStore.getState()
    s.setZoom('week'); s.select({ kind: 'task', id: 'a' }); s.openEditor({ mode: 'edit', taskId: 'a' })
    expect(useGanttStore.getState()).toMatchObject({ zoom: 'week', selection: { kind: 'task', id: 'a' }, editor: { mode: 'edit', taskId: 'a' } })
    useGanttStore.getState().closeEditor()
    expect(useGanttStore.getState().editor).toBeNull()
  })
})
