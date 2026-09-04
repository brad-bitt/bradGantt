'use client'
import { useCallback, useMemo, type PointerEvent } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { siblingsOf } from '@/lib/gantt/scheduling'

export interface ReorderDragHandlers {
  onGripPointerDown(e: PointerEvent, taskId: string): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): void
}

/** Rang de la tâche PARMI SES FRÈRES — c'est l'unité de `reorderTask`, pas la ligne à l'écran. */
function siblingIndex(taskId: string): number {
  const s = useGanttStore.getState()
  const t = s.tasks[taskId]
  if (!t) return -1
  return siblingsOf(Object.values(s.tasks), t).findIndex((x) => x.id === taskId)
}

/**
 * Réordonnancement d'une ligne de la sidebar par sa poignée.
 *
 * Même discipline que `useTimelineDrag` : le geste n'écrit qu'un `targetIndex` dans le store —
 * la ligne survolée s'en sert pour afficher le liseré de dépôt — et une seule commande part au
 * relâchement, jamais une par ligne survolée.
 *
 * Le déplacement reste borné à la FRATRIE : survoler une ligne d'un autre parent ne fait rien.
 * Sortir une tâche de son groupe est une autre opération (le champ « Groupe » de l'éditeur) ;
 * la confondre avec un glissement vertical ferait changer de parent par simple imprécision.
 */
export function useReorderDrag(): ReorderDragHandlers {
  const onGripPointerDown = useCallback((e: PointerEvent, taskId: string) => {
    if (e.button !== 0) return
    const s = useGanttStore.getState()
    if (s.myRole === 'viewer') return
    // La poignée vit dans une ligne qui sélectionne au clic : sans quoi le geste sélectionnerait
    // aussi, et le `pointerdown` remonterait jusqu'aux gestionnaires de la sidebar.
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Pointeur déjà relâché : le geste reste utilisable au-dessus de la sidebar.
    }
    s.setDrag({ mode: 'reorder', taskId, targetIndex: siblingIndex(taskId) })
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = useGanttStore.getState()
    const d = s.drag
    if (!d || d.mode !== 'reorder') return
    const overId = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row-task-id]')?.dataset.rowTaskId
    if (!overId || overId === d.taskId) return
    const moving = s.tasks[d.taskId]
    const over = s.tasks[overId]
    if (!moving || !over || over.parentId !== moving.parentId) return
    const targetIndex = siblingIndex(overId)
    // Écrire un état identique à chaque image re-rendrait toute la sidebar pour rien.
    if (targetIndex !== d.targetIndex) s.setDrag({ ...d, targetIndex })
  }, [])

  const onPointerUp = useCallback(async () => {
    const s = useGanttStore.getState()
    const d = s.drag
    if (!d || d.mode !== 'reorder') return
    // L'aperçu tombe AVANT l'écriture : la commande est optimiste, le laisser en place
    // superposerait le liseré de dépôt à l'ordre déjà appliqué.
    s.setDrag(null)
    if (d.targetIndex >= 0 && d.targetIndex !== siblingIndex(d.taskId)) {
      await getGanttCommands().reorderTask(d.taskId, d.targetIndex)
    }
  }, [])

  // Objet stable : il entre dans la valeur mémoïsée du `GanttViewContext`.
  return useMemo(
    () => ({ onGripPointerDown, onPointerMove, onPointerUp }),
    [onGripPointerDown, onPointerMove, onPointerUp],
  )
}
