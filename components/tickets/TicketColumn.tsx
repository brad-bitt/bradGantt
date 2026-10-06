'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/lib/tickets/types'
import { TicketCard } from './TicketCard'
import { cn } from '@/lib/utils'

export function TicketColumn({ status, tickets, onCardPointerDown }: {
  status: TicketStatus
  tickets: Ticket[]
  onCardPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  // Éclairée seulement si un geste est en cours ET qu'il vise CETTE colonne : sans la première
  // condition, la colonne du ticket survolé s'allumerait au simple passage de la souris.
  const isDropTarget = useTicketsStore((s) => s.drag !== null && s.drag.overStatus === status)

  return (
    <section
      data-column-status={status}
      aria-label={STATUS_LABELS[status]}
      className={cn(
        'flex min-h-0 flex-col border-[3px] border-ink bg-band',
        isDropTarget && 'bg-yellow',
      )}
    >
      <header className="flex items-center justify-between border-b-[3px] border-ink px-3 py-2">
        <h2 className="font-display uppercase text-sm">{STATUS_LABELS[status]}</h2>
        <span className="font-mono text-xs text-ink-soft">{tickets.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {tickets.map((t) => <TicketCard key={t.id} ticket={t} onPointerDown={onCardPointerDown} />)}
        {tickets.length === 0 && <p className="p-2 font-mono text-xs text-ink-soft">Vide</p>}
      </div>
    </section>
  )
}
