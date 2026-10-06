import type { Ticket, TicketPatch } from './types'

export type TicketEvent =
  | { type: 'ticket.created'; ticket: Ticket }
  | { type: 'ticket.updated'; ticketId: string; patch: TicketPatch }
  | { type: 'ticket.deleted'; ticketId: string }

export function indexTickets(tickets: Ticket[]): Record<string, Ticket> {
  return Object.fromEntries(tickets.map((t) => [t.id, t]))
}

/**
 * Réducteur unique des tickets, sur le modèle de `lib/gantt/events.ts`. Il retourne l'état
 * REÇU à l'identique quand l'événement ne s'applique à rien : le store Zustand compare par
 * référence, un nouvel objet re-rendrait toute la page pour rien.
 */
export function applyTicketEvent(
  tickets: Record<string, Ticket>,
  event: TicketEvent,
): Record<string, Ticket> {
  switch (event.type) {
    case 'ticket.created':
      return { ...tickets, [event.ticket.id]: event.ticket }

    case 'ticket.updated': {
      const current = tickets[event.ticketId]
      if (!current) return tickets
      return { ...tickets, [event.ticketId]: { ...current, ...event.patch } }
    }

    case 'ticket.deleted': {
      if (!tickets[event.ticketId]) return tickets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- extraction volontaire pour retirer la clé par déstructuration
      const { [event.ticketId]: _removed, ...rest } = tickets
      return rest
    }
  }
}
