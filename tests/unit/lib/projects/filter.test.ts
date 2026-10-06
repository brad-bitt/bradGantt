import { LATE_FILTER, visibleProjects } from '@/lib/projects/filter'

const late = { id: 'a', summary: { lateCount: 2 } }
const calm = { id: 'b', summary: { lateCount: 0 } }

describe('visibleProjects', () => {
  it('sans filtre, rend tout', () => {
    expect(visibleProjects([late, calm], undefined)).toEqual([late, calm])
  })
  it('« retard » ne garde que les projets avec au moins une tâche en retard', () => {
    expect(visibleProjects([late, calm], LATE_FILTER)).toEqual([late])
  })
  // Review Focus 5 : une URL bricolée ne doit pas vider la page.
  it('une valeur inconnue est ignorée', () => {
    expect(visibleProjects([late, calm], 'nimporte')).toEqual([late, calm])
  })
  it('« retard » sans projet en retard rend une liste vide (la page l\'explique)', () => {
    expect(visibleProjects([calm], LATE_FILTER)).toEqual([])
  })
})
