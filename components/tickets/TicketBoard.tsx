'use client'
import { useMemo } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { ticketsByStatus } from '@/lib/tickets/summary'
import { STATUS_ORDER } from '@/lib/tickets/types'
import { TicketColumn } from './TicketColumn'
import { useTicketDrag } from './useTicketDrag'

export function TicketBoard() {
  const tickets = useTicketsStore((s) => s.tickets)
  const drag = useTicketDrag()
  // Mémoïsé : `ticketsByStatus` construit trois tableaux neufs à chaque appel, et le sélecteur
  // Zustand compare par référence — le calculer dans le sélecteur bouclerait.
  const columns = useMemo(() => ticketsByStatus(Object.values(tickets)), [tickets])

  return (
    <div
      className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6 md:grid-cols-3"
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      // Un pointeur qui quitte la fenêtre en plein geste laisserait la colonne éclairée pour
      // toujours : on traite l'annulation comme un relâchement.
      onPointerCancel={drag.onPointerUp}
    >
      {STATUS_ORDER.map((status) => (
        <TicketColumn key={status} status={status} tickets={columns[status]} onCardPointerDown={drag.onCardPointerDown} />
      ))}
    </div>
  )
}
