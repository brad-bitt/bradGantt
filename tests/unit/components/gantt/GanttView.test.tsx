import { act, render, screen } from '@testing-library/react'
import { GanttView } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { dateToX, initialScrollLeft, PX_PER_DAY, computeRange, SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { makeTask } from '../../lib/gantt/fixtures'

// jsdom ne fait pas de mise en page : `clientWidth` vaut 0 et `scrollLeft` est un accesseur
// en lecture seule qui renvoie toujours 0. On les remplace par de vraies propriétés le temps
// du fichier, sinon le recentrage n'aurait rien à écrire ni de quoi calculer sa cible.
const scrollLefts = new WeakMap<Element, number>()
const VIEWPORT = 1280

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: Element) { return scrollLefts.get(this) ?? 0 },
    set(this: Element, v: number) { scrollLefts.set(this, v) },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => VIEWPORT })
})

afterAll(() => {
  // Retire les propriétés posées sur HTMLElement.prototype : celles d'Element.prototype
  // (implémentation jsdom) redeviennent visibles.
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollLeft
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
})

const TODAY = '2026-09-15'
const task = makeTask({ id: 'a', projectId: 'p1', startDate: '2026-09-14', endDate: '2026-09-18' })

function hydrate(projectId = 'p1') {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId,
      projectName: 'Projet',
      myRole: 'owner',
      members: [],
      tasks: [task],
      dependencies: [],
      today: TODAY,
    })
  })
}

/** Cible attendue du recentrage, recalculée à partir des mêmes primitives que le composant. */
function expected(zoom: 'day' | 'week' | 'month') {
  const range = computeRange([task], TODAY)
  return initialScrollLeft(dateToX(TODAY, range, zoom), VIEWPORT)
}

function scroller() {
  return screen.getByTestId('gantt-scroll')
}

describe('GanttView : recentrage initial sur aujourd\'hui', () => {
  beforeEach(() => {
    useGanttStore.setState({ zoom: 'day' })
  })

  it('positionne le défilement sur aujourd\'hui au chargement', () => {
    hydrate()
    render(<GanttView />)
    expect(scroller().scrollLeft).toBe(expected('day'))
    expect(scroller().scrollLeft).toBeGreaterThan(0)
  })

  it('laisse du contexte à gauche : aujourd\'hui n\'est pas collé au bord de la sidebar', () => {
    hydrate()
    render(<GanttView />)
    const range = computeRange([task], TODAY)
    const onScreen = 300 + dateToX(TODAY, range, 'day') - scroller().scrollLeft
    expect(onScreen).toBeGreaterThan(300 + PX_PER_DAY.day) // au-delà de la sidebar
    expect(onScreen).toBeLessThan(VIEWPORT) // et dans la partie visible
  })

  it('ne combat pas le défilement de l\'utilisateur : un re-rendu ne ramène pas la vue en arrière', () => {
    hydrate()
    render(<GanttView />)
    expect(scroller().scrollLeft).toBe(expected('day'))

    // L'utilisateur défile là où il veut…
    scroller().scrollLeft = 0
    // … puis une mise à jour des données re-rend la vue (c'est ce que fera chaque image du
    // glisser-déposer en tâche 11, et le défilement automatique de la tâche 12).
    act(() => {
      useGanttStore.getState().apply({ type: 'task.updated', taskId: 'a', patch: { title: 'Renommée' } })
    })
    expect(scroller().scrollLeft).toBe(0)
  })

  it('recentre à nouveau après un changement de zoom (une fois, pas à chaque rendu)', () => {
    hydrate()
    render(<GanttView />)
    scroller().scrollLeft = 0

    act(() => { useGanttStore.getState().setZoom('week') })
    expect(scroller().scrollLeft).toBe(expected('week'))

    // Deuxième vérification du one-shot, au nouveau zoom cette fois.
    scroller().scrollLeft = 0
    act(() => {
      useGanttStore.getState().apply({ type: 'task.updated', taskId: 'a', patch: { title: 'Encore' } })
    })
    expect(scroller().scrollLeft).toBe(0)
  })

  it('recentre à nouveau sur un autre projet', () => {
    hydrate('p1')
    const { rerender } = render(<GanttView />)
    scroller().scrollLeft = 0
    hydrate('p2')
    rerender(<GanttView />)
    expect(scroller().scrollLeft).toBe(expected('day'))
  })
})

describe('GanttView : la timeline remplit la largeur du conteneur', () => {
  // jsdom ne fait aucune mise en page : on lit la largeur POSÉE sur le bloc de contenu
  // (`SIDEBAR_WIDTH + layout.width`), la seule chose que le composant décide vraiment.
  function contentWidth() {
    return parseFloat(screen.getByTestId('gantt-content').style.width)
  }

  it.each(['day', 'week', 'month'] as const)(
    'au zoom %s, le contenu est au moins aussi large que le conteneur',
    (zoom) => {
      useGanttStore.setState({ zoom })
      hydrate()
      render(<GanttView />)
      expect(contentWidth()).toBeGreaterThanOrEqual(VIEWPORT)
    },
  )

  it('mesure le conteneur une seule fois, pas à chaque rendu', () => {
    useGanttStore.setState({ zoom: 'week' })
    hydrate()
    render(<GanttView />)
    const before = contentWidth()
    // Un re-rendu (chaque image du glisser-déposer en produit un) ne doit pas relire le DOM
    // ni changer la largeur : la mesure vient de l'état, posé au montage et au redimensionnement.
    act(() => {
      useGanttStore.getState().apply({ type: 'task.updated', taskId: 'a', patch: { title: 'Bougée' } })
    })
    expect(contentWidth()).toBe(before)
    expect(before).toBeGreaterThanOrEqual(VIEWPORT)
  })

  it('la sidebar est retranchée de la largeur demandée à la timeline', () => {
    // Au zoom mois la plage naturelle ne fait que 244 px : toute la largeur vient de l'extension,
    // ce qui rend l'écart de SIDEBAR_WIDTH observable au pixel près.
    useGanttStore.setState({ zoom: 'month' })
    hydrate()
    render(<GanttView />)
    // 1280 − 300 = 980 visibles, 980 / 4 = 245 jours pile, donc 980 px de timeline.
    expect(contentWidth()).toBe(SIDEBAR_WIDTH + 980)
  })
})
