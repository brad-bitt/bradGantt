'use client'
import { useCallback, useMemo, useRef, type PointerEvent, type RefObject } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { DRAG_THRESHOLD_PX, pxToDays } from '@/lib/gantt/geometry'

export type BarDragMode = 'move' | 'resize-start' | 'resize-end'

export interface TimelineDragHandlers {
  onBarPointerDown(e: PointerEvent, taskId: string, mode: BarDragMode): void
  /** Tracé d'une liaison. Aucune poignée ne l'appelle avant la tâche 12. */
  onLinkPointerDown(e: PointerEvent, fromTaskId: string): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): Promise<void>
  /**
   * Geste repris par le système (pointeur déconnecté, menu contextuel, prise en charge par le
   * navigateur). L'utilisateur n'a RIEN relâché : on abandonne l'aperçu sans écrire. Partager
   * `onPointerUp` ici — ce que faisait le brief — enregistrerait un déplacement que personne
   * n'a validé.
   */
  onPointerCancel(e: PointerEvent): void
}

/**
 * Glisser-déposer des barres de la timeline : déplacement, redimensionnement par un bord, et
 * tracé d'une liaison (branché en tâche 12).
 *
 * Deux principes gouvernent ce hook.
 *
 * 1. **L'aperçu ne touche pas le DOM.** Le geste n'écrit qu'un `deltaDays` dans le store ;
 *    `computeLayout` en dérive les dates effectives et donc la géométrie de toutes les barres,
 *    bornes de groupe et flèches comprises. Déplacer la barre à la main aurait laissé le reste
 *    du dessin en arrière.
 *
 * 2. **Rien n'est écrit avant le relâchement.** Les commandes `moveTask`/`resizeTask` (tâche 8)
 *    sont optimistes avec annulation ciblée ; les appeler à chaque image produirait une écriture
 *    par jour survolé. Le delta est donc mesuré depuis le point de pression — jamais cumulé
 *    d'une image à l'autre — et une seule commande part à la fin.
 *
 * `getGanttCommands()` est appelé au relâchement et non à la construction du hook : le
 * singleton relit le projet courant à chaque appel (tâche 8), le capturer figerait un contexte.
 */
export function useTimelineDrag(timelineRef: RefObject<HTMLDivElement | null>): TimelineDragHandlers {
  /**
   * Le geste en cours. `null` hors geste.
   *
   * - `x`/`y` : position de la pression, en coordonnées écran ; le delta se mesure toujours
   *   depuis ce point, jamais d'une image à l'autre.
   * - `pointerId` : le pointeur PROPRIÉTAIRE du geste. Les événements des autres pointeurs sont
   *   ignorés — sans quoi un second doigt posé sur une autre barre écrasait cette origine et le
   *   geste finissait par écrire sur la mauvaise tâche, sans qu'aucun aperçu ne l'annonce.
   * - `armed` : le seuil de déclenchement a été franchi. Tant qu'il vaut `false`, le delta reste
   *   gelé à zéro (voir `DRAG_THRESHOLD_PX`).
   */
  const start = useRef<{ x: number; y: number; pointerId: number; armed: boolean } | null>(null)

  const toLocal = useCallback((e: PointerEvent) => {
    const el = timelineRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [timelineRef])

  /**
   * Sans capture, le premier pixel parcouru fait sortir le pointeur de la barre et les
   * `pointermove` suivants ne sont plus dirigés vers elle. La capture les redirige vers
   * l'élément pressé — qui reste un descendant de la timeline, donc les gestionnaires posés
   * sur celle-ci continuent de les recevoir par propagation.
   */
  const capture = useCallback((e: PointerEvent) => {
    const target = e.currentTarget as HTMLElement
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // Pointeur déjà relâché entre-temps : le geste reste utilisable au-dessus de la timeline.
    }
    start.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, armed: false }
  }, [])

  /**
   * Vrai si l'événement vient d'un pointeur AUTRE que celui qui a ouvert le geste en cours.
   * Un seul geste à la fois : le premier pointeur pressé le garde jusqu'à son relâchement.
   *
   * Le même `pointerId` n'est jamais étranger : c'est ce qui permet à une nouvelle pression de
   * la souris (`pointerId` stable) de reprendre la main si un `pointerup` avait été perdu.
   */
  const isForeignPointer = useCallback(
    (e: PointerEvent) => start.current !== null && start.current.pointerId !== e.pointerId,
    [],
  )

  const onBarPointerDown = useCallback((e: PointerEvent, taskId: string, mode: BarDragMode) => {
    if (e.button !== 0 || isForeignPointer(e)) return
    const s = useGanttStore.getState()
    // La sélection, elle, vaut aussi pour un lecteur : c'est le remplaçant du `onClick`.
    s.select({ kind: 'task', id: taskId })
    if (s.myRole === 'viewer') return
    // Les poignées de redimensionnement sont des enfants de la barre : sans ceci, la barre
    // armerait un déplacement par-dessus le redimensionnement demandé.
    e.stopPropagation()
    capture(e)
    s.setDrag({ mode, taskId, deltaDays: 0 })
  }, [capture, isForeignPointer])

  const onLinkPointerDown = useCallback((e: PointerEvent, fromTaskId: string) => {
    if (e.button !== 0 || isForeignPointer(e)) return
    const s = useGanttStore.getState()
    if (s.myRole === 'viewer') return
    e.stopPropagation()
    capture(e)
    const p = toLocal(e)
    s.setDrag({ mode: 'link', fromTaskId, x: p.x, y: p.y })
  }, [capture, isForeignPointer, toLocal])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = useGanttStore.getState()
    const d = s.drag
    const st = start.current
    // La timeline reçoit tous les survols : hors geste ouvert, il n'y a rien à faire. Et les
    // déplacements d'un second pointeur ne doivent pas piloter le geste du premier.
    if (!d || !st || st.pointerId !== e.pointerId) return
    if (d.mode === 'link') {
      const p = toLocal(e)
      s.setDrag({ ...d, x: p.x, y: p.y })
      return
    }
    if (d.mode === 'reorder') return
    const dx = e.clientX - st.x
    // Seuil de déclenchement. Sous `DRAG_THRESHOLD_PX`, le geste n'est pas armé et le delta
    // reste GELÉ À ZÉRO : un clic (ou un double-clic) qui tremble de un à trois pixels ne
    // modifie plus la tâche, alors qu'au zoom mois deux pixels suffisaient à la décaler d'un
    // jour et à l'écrire en base. Une fois armé, le geste le reste jusqu'au relâchement : on ne
    // veut pas qu'un retour près du point de départ désarme un déplacement délibéré.
    if (!st.armed) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      st.armed = true
    }
    const deltaDays = pxToDays(dx, s.zoom)
    // Écrire un objet identique à chaque pixel invaliderait la mémoïsation de `computeLayout`
    // et referait un calcul de mise en page complet pour un dessin inchangé.
    if (deltaDays !== d.deltaDays) s.setDrag({ ...d, deltaDays })
  }, [toLocal])

  const onPointerUp = useCallback(async (e: PointerEvent) => {
    const s = useGanttStore.getState()
    const d = s.drag
    // Le relâchement d'un pointeur secondaire ne clôt pas le geste du pointeur propriétaire.
    if (start.current && start.current.pointerId !== e.pointerId) return
    start.current = null
    if (!d) return
    // L'aperçu est retiré AVANT l'écriture : la commande applique le résultat de façon
    // optimiste, et le laisser en place empilerait le delta du geste par-dessus les dates
    // déjà décalées le temps de l'aller-retour réseau.
    s.setDrag(null)
    const cmd = getGanttCommands()
    if (d.mode === 'move') {
      if (d.deltaDays !== 0) await cmd.moveTask(d.taskId, d.deltaDays)
    } else if (d.mode === 'resize-start' || d.mode === 'resize-end') {
      if (d.deltaDays !== 0) await cmd.resizeTask(d.taskId, d.mode === 'resize-start' ? 'start' : 'end', d.deltaDays)
    } else if (d.mode === 'link') {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-task-id]')
      const toId = target?.dataset.taskId
      if (toId) await cmd.linkTasks(d.fromTaskId, toId)
    }
  }, [])

  const onPointerCancel = useCallback((e: PointerEvent) => {
    // Même règle qu'au relâchement : un `pointercancel` sur un pointeur secondaire n'abandonne
    // pas le geste en cours du pointeur propriétaire.
    if (start.current && start.current.pointerId !== e.pointerId) return
    start.current = null
    useGanttStore.getState().setDrag(null)
  }, [])

  // Objet stable : il entre dans la valeur du `GanttViewContext`, dont la mémoïsation
  // (posée en tâche 9) perdrait tout effet si ce littéral était recréé à chaque rendu.
  return useMemo(
    () => ({ onBarPointerDown, onLinkPointerDown, onPointerMove, onPointerUp, onPointerCancel }),
    [onBarPointerDown, onLinkPointerDown, onPointerMove, onPointerUp, onPointerCancel],
  )
}
