import { computeLayout } from '@/lib/gantt/layout'
import { indexById } from '@/lib/gantt/events'
import { PX_PER_DAY, ROW_HEIGHT, SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { makeTask } from './fixtures'
import type { GanttData, Task, Zoom } from '@/lib/gantt/types'

const today = '2026-08-31'
const g = makeTask({ id: 'g', type: 'group', startDate: '2026-01-01', endDate: '2026-01-01', sortOrder: 0 })
const c1 = makeTask({ id: 'c1', parentId: 'g', startDate: '2026-09-01', endDate: '2026-09-03', sortOrder: 0 })
const c2 = makeTask({ id: 'c2', parentId: 'g', startDate: '2026-09-05', endDate: '2026-09-08', sortOrder: 1 })
const data = { tasks: indexById([g, c1, c2]), dependencies: {} }

// Deep freeze for purity tests
function deepFreeze<T>(obj: T): T {
  Object.freeze(obj)
  const record = obj as Record<string, unknown>
  Object.getOwnPropertyNames(record).forEach((prop) => {
    const value = record[prop]
    if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
      deepFreeze(value)
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
  // Non-régression de PERFORMANCE, exprimée en RATIO et non en millisecondes.
  //
  // La version précédente mesurait un temps absolu (« moins de 40 ms par image »). Elle est
  // tombée pour de vrai à trois reprises sans qu'aucune régression n'ait eu lieu : mesuré sous
  // charge sur huit cœurs, le même calcul prenait de 42 à 80 ms. Un test qui crie au loup finit
  // désactivé, donc ne protège plus rien.
  //
  // Ce qu'on veut attraper, c'est une régression de COMPLEXITÉ : que le coût cesse de croître
  // linéairement avec le nombre de tâches. En comparant 800 tâches à 100 dans la MÊME
  // exécution, la vitesse de la machine s'annule — les deux tailles en souffrent également.
  //
  // Deux précautions, l'une et l'autre nécessaires, mesurées et non supposées :
  //  - MÉDIANE et non moyenne : un seul pic d'ordonnancement suffisait à faire passer la
  //    moyenne du ratio de 6 à 11,3 sous charge, soit au-dessus d'une vraie régression ;
  //  - mesures ALTERNÉES : les deux tailles subissent la même dérive au fil de l'exécution.
  //
  // Calibrage constaté sur ce code : 7,7 à 8,2 à vide, 7,9 à 9,0 sous charge de huit
  // processus. En remplaçant l'index des enfants par un balayage linéaire (la régression O(n²)
  // que l'optimisation de la tâche 5 a précisément supprimée) : 13,8 à 14,8. Le seuil de 11 se
  // place entre les deux, avec ~20 % de marge de chaque côté.
  function frameTimes(taskCount: number): GanttData {
    const tasks: Task[] = []
    for (let i = 0; i < taskCount; i++) {
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
    return { tasks: indexById(tasks), dependencies: {} }
  }

  it('le coût par image croît linéairement avec le nombre de tâches', () => {
    const small = frameTimes(100)
    const large = frameTimes(800)
    // Amorçage du cache de dates hors mesure : la première image le remplit, ce sont les
    // suivantes qui comptent pour le confort du glisser-déposer.
    computeLayout(small, null, 'day', today)
    computeLayout(large, null, 'day', today)

    const ts: number[] = []
    const tl: number[] = []
    for (let j = 0; j < 40; j++) {
      let s = performance.now()
      computeLayout(small, { mode: 'move', taskId: 't50', deltaDays: j % 10 }, 'day', today)
      ts.push(performance.now() - s)
      s = performance.now()
      computeLayout(large, { mode: 'move', taskId: 't50', deltaDays: j % 10 }, 'day', today)
      tl.push(performance.now() - s)
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
    const ratio = median(tl) / median(ts)

    expect(ratio).toBeLessThan(11)
  })
})

describe('computeLayout : la timeline remplit la largeur visible', () => {
  const VISIBLE = 1280 - SIDEBAR_WIDTH
  const zooms: Zoom[] = ['day', 'week', 'month']

  it.each(zooms)('au zoom %s, la largeur calculée couvre la largeur visible', (zoom) => {
    // Sans ce paramètre, une plage de quelques semaines donnait 732 px au zoom semaine et
    // 244 px au zoom mois : la grille s'arrêtait en plein écran, laissant un grand vide à droite.
    expect(computeLayout(data, null, zoom, today, VISIBLE).width).toBeGreaterThanOrEqual(VISIBLE)
  })

  it.each(zooms)('au zoom %s, la valeur par défaut reproduit à l\'identique le layout d\'origine', (zoom) => {
    // Le contrat du paramètre optionnel : ne rien changer pour qui ne le passe pas.
    expect(computeLayout(data, null, zoom, today)).toEqual(computeLayout(data, null, zoom, today, 0))
  })

  it.each(zooms)('au zoom %s, étendre ne déplace AUCUNE barre déjà placée', (zoom) => {
    // `dateToX` part de `range.start` : si l'extension touchait le début, toutes les abscisses
    // bougeraient et le glisser-déposer déposerait les barres sur le mauvais jour.
    const base = computeLayout(data, null, zoom, today)
    const wide = computeLayout(data, null, zoom, today, VISIBLE)
    expect(wide.range.start).toBe(base.range.start)
    expect(wide.rects).toEqual(base.rects)
  })

  it.each(zooms)('au zoom %s, changer de gabarit ne déplace aucune barre', (zoom) => {
    // Le cas réel : la fenêtre est redimensionnée (ou une barre de défilement verticale apparaît)
    // PENDANT un glissement. La largeur visible change donc d'une image à l'autre. Comme seule la
    // fin de la plage bouge, les rects doivent être rigoureusement identiques — sinon l'aperçu
    // sauterait sous le curseur et la barre serait déposée ailleurs qu'à l'endroit visé.
    const small = computeLayout(data, null, zoom, today, 1280 - SIDEBAR_WIDTH)
    const large = computeLayout(data, null, zoom, today, 1920 - SIDEBAR_WIDTH)
    expect(large.range.start).toBe(small.range.start)
    expect(large.rects).toEqual(small.rects)
  })

  it('n\'ampute pas une plage plus large que l\'écran', () => {
    const base = computeLayout(data, null, 'day', today)
    expect(computeLayout(data, null, 'day', today, VISIBLE).range).toEqual(base.range)
  })
})
