import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useTimelineDrag } from '@/components/gantt/useTimelineDrag'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'

// Les commandes sont mockées : ce fichier vérifie ce que le geste DÉCIDE d'écrire (quelle
// commande, quel signe, quel bord), pas ce que la commande fait ensuite — la tâche 8 couvre
// déjà la persistance optimiste et son annulation.
const commands = vi.hoisted(() => ({
  moveTask: vi.fn(async () => true),
  resizeTask: vi.fn(async () => true),
  linkTasks: vi.fn(async () => true),
}))
vi.mock('@/lib/gantt/client-commands', () => ({ getGanttCommands: () => commands }))

const TIMELINE_LEFT = 300
const TIMELINE_TOP = 100

function makeTimelineRef(): RefObject<HTMLDivElement | null> {
  const el = document.createElement('div')
  el.getBoundingClientRect = () =>
    ({ left: TIMELINE_LEFT, top: TIMELINE_TOP, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
  return { current: el }
}

interface FakeEvent {
  clientX: number
  clientY: number
  button: number
  pointerId: number
  currentTarget: { setPointerCapture: ReturnType<typeof vi.fn> }
  stopPropagation: ReturnType<typeof vi.fn>
}

function ptr(over: Partial<Omit<FakeEvent, 'currentTarget' | 'stopPropagation'>> = {}): ReactPointerEvent & FakeEvent {
  const e: FakeEvent = {
    clientX: 0,
    clientY: 0,
    button: 0,
    pointerId: 7,
    currentTarget: { setPointerCapture: vi.fn() },
    stopPropagation: vi.fn(),
    ...over,
  }
  return e as unknown as ReactPointerEvent & FakeEvent
}

function hydrate(role: 'owner' | 'viewer' = 'owner') {
  useGanttStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet',
    myRole: role,
    members: [],
    tasks: [makeTask({ id: 't1' }), makeTask({ id: 't2' })],
    dependencies: [],
    today: '2026-09-01',
  })
}

function setup(role: 'owner' | 'viewer' = 'owner') {
  hydrate(role)
  const ref = makeTimelineRef()
  const { result } = renderHook(() => useTimelineDrag(ref))
  return result
}

beforeEach(() => {
  commands.moveTask.mockClear()
  commands.resizeTask.mockClear()
  commands.linkTasks.mockClear()
  useGanttStore.setState({ zoom: 'day' })
})

describe('useTimelineDrag : début du geste', () => {
  it('sélectionne la tâche et arme un déplacement à delta nul', () => {
    const drag = setup()
    const e = ptr({ clientX: 500, clientY: 200 })
    act(() => drag.current.onBarPointerDown(e, 't1', 'move'))

    expect(useGanttStore.getState().selection).toEqual({ kind: 'task', id: 't1' })
    expect(useGanttStore.getState().drag).toEqual({ mode: 'move', taskId: 't1', deltaDays: 0 })
    expect(e.currentTarget.setPointerCapture).toHaveBeenCalledWith(7)
    // Sans capture d'événement, la poignée de resize (enfant de la barre) laisserait la barre
    // armer un déplacement par-dessus le redimensionnement.
    expect(e.stopPropagation).toHaveBeenCalled()
  })

  it('un lecteur sélectionne mais n\'arme aucun geste', () => {
    const drag = setup('viewer')
    const e = ptr({ clientX: 500 })
    act(() => drag.current.onBarPointerDown(e, 't1', 'move'))

    expect(useGanttStore.getState().selection).toEqual({ kind: 'task', id: 't1' })
    expect(useGanttStore.getState().drag).toBeNull()
    expect(e.currentTarget.setPointerCapture).not.toHaveBeenCalled()
  })

  it('ignore un bouton autre que le bouton principal, y compris la sélection', () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ button: 2, clientX: 500 }), 't1', 'move'))

    expect(useGanttStore.getState().selection).toBeNull()
    expect(useGanttStore.getState().drag).toBeNull()
  })
})

describe('useTimelineDrag : aperçu pendant le glissement', () => {
  it('convertit le déplacement en jours pleins selon le zoom courant', () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))

    // 40 px par jour au zoom « jour » : moins d'une demi-colonne ne bouge pas.
    act(() => drag.current.onPointerMove(ptr({ clientX: 510 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 0 })

    act(() => drag.current.onPointerMove(ptr({ clientX: 580 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 2 })

    // Symétrie de l'arrondi à la demi-colonne : -20 px doit donner -1, comme +20 donne +1.
    act(() => drag.current.onPointerMove(ptr({ clientX: 480 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: -1 })
  })

  it('mesure le delta depuis le point de départ, pas depuis la position précédente', () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 700 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 5 })

    // Retour au point de départ : l'aperçu doit revenir à zéro, pas cumuler +5 puis -5 = -5.
    act(() => drag.current.onPointerMove(ptr({ clientX: 500 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 0 })
  })

  it('suit le zoom : la même distance en pixels vaut plus de jours au zoom semaine', () => {
    const drag = setup()
    useGanttStore.setState({ zoom: 'week' }) // 12 px par jour
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 560 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 5 })
  })

  it('n\'écrit rien dans le store tant que le delta ne change pas de jour', () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    const armed = useGanttStore.getState().drag

    // Une image de plus dans la même colonne : l'objet de drag doit rester le MÊME, sinon
    // `computeLayout` (mémoïsé sur cette référence) se recalcule à chaque pixel parcouru.
    act(() => drag.current.onPointerMove(ptr({ clientX: 505 })))
    expect(useGanttStore.getState().drag).toBe(armed)
  })

  it('ignore un déplacement du pointeur hors de tout geste', () => {
    const drag = setup()
    act(() => drag.current.onPointerMove(ptr({ clientX: 900 })))
    expect(useGanttStore.getState().drag).toBeNull()
  })
})

describe('useTimelineDrag : fin du geste', () => {
  it('déplace la tâche et efface l\'aperçu', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 580 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 580 })) })

    expect(commands.moveTask).toHaveBeenCalledExactlyOnceWith('t1', 2)
    expect(commands.resizeTask).not.toHaveBeenCalled()
    expect(useGanttStore.getState().drag).toBeNull()
  })

  it('redimensionne par le bon bord, avec le signe du geste', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'resize-end'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 620 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 620 })) })
    expect(commands.resizeTask).toHaveBeenCalledExactlyOnceWith('t1', 'end', 3)

    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'resize-start'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 420 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 420 })) })
    expect(commands.resizeTask).toHaveBeenLastCalledWith('t1', 'start', -2)
    expect(commands.moveTask).not.toHaveBeenCalled()
  })

  it('n\'écrit rien sur un delta nul — c\'est le cas du double-clic', async () => {
    const drag = setup()
    // Un double-clic, c'est exactement deux pointerdown/pointerup sans déplacement.
    for (let i = 0; i < 2; i++) {
      act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
      await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 500 })) })
    }
    expect(commands.moveTask).not.toHaveBeenCalled()
    expect(commands.resizeTask).not.toHaveBeenCalled()
    expect(useGanttStore.getState().drag).toBeNull()
  })

  it('un geste repris par le système est abandonné, jamais enregistré', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 700 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 5 })

    // `pointercancel` : le navigateur a repris la main, l'utilisateur n'a rien relâché.
    // Enregistrer ici écrirait un déplacement que personne n'a validé.
    act(() => drag.current.onPointerCancel(ptr({ clientX: 700 })))
    expect(useGanttStore.getState().drag).toBeNull()
    expect(commands.moveTask).not.toHaveBeenCalled()

    // Et l'abandon ne laisse pas le geste suivant partir de travers.
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 900 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 940 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 940 })) })
    expect(commands.moveTask).toHaveBeenCalledExactlyOnceWith('t1', 1)
  })

  it('un relâchement sans geste armé n\'écrit rien', async () => {
    const drag = setup()
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 900 })) })
    expect(commands.moveTask).not.toHaveBeenCalled()
    expect(commands.linkTasks).not.toHaveBeenCalled()
  })

  // Ce que ce test verrouille, précisément : chaque pression RÉ-ANCRE l'origine du geste.
  // Vérifié par cassage — supprimer la remise à `null` de l'origine au relâchement ne fait
  // échouer AUCUN test (la pression suivante la réécrit de toute façon, la ligne est purement
  // défensive) ; supprimer l'ancrage à la pression en fait échouer 7.
  it('un second geste part de son propre point d\'origine', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 700 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 700 })) })
    commands.moveTask.mockClear()

    act(() => drag.current.onBarPointerDown(ptr({ clientX: 900 }), 't2', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 940 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 940 })) })
    expect(commands.moveTask).toHaveBeenCalledExactlyOnceWith('t2', 1)
  })
})

describe('useTimelineDrag : tracé d\'une liaison (consommé en tâche 12)', () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).elementFromPoint
  })

  it('suit le pointeur en coordonnées locales à la timeline', () => {
    const drag = setup()
    act(() => drag.current.onLinkPointerDown(ptr({ clientX: 500, clientY: 250 }), 't1'))
    expect(useGanttStore.getState().drag).toEqual({ mode: 'link', fromTaskId: 't1', x: 200, y: 150 })

    act(() => drag.current.onPointerMove(ptr({ clientX: 640, clientY: 300 })))
    expect(useGanttStore.getState().drag).toEqual({ mode: 'link', fromTaskId: 't1', x: 340, y: 200 })
  })

  it('lie à la tâche relâchée sous le pointeur, et à rien si le fond est visé', async () => {
    const drag = setup()
    const cible = document.createElement('div')
    cible.dataset.taskId = 't2'
    document.body.appendChild(cible)
    ;(document as unknown as { elementFromPoint: unknown }).elementFromPoint = vi.fn(() => cible)

    act(() => drag.current.onLinkPointerDown(ptr({ clientX: 500, clientY: 250 }), 't1'))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 700, clientY: 250 })) })
    expect(commands.linkTasks).toHaveBeenCalledExactlyOnceWith('t1', 't2')

    commands.linkTasks.mockClear()
    ;(document as unknown as { elementFromPoint: unknown }).elementFromPoint = vi.fn(() => document.body)
    act(() => drag.current.onLinkPointerDown(ptr({ clientX: 500, clientY: 250 }), 't1'))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 700, clientY: 250 })) })
    expect(commands.linkTasks).not.toHaveBeenCalled()

    cible.remove()
  })

  it('un lecteur ne trace pas de liaison', () => {
    const drag = setup('viewer')
    act(() => drag.current.onLinkPointerDown(ptr({ clientX: 500, clientY: 250 }), 't1'))
    expect(useGanttStore.getState().drag).toBeNull()
  })
})
