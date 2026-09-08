import { miniTimeline } from '@/lib/gantt/mini'
import { makeTask } from './fixtures'

const range = { start: '2026-09-01', end: '2026-09-10' } // 10 jours

describe('miniTimeline', () => {
  it('place chaque barre en pourcentage de la plage', () => {
    const [bar] = miniTimeline([makeTask({ startDate: '2026-09-03', endDate: '2026-09-04', color: '#5B9DFF' })], range)
    expect(bar).toMatchObject({ left: 20, width: 20, lane: 0, color: '#5B9DFF', milestone: false })
  })

  it('empile deux tâches qui se chevauchent sur deux couloirs, et réutilise un couloir libéré', () => {
    const bars = miniTimeline(
      [
        makeTask({ id: 'a', startDate: '2026-09-01', endDate: '2026-09-04' }),
        makeTask({ id: 'b', startDate: '2026-09-03', endDate: '2026-09-06' }),
        makeTask({ id: 'c', startDate: '2026-09-06', endDate: '2026-09-08' }),
      ],
      range,
    )
    expect(bars.map((b) => b.lane)).toEqual([0, 1, 0])
  })

  it('ne dépasse jamais le nombre de couloirs demandé', () => {
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask({ id: `t${i}`, startDate: '2026-09-01', endDate: '2026-09-10' }))
    const lanes = new Set(miniTimeline(tasks, range, 3).map((b) => b.lane))
    expect(Math.max(...lanes)).toBeLessThanOrEqual(2)
  })

  it('trie par date de début quel que soit l’ordre du tableau', () => {
    const bars = miniTimeline(
      [makeTask({ id: 'tard', startDate: '2026-09-07', endDate: '2026-09-08' }), makeTask({ id: 'tot', startDate: '2026-09-01', endDate: '2026-09-02' })],
      range,
    )
    expect(bars[0].left).toBe(0)
    expect(bars[1].left).toBe(60)
  })

  it('ignore les groupes et signale les jalons', () => {
    const bars = miniTimeline(
      [
        makeTask({ type: 'group', startDate: '2020-01-01', endDate: '2030-01-01' }),
        makeTask({ type: 'milestone', startDate: '2026-09-05', endDate: '2026-09-05' }),
      ],
      range,
    )
    expect(bars).toHaveLength(1)
    expect(bars[0].milestone).toBe(true)
    expect(bars[0].left).toBe(40)
  })

  it("garantit une largeur minimale lisible à une tâche d'un jour sur une longue plage", () => {
    const [bar] = miniTimeline([makeTask({ startDate: '2026-01-01', endDate: '2026-01-01' })], { start: '2026-01-01', end: '2026-12-31' })
    expect(bar.width).toBeGreaterThanOrEqual(2)
  })

  it('rend une liste vide sans tâche', () => {
    expect(miniTimeline([], range)).toEqual([])
  })
})
