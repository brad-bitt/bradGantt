'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/lib/tickets/types'
import { TicketCard } from './TicketCard'
import { STATUS_SWATCH } from './status'
import { cn } from '@/lib/utils'

/**
 * Une colonne du kanban, sans cadre : un en-tête (pastille, nom, compte, filet) et des cartes.
 * Le grand cadre d'avant mettait trois boîtes autour des cartes, qui sont déjà des boîtes.
 *
 * La SECTION entière reste la cible du dépôt (`data-column-status`, lu par `useTicketDrag`) :
 * sans cadre, la colonne garde au moins la hauteur d'une carte pour rester visable.
 */
export function TicketColumn({ status, tickets, onCardPointerDown }: {
  status: TicketStatus
  tickets: Ticket[]
  onCardPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  // Statut d'ORIGINE de la carte en vol : déposer dans sa propre colonne ne fait rien, on n'y
  // offre donc pas d'emplacement.
  const dragFrom = useTicketsStore((s) => (s.drag ? (s.tickets[s.drag.ticketId]?.status ?? null) : null))
  const hovered = useTicketsStore((s) => s.drag !== null && s.drag.overStatus === status)
  const showSlot = dragFrom !== null && dragFrom !== status

  return (
    <section data-column-status={status} aria-label={STATUS_LABELS[status]} className="flex flex-col gap-3">
      <header className="flex items-center gap-2 border-b-[3px] border-ink pb-2">
        <span aria-hidden data-testid="status-swatch" className={cn('size-3 shrink-0 border-2 border-ink', STATUS_SWATCH[status])} />
        <h2 className="font-display text-sm uppercase">{STATUS_LABELS[status]}</h2>
        <span className="ml-auto font-mono text-xs text-ink-soft">{tickets.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-3">
        {tickets.map((t) => <TicketCard key={t.id} ticket={t} onPointerDown={onCardPointerDown} />)}
        {tickets.length === 0 && !showSlot && <p className="p-2 text-xs text-ink-soft">Vide</p>}
        {showSlot && (
          // Rien hors glisser : un emplacement permanent serait du décor qui ne dit rien.
          <div
            data-testid="drop-slot"
            className={cn(
              'flex h-16 items-center justify-center border-[3px] border-dashed text-sm',
              hovered ? 'border-ink bg-yellow text-on-data' : 'border-ink/40 text-ink-soft',
            )}
          >
            Déposer ici
          </div>
        )}
      </div>
    </section>
  )
}
