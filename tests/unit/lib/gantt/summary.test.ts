import { isLate, projectSummary } from '@/lib/gantt/summary'
import { makeTask } from './fixtures'

const today = '2026-09-10'

describe('projectSummary', () => {
  it('rend une synthèse vide sur un projet sans tâche', () => {
    expect(projectSummary([], today)).toEqual({
      taskCount: 0,
      milestoneCount: 0,
      groupCount: 0,
      range: null,
      progress: 0,
      nextMilestone: null,
      lateCount: 0,
    })
  })

  it('compte les tâches, jalons et groupes séparément', () => {
    const s = projectSummary(
      [
        makeTask({ id: 'g', type: 'group' }),
        makeTask({ id: 'a', parentId: 'g' }),
        makeTask({ id: 'b', parentId: 'g' }),
        makeTask({ id: 'm', type: 'milestone', startDate: '2026-09-20', endDate: '2026-09-20' }),
      ],
      today,
    )
    expect(s).toMatchObject({ taskCount: 2, milestoneCount: 1, groupCount: 1 })
  })

  it("borne la période sur les tâches et jalons, en ignorant les dates stockées d'un groupe", () => {
    // Le groupe porte des dates hors sujet : `computeLayout` ne les affiche jamais, la synthèse
    // ne doit pas les faire apparaître dans la période du projet.
    const s = projectSummary(
      [
        makeTask({ id: 'g', type: 'group', startDate: '2020-01-01', endDate: '2030-12-31' }),
        makeTask({ id: 'a', parentId: 'g', startDate: '2026-09-05', endDate: '2026-09-08' }),
        makeTask({ id: 'b', parentId: 'g', startDate: '2026-09-02', endDate: '2026-09-04' }),
      ],
      today,
    )
    expect(s.range).toEqual({ start: '2026-09-02', end: '2026-09-08' })
  })

  it("pondère l'avancement par la durée, et non par le nombre de tâches", () => {
    // 1 jour à 100 % et 9 jours à 0 % : une moyenne simple dirait 50 %, la réalité est 10 %.
    const s = projectSummary(
      [
        makeTask({ id: 'court', startDate: '2026-09-01', endDate: '2026-09-01', progress: 100 }),
        makeTask({ id: 'long', startDate: '2026-09-02', endDate: '2026-09-10', progress: 0 }),
      ],
      today,
    )
    expect(s.progress).toBe(10)
  })

  it("exclut les groupes et les jalons du calcul d'avancement", () => {
    const s = projectSummary(
      [
        makeTask({ id: 'g', type: 'group', progress: 0 }),
        makeTask({ id: 'm', type: 'milestone', progress: 0, startDate: '2026-09-01', endDate: '2026-09-01' }),
        makeTask({ id: 'a', parentId: 'g', startDate: '2026-09-01', endDate: '2026-09-02', progress: 50 }),
      ],
      today,
    )
    expect(s.progress).toBe(50)
  })

  it('retient le prochain jalon à venir, aujourd’hui compris', () => {
    const s = projectSummary(
      [
        makeTask({ id: 'passe', type: 'milestone', title: 'Passé', startDate: '2026-09-01', endDate: '2026-09-01' }),
        makeTask({ id: 'proche', type: 'milestone', title: 'Recette', startDate: '2026-09-10', endDate: '2026-09-10' }),
        makeTask({ id: 'loin', type: 'milestone', title: 'Livraison', startDate: '2026-12-01', endDate: '2026-12-01' }),
      ],
      today,
    )
    expect(s.nextMilestone).toEqual({ title: 'Recette', date: '2026-09-10' })
  })

  it('ne retient aucun jalon quand ils sont tous passés', () => {
    const s = projectSummary(
      [makeTask({ id: 'p', type: 'milestone', startDate: '2026-01-01', endDate: '2026-01-01' })],
      today,
    )
    expect(s.nextMilestone).toBeNull()
  })

  it('compte comme en retard les tâches inachevées dont la fin est dépassée', () => {
    const s = projectSummary(
      [
        makeTask({ id: 'finie', startDate: '2026-09-01', endDate: '2026-09-02', progress: 100 }),
        makeTask({ id: 'retard', startDate: '2026-09-01', endDate: '2026-09-02', progress: 40 }),
        // Se termine aujourd'hui : la journée n'est pas finie, ce n'est pas encore un retard.
        makeTask({ id: 'aujourdhui', startDate: '2026-09-01', endDate: today, progress: 0 }),
        makeTask({ id: 'future', startDate: '2026-09-20', endDate: '2026-09-25', progress: 0 }),
      ],
      today,
    )
    expect(s.lateCount).toBe(1)
  })
})

describe('isLate', () => {
  const today = '2026-10-06'
  it('une tâche inachevée dont la fin est passée', () => {
    expect(isLate({ type: 'task', title: 'a', startDate: '2026-09-01', endDate: '2026-10-05', progress: 50 }, today)).toBe(true)
  })
  it('pas une tâche qui finit aujourd\'hui : la journée n\'est pas écoulée', () => {
    expect(isLate({ type: 'task', title: 'a', startDate: '2026-09-01', endDate: today, progress: 0 }, today)).toBe(false)
  })
  it('ni une tâche achevée, ni un jalon, ni un groupe', () => {
    expect(isLate({ type: 'task', title: 'a', startDate: '2026-09-01', endDate: '2026-09-02', progress: 100 }, today)).toBe(false)
    expect(isLate({ type: 'milestone', title: 'm', startDate: '2026-09-01', endDate: '2026-09-01', progress: 0 }, today)).toBe(false)
    expect(isLate({ type: 'group', title: 'g', startDate: '2026-09-01', endDate: '2026-09-02', progress: 0 }, today)).toBe(false)
  })
})
