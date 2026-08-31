import { shiftDates, resizeDates, groupBounds, wouldCreateCycle, checkLink, buildRows, reorderSiblings, nextSortOrder, siblingsOf } from '@/lib/gantt/scheduling'
import { makeTask, makeDep } from './fixtures'

describe('shiftDates / resizeDates', () => {
  const t = makeTask({ startDate: '2026-09-01', endDate: '2026-09-03' })
  it('décale en conservant la durée', () => {
    expect(shiftDates(t, 2)).toEqual({ startDate: '2026-09-03', endDate: '2026-09-05' })
  })
  it('redimensionne le bord droit avec durée min 1 jour', () => {
    expect(resizeDates(t, 'end', 2)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-05' })
    expect(resizeDates(t, 'end', -10)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-01' })
  })
  it('redimensionne le bord gauche avec durée min 1 jour', () => {
    expect(resizeDates(t, 'start', -1)).toEqual({ startDate: '2026-08-31', endDate: '2026-09-03' })
    expect(resizeDates(t, 'start', 10)).toEqual({ startDate: '2026-09-03', endDate: '2026-09-03' })
  })
})

describe('groupBounds', () => {
  it('null sans enfant, sinon min/max', () => {
    expect(groupBounds([])).toBeNull()
    expect(groupBounds([
      makeTask({ startDate: '2026-09-05', endDate: '2026-09-06' }),
      makeTask({ startDate: '2026-09-01', endDate: '2026-09-02' }),
    ])).toEqual({ startDate: '2026-09-01', endDate: '2026-09-06' })
  })
})

describe('liens', () => {
  const deps = [makeDep('a', 'b'), makeDep('b', 'c')]
  it('détecte un cycle direct et indirect', () => {
    expect(wouldCreateCycle(deps, 'b', 'a')).toBe(true)
    expect(wouldCreateCycle(deps, 'c', 'a')).toBe(true)
    expect(wouldCreateCycle(deps, 'a', 'c')).toBe(false)
  })
  it('checkLink refuse self, doublon, cycle', () => {
    expect(checkLink(deps, 'a', 'a')).toEqual({ ok: false, reason: 'self' })
    expect(checkLink(deps, 'a', 'b')).toEqual({ ok: false, reason: 'duplicate' })
    expect(checkLink(deps, 'c', 'a')).toEqual({ ok: false, reason: 'cycle' })
    expect(checkLink(deps, 'a', 'c')).toEqual({ ok: true })
  })
})

describe('buildRows', () => {
  const g = makeTask({ id: 'g', type: 'group', sortOrder: 0 })
  const c1 = makeTask({ id: 'c1', parentId: 'g', sortOrder: 1 })
  const c2 = makeTask({ id: 'c2', parentId: 'g', sortOrder: 0 })
  const r = makeTask({ id: 'r', sortOrder: 1 })
  it('ordonne racines puis enfants triés par sortOrder, avec profondeur et index', () => {
    const rows = buildRows([r, c1, g, c2])
    expect(rows.map((x) => x.task.id)).toEqual(['g', 'c2', 'c1', 'r'])
    expect(rows.map((x) => x.depth)).toEqual([0, 1, 1, 0])
    expect(rows.map((x) => x.index)).toEqual([0, 1, 2, 3])
  })
  it('masque les enfants d\'un groupe replié', () => {
    const rows = buildRows([r, c1, { ...g, collapsed: true }, c2])
    expect(rows.map((x) => x.task.id)).toEqual(['g', 'r'])
  })
})

describe('ordre', () => {
  const a = makeTask({ id: 'a', sortOrder: 0 }), b = makeTask({ id: 'b', sortOrder: 1 }), c = makeTask({ id: 'c', sortOrder: 2 })
  it('siblingsOf retourne les frères triés', () => {
    expect(siblingsOf([c, a, b], b).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })
  it('reorderSiblings renumérote', () => {
    expect(reorderSiblings([a, b, c], 'c', 0)).toEqual([
      { taskId: 'c', sortOrder: 0 }, { taskId: 'a', sortOrder: 1 }, { taskId: 'b', sortOrder: 2 },
    ])
  })
  it('nextSortOrder', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([a, c])).toBe(3)
  })
})
