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
  // Performance test: mesure le chemin chaud (cache rempli) pendant un glissement
  // Ce qui compte pour l'UX : une première image remplit le cache, puis les images suivantes
  // s'exécutent avec cache chaud. Ce test simule cette séquence avec un aperçu de drag actif.
  // Sensible à la machine : la charge du CI (autres tests avant) affecte le timing.
  // Coordinateur a mesuré 8ms en isolation, budget réel 16,7ms/image. Seuil 40ms = 2x budget,
  // absorbe la charge du CI tout en détectant des régressions sérieuses.
  // Machine-sensitive: timing varies with system load. Increase threshold if CI is slow.
  it('performances avec cache chaud : 800 tâches en moyenne sous 40ms par image', () => {
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

    // Amorce le cache avec un appel initial (hors mesure)
    computeLayout(largeData, null, 'day', today)

    // Mesure le chemin chaud : 30 appels avec aperçu de drag actif
    // (simule un glissement en cours avec mise à jour par image)
    const times: number[] = []
    for (let j = 0; j < 30; j++) {
      const start = performance.now()
      computeLayout(largeData, { mode: 'move', taskId: 't100', deltaDays: j % 10 }, 'day', today)
      const elapsed = performance.now() - start
      times.push(elapsed)
    }

    // Moyenne sur les 30 appels avec cache chaud
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    expect(avg).toBeLessThan(40)
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
