'use client'
import { useCallback, useMemo, type PointerEvent } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import type { TicketStatus } from '@/lib/tickets/types'

export interface TicketDragHandlers {
  onCardPointerDown(e: PointerEvent, ticketId: string): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): void
}

function columnUnder(x: number, y: number): TicketStatus | null {
  const status = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-column-status]')?.dataset.columnStatus
  return status === 'todo' || status === 'doing' || status === 'done' ? status : null
}

/**
 * Glisser-déposer d'une carte entre colonnes, AU POINTEUR et non en glisser-déposer HTML natif :
 * ce dernier est inutilisable au doigt, et l'application se veut praticable sur téléphone.
 *
 * Même discipline que `useReorderDrag` : le geste n'écrit qu'un `overStatus` dans le store — la
 * colonne survolée s'en sert pour s'éclairer — et une seule commande part au relâchement, jamais
 * une par colonne traversée.
 *
 * Le dépôt ne change QUE le statut. Il n'existe pas d'ordre manuel dans une colonne : les cartes
 * y sont rangées par numéro, et déposer une carte dans sa propre colonne ne fait donc rien.
 */
export function useTicketDrag(): TicketDragHandlers {
  const onCardPointerDown = useCallback((e: PointerEvent, ticketId: string) => {
    if (e.button !== 0) return
    const s = useTicketsStore.getState()
    if (s.myRole === 'viewer') return
    const ticket = s.tickets[ticketId]
    if (!ticket) return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Pointeur déjà relâché : le geste reste utilisable, il passera par le survol.
    }
    s.setDrag({ ticketId, overStatus: ticket.status })
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = useTicketsStore.getState()
    const d = s.drag
    if (!d) return
    const status = columnUnder(e.clientX, e.clientY)
    // Écrire un état identique à chaque image re-rendrait tout le tableau pour rien.
    if (!status || status === d.overStatus) return
    s.setDrag({ ...d, overStatus: status })
  }, [])

  const onPointerUp = useCallback(async () => {
    const s = useTicketsStore.getState()
    const d = s.drag
    if (!d) return
    // L'aperçu tombe AVANT l'écriture : la commande est optimiste, laisser la colonne éclairée
    // superposerait le repère de dépôt au résultat déjà appliqué.
    s.setDrag(null)
    const ticket = s.tickets[d.ticketId]
    if (!ticket || ticket.status === d.overStatus) return
    await getTicketCommands().updateTicket(d.ticketId, { status: d.overStatus })
  }, [])

  return useMemo(
    () => ({ onCardPointerDown, onPointerMove, onPointerUp }),
    [onCardPointerDown, onPointerMove, onPointerUp],
  )
}
