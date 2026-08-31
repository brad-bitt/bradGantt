import { computeLayout } from '@/lib/gantt/layout'
import { indexById } from '@/lib/gantt/events'
import { PX_PER_DAY, ROW_HEIGHT } from '@/lib/gantt/geometry'
import { makeTask } from './fixtures'
import type { GanttData, Task } from '@/lib/gantt/types'

const today = '2026-08-31'
const g = makeTask({ id: 'g', type: 'group', startDate: '2026-01-01', endDate: '2026-01-01', sortOrder: 0 })
const c1 = makeTask({ id: 'c1', parentId: 'g', startDate: '2026-09-01', endDate: '2026-09-03', sortOrder: 0 })
const c2 = makeTask({ id: 'c2', parentId: 'g', startDate: '2026-09-05', endDate: '2026-09-08', sortOrder: 1 })
const data = { tasks: indexById([g, c1, c2]), dependencies: {} }

// Deep freeze for purity tests
function deepFreeze<T>(obj: T): T {
  Object.freeze(obj)
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if ((obj as any)[prop] !== null && ((typeof (obj as any)[prop]) === 'object' || typeof (obj as any)[prop] === 'function') && !Object.isFrozen((obj as any)[prop])) {
      deepFreeze((obj as any)[prop])
    }
  })
  return obj
}

describe('computeLayout', () => {
  it('calcule les dates du groupe depuis ses enfants et ignore ses dates stockées', () => {
    const l = computeLayout(data, null, 'day', today)
    expect(l.effective.g).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-08' })
    expect(l.range.start).toBe('2026-08-01') // aujourd'hui − 30, pas 2026-01-01 − 7
  })
  it('produit un rect par ligne visible et une hauteur totale', () => {
    const l = computeLayout(data, null, 'day', today)
    expect(Object.keys(l.rects)).toEqual(['g', 'c1', 'c2'])
    expect(l.height).toBe(3 * ROW_HEIGHT)
    expect(l.rects.c1.width).toBe(3 * PX_PER_DAY.day)
  })
  it('applique l\'aperçu d\'un drag de déplacement et propage au groupe', () => {
    const l = computeLayout(data, { mode: 'move', taskId: 'c2', deltaDays: 4 }, 'day', today)
    expect(l.effective.c2).toMatchObject({ startDate: '2026-09-09', endDate: '2026-09-12' })
    expect(l.effective.g.endDate).toBe('2026-09-12')
    expect(l.rows[2].task.startDate).toBe('2026-09-09')
  })
  it('applique l\'aperçu d\'un resize', () => {
    const l = computeLayout(data, { mode: 'resize-end', taskId: 'c1', deltaDays: 2 }, 'day', today)
    expect(l.effective.c1.endDate).toBe('2026-09-05')
  })
  it('masque les enfants d\'un groupe replié', () => {
    const collapsed = { ...data, tasks: { ...data.tasks, g: { ...g, collapsed: true } } }
    const l = computeLayout(collapsed, null, 'day', today)
    expect(Object.keys(l.rects)).toEqual(['g'])
    // Vérifier aussi que les lignes masquent les enfants
    expect(l.rows.map((r) => r.task.id)).toEqual(['g'])
  })
  it('applique l\'aperçu d\'un resize-start', () => {
    const l = computeLayout(data, { mode: 'resize-start', taskId: 'c1', deltaDays: 1 }, 'day', today)
    expect(l.effective.c1).toMatchObject({ startDate: '2026-09-02', endDate: '2026-09-03' })
  })
  it('groupe vide conserve ses dates stockées et entre dans la plage temporelle', () => {
    const emptyGroup = makeTask({ id: 'eg', type: 'group', startDate: '2026-07-01', endDate: '2026-07-15', sortOrder: 0 })
    const emptyData: GanttData = { tasks: indexById([emptyGroup]), dependencies: {} }
    const l = computeLayout(emptyData, null, 'day', today)
    expect(l.effective.eg).toMatchObject({ startDate: '2026-07-01', endDate: '2026-07-15' })
    expect(l.range.start <= '2026-07-01').toBe(true)
  })
  it('préserve la pureté de l\'entrée sans drag', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(data)) as GanttData)
    expect(() => computeLayout(frozen, null, 'day', today)).not.toThrow()
  })
  it('préserve la pureté de l\'entrée avec move drag', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(data)) as GanttData)
    expect(() => computeLayout(frozen, { mode: 'move', taskId: 'c1', deltaDays: 2 }, 'day', today)).not.toThrow()
  })
  it('préserve la pureté de l\'entrée avec resize-start drag', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(data)) as GanttData)
    expect(() => computeLayout(frozen, { mode: 'resize-start', taskId: 'c1', deltaDays: 1 }, 'day', today)).not.toThrow()
  })
  it('préserve la pureté de l\'entrée avec resize-end drag', () => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(data)) as GanttData)
    expect(() => computeLayout(frozen, { mode: 'resize-end', taskId: 'c2', deltaDays: 2 }, 'day', today)).not.toThrow()
  })
  it('enfant déplacé hors limites du groupe des deux côtés met à jour les bornes', () => {
    const l = computeLayout(data, { mode: 'move', taskId: 'c1', deltaDays: -10 }, 'day', today)
    expect(l.effective.g.startDate).toBe('2026-08-22') // c1 becomes 2026-08-22 to 2026-08-24
    expect(l.effective.g.endDate).toBe('2026-09-08') // c2 stays 2026-09-05 to 2026-09-08
  })
  it('cohérence entre lignes et rectangles pour groupe replié', () => {
    const collapsed = { ...data, tasks: { ...data.tasks, g: { ...g, collapsed: true } } }
    const l = computeLayout(collapsed, null, 'day', today)
    const rectIds = Object.keys(l.rects)
    const rowIds = l.rows.map((r) => r.task.id)
    expect(rowIds).toEqual(rectIds)
  })
  // Performance test: sensitive to machine, machine configuration can cause variation
  // If this becomes flaky, increase threshold or mark as skip on slow runners
  // Baseline before optimizations: ~29.7ms at 800 tasks
  // After memoization + index optimizations: ~13-14ms (isolated run), ~35-40ms (full suite run)
  // Threshold set conservatively to allow for test framework and machine variation
  it('calcule le layout pour 800 tâches en moins de 50ms', () => {
    const tasks: Task[] = []
    for (let i = 0; i < 800; i++) {
      tasks.push(
        makeTask({
          id: `t${i}`,
          type: i % 10 === 0 ? 'group' : 'task',
          parentId: i % 10 === 0 ? null : `t${Math.floor(i / 10) * 10}`,
          startDate: '2026-09-01',
          endDate: '2026-09-10',
          sortOrder: i,
        }),
      )
    }
    const largeData: GanttData = { tasks: indexById(tasks), dependencies: {} }
    const start = performance.now()
    computeLayout(largeData, null, 'day', today)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
  })
})
