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

describe('useTimelineDrag : seuil de déclenchement', () => {
  // Au zoom mois (4 px par jour), une demi-colonne fait 2 px : sans seuil, un clic qui tremble
  // de deux pixels décalait la tâche d'un jour ET l'écrivait en base — dans une application
  // sans annulation. Le seuil gèle le delta à zéro tant qu'il n'est pas franchi.
  beforeEach(() => useGanttStore.setState({ zoom: 'month' }))

  it('gèle le delta à zéro sous le seuil, même quand deux pixels valent un jour', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))

    act(() => drag.current.onPointerMove(ptr({ clientX: 502 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 0 })
    // 3 px : encore sous le seuil, alors que la conversion brute donnerait déjà 1 jour.
    act(() => drag.current.onPointerMove(ptr({ clientX: 503 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 0 })

    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 503 })) })
    expect(commands.moveTask).not.toHaveBeenCalled()
  })

  it('arme le geste au seuil et reprend la géométrie exacte depuis le point de pression', () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 504 })))
    // Une fois armé, le delta est celui du déplacement RÉEL depuis la pression (4 px = 1 jour au
    // zoom mois) : le seuil retarde l'armement, il ne décale pas l'origine.
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 1 })

    act(() => drag.current.onPointerMove(ptr({ clientX: 540 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 10 })
  })

  it('un geste armé le reste, même si le pointeur repasse près du point de départ', () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 540 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 10 })

    // Un déplacement délibéré ramené sous le seuil doit continuer de suivre le pointeur, sinon
    // l'aperçu se figerait au dernier jour franchi.
    act(() => drag.current.onPointerMove(ptr({ clientX: 502 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 1 })
    act(() => drag.current.onPointerMove(ptr({ clientX: 500 })))
    expect(useGanttStore.getState().drag).toMatchObject({ deltaDays: 0 })
  })

  it('un double-clic tremblé n\'écrit rien du tout', async () => {
    const drag = setup()
    // Deux pressions/relâchements à deux pixels près : c'est ce que produit un vrai double-clic
    // humain, et c'est ce qui enregistrait un déplacement d'un jour au zoom mois.
    for (const [down, up] of [[500, 502], [501, 499]]) {
      act(() => drag.current.onBarPointerDown(ptr({ clientX: down }), 't1', 'move'))
      act(() => drag.current.onPointerMove(ptr({ clientX: up })))
      await act(async () => { await drag.current.onPointerUp(ptr({ clientX: up })) })
    }
    expect(commands.moveTask).not.toHaveBeenCalled()
    expect(commands.resizeTask).not.toHaveBeenCalled()
  })

  it('le seuil vaut aussi pour un redimensionnement', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500 }), 't1', 'resize-end'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 502 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 502 })) })
    expect(commands.resizeTask).not.toHaveBeenCalled()
  })
})

describe('useTimelineDrag : un seul pointeur à la fois', () => {
  it('un second pointeur ne détourne pas le geste en cours', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500, pointerId: 1 }), 't1', 'move'))

    // Un second doigt sur une AUTRE barre : le geste ouvert garde la main, et la barre visée
    // n'est même pas sélectionnée par-dessus.
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 900, pointerId: 2 }), 't2', 'move'))
    expect(useGanttStore.getState().drag).toMatchObject({ mode: 'move', taskId: 't1', deltaDays: 0 })
    expect(useGanttStore.getState().selection).toEqual({ kind: 'task', id: 't1' })

    // Ses déplacements ne pilotent pas l'aperçu du premier.
    act(() => drag.current.onPointerMove(ptr({ clientX: 1300, pointerId: 2 })))
    expect(useGanttStore.getState().drag).toMatchObject({ taskId: 't1', deltaDays: 0 })

    // Le geste du pointeur propriétaire, lui, fonctionne normalement.
    act(() => drag.current.onPointerMove(ptr({ clientX: 700, pointerId: 1 })))
    expect(useGanttStore.getState().drag).toMatchObject({ taskId: 't1', deltaDays: 5 })

    // Et son relâchement à lui ne clôt rien : ni écriture, ni aperçu effacé.
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 1300, pointerId: 2 })) })
    expect(commands.moveTask).not.toHaveBeenCalled()
    expect(useGanttStore.getState().drag).toMatchObject({ taskId: 't1', deltaDays: 5 })

    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 700, pointerId: 1 })) })
    expect(commands.moveTask).toHaveBeenCalledExactlyOnceWith('t1', 5)
  })

  it('un `pointercancel` d\'un autre pointeur n\'abandonne pas le geste en cours', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500, pointerId: 1 }), 't1', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 700, pointerId: 1 })))

    act(() => drag.current.onPointerCancel(ptr({ clientX: 1300, pointerId: 2 })))
    expect(useGanttStore.getState().drag).toMatchObject({ taskId: 't1', deltaDays: 5 })

    act(() => drag.current.onPointerCancel(ptr({ clientX: 700, pointerId: 1 })))
    expect(useGanttStore.getState().drag).toBeNull()
  })

  it('la même souris reprend la main si un relâchement a été perdu', async () => {
    const drag = setup()
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 500, pointerId: 1 }), 't1', 'move'))
    // Aucun `pointerup` : le geste reste ouvert. Une nouvelle pression du MÊME pointeur doit
    // pouvoir repartir, sinon la timeline resterait morte jusqu'au rechargement.
    act(() => drag.current.onBarPointerDown(ptr({ clientX: 900, pointerId: 1 }), 't2', 'move'))
    act(() => drag.current.onPointerMove(ptr({ clientX: 940, pointerId: 1 })))
    await act(async () => { await drag.current.onPointerUp(ptr({ clientX: 940, pointerId: 1 })) })
    expect(commands.moveTask).toHaveBeenCalledExactlyOnceWith('t2', 1)
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
