import { computeLayout } from '@/lib/gantt/layout'
import { indexById } from '@/lib/gantt/events'
import { PX_PER_DAY, ROW_HEIGHT } from '@/lib/gantt/geometry'
import { makeTask } from './fixtures'

const today = '2026-08-31'
const g = makeTask({ id: 'g', type: 'group', startDate: '2026-01-01', endDate: '2026-01-01', sortOrder: 0 })
const c1 = makeTask({ id: 'c1', parentId: 'g', startDate: '2026-09-01', endDate: '2026-09-03', sortOrder: 0 })
const c2 = makeTask({ id: 'c2', parentId: 'g', startDate: '2026-09-05', endDate: '2026-09-08', sortOrder: 1 })
const data = { tasks: indexById([g, c1, c2]), dependencies: {} }

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
  })
})
