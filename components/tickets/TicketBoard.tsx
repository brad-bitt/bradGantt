'use client'
import { useMemo } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { filterTickets, ticketsByStatus } from '@/lib/tickets/summary'
import { STATUS_ORDER } from '@/lib/tickets/types'
import { TicketColumn } from './TicketColumn'
import { useTicketDrag } from './useTicketDrag'

export function TicketBoard() {
  const tickets = useTicketsStore((s) => s.tickets)
  const filters = useTicketsStore((s) => s.filters)
  const drag = useTicketDrag()
  // Les filtres de la barre d'outils s'appliquent AUSSI ici : un « Terminé » posé en liste doit
  // se retrouver au kanban. Mémoïsé : `ticketsByStatus` construit trois tableaux neufs à chaque
  // appel, et le sélecteur Zustand compare par référence — le calculer dedans bouclerait.
  const columns = useMemo(() => ticketsByStatus(filterTickets(Object.values(tickets), filters)), [tickets, filters])

  return (
    <div
      className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto p-3 sm:p-6 md:grid-cols-3"
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      // Geste annulé par le navigateur ou l'OS (ex. : un défilement tactile reprend la main) :
      // on abandonne sans écrire, un dépôt non voulu changerait le statut à l'insu de l'utilisateur.
      onPointerCancel={drag.onPointerCancel}
    >
      {STATUS_ORDER.map((status) => (
        <TicketColumn key={status} status={status} tickets={columns[status]} onCardPointerDown={drag.onCardPointerDown} />
      ))}
    </div>
  )
}
