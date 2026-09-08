import { TEMPLATES, findTemplate, instantiate } from '@/lib/gantt/templates'
import { TASK_COLORS } from '@/lib/gantt/palette'

const today = '2026-09-08'

describe('les modèles sont cohérents', () => {
  for (const t of TEMPLATES) {
    describe(t.name, () => {
      const keys = new Set(t.items.map((i) => i.key))

      it('a des clés uniques', () => {
        expect(keys.size).toBe(t.items.length)
      })

      it('ne fait référence qu’à des clés existantes, et un parent est toujours un groupe', () => {
        const byKey = new Map(t.items.map((i) => [i.key, i]))
        for (const i of t.items) {
          if (i.parent) expect(byKey.get(i.parent)?.type).toBe('group')
          for (const a of i.after ?? []) expect(keys.has(a)).toBe(true)
        }
      })

      it('ne met jamais un groupe dans un groupe', () => {
        for (const i of t.items) if (i.type === 'group') expect(i.parent).toBeUndefined()
      })

      it('ne dépend que d’éléments déclarés AVANT, pour que la création séquentielle les trouve', () => {
        const seen = new Set<string>()
        for (const i of t.items) {
          if (i.parent) expect(seen.has(i.parent)).toBe(true)
          for (const a of i.after ?? []) expect(seen.has(a)).toBe(true)
          seen.add(i.key)
        }
      })

      it('ne prend ses couleurs que dans la palette des tâches', () => {
        for (const i of t.items) expect(TASK_COLORS).toContain(i.color)
      })

      it('montre les trois objets du produit et au moins une chaîne', () => {
        const types = new Set(t.items.map((i) => i.type))
        expect(types).toEqual(new Set(['task', 'milestone', 'group']))
        expect(t.items.some((i) => (i.after ?? []).length > 0)).toBe(true)
      })
    })
  }
})

describe('instantiate', () => {
  it('date chaque élément depuis aujourd’hui, bornes incluses', () => {
    const [item] = instantiate(
      { id: 'x', name: 'X', description: '', items: [{ key: 'a', title: 'A', type: 'task', start: 2, days: 3, color: '#5B9DFF' }] },
      today,
    )
    expect(item).toMatchObject({ startDate: '2026-09-10', endDate: '2026-09-12', parent: null, after: [] })
  })

  it('force un jalon sur un seul jour', () => {
    const [m] = instantiate(
      { id: 'x', name: 'X', description: '', items: [{ key: 'm', title: 'M', type: 'milestone', start: 4, days: 9, color: '#3ECF8E' }] },
      today,
    )
    expect(m.startDate).toBe('2026-09-12')
    expect(m.endDate).toBe('2026-09-12')
  })

  it("donne à un groupe l'empan de ses enfants, et le jour même s'il n'en a pas", () => {
    const planned = instantiate(
      {
        id: 'x', name: 'X', description: '',
        items: [
          { key: 'g', title: 'G', type: 'group', start: 99, days: 99, color: '#5B9DFF' },
          { key: 'a', title: 'A', type: 'task', parent: 'g', start: 3, days: 2, color: '#5B9DFF' },
          { key: 'b', title: 'B', type: 'task', parent: 'g', start: 1, days: 1, color: '#5B9DFF' },
          { key: 'vide', title: 'Vide', type: 'group', start: 0, days: 0, color: '#5B9DFF' },
        ],
      },
      today,
    )
    expect(planned[0]).toMatchObject({ startDate: '2026-09-09', endDate: '2026-09-12' })
    expect(planned[3]).toMatchObject({ startDate: today, endDate: today })
  })

  it('findTemplate retrouve un modèle par identifiant', () => {
    expect(findTemplate('sprint')?.name).toBe('Sprint de deux semaines')
    expect(findTemplate('inconnu')).toBeUndefined()
  })
})
