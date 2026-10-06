'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import { STATUS_LABELS, STATUS_ORDER, type Ticket } from '@/lib/tickets/types'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

export function TicketCard({ ticket, onPointerDown }: {
  ticket: Ticket
  onPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const dragging = useTicketsStore((s) => s.drag?.ticketId === ticket.id)
  const assignee = useTicketsStore((s) => s.members.find((m) => m.userId === ticket.assigneeId))
  const taskTitle = useTicketsStore((s) => s.tasks.find((t) => t.id === ticket.taskId)?.title)

  const index = STATUS_ORDER.indexOf(ticket.status)
  const previous = STATUS_ORDER[index - 1]
  const next = STATUS_ORDER[index + 1]

  function move(to: (typeof STATUS_ORDER)[number]) {
    void getTicketCommands().updateTicket(ticket.id, { status: to })
  }

  return (
    <article
      data-ticket-id={ticket.id}
      aria-label={`#${ticket.number} ${ticket.title}`}
      onPointerDown={(e) => onPointerDown(e, ticket.id)}
      // Double-clic, comme les barres du Gantt : la carte capture le pointeur pendant le glisser,
      // si bien que chaque dépôt produirait aussi un clic simple qui ouvrirait la modale.
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', ticketId: ticket.id })}
      className={cn(
        // `touch-none` réservé aux éditeurs, et seulement dès md : sous ce seuil les colonnes
        // s'empilent et le glisser n'a pas de défilement automatique, donc la carte couvrirait
        // presque tout l'écran et empêcherait de faire défiler au doigt. Sur téléphone, un
        // éditeur change le statut avec les flèches (visibles au toucher).
        'group/card flex flex-col gap-2 border-[3px] border-ink bg-paper p-3 select-none',
        canEdit && 'cursor-grab active:cursor-grabbing md:touch-none',
        // La carte en cours de déplacement s'efface : c'est la colonne éclairée qui porte
        // l'information « où ça va tomber », pas la carte qui la quitte.
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-ink-soft">#{ticket.number}</span>
        {assignee && (
          <span className="ml-auto">
            <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />
          </span>
        )}
      </div>
      <p className="text-sm font-bold leading-snug">{ticket.title}</p>
      {taskTitle && <p className="truncate font-mono text-xs text-ink-soft">↳ {taskTitle}</p>}
      {canEdit && (
        // Les flèches sont l'équivalent ACCESSIBLE du glisser-déposer : sans elles, changer un
        // statut serait impossible au clavier. Elles suivent la règle de l'application —
        // discrètes au repos, présentes au survol, au focus et sur écran tactile.
        // `onDoubleClick` arrêté : deux clics rapides sur une flèche ne doivent pas ouvrir l'éditeur.
        <div
          className="flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 touch:opacity-100"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {previous && (
            <button
              type="button"
              aria-label={`Déplacer vers ${STATUS_LABELS[previous]}`}
              className="size-6 border-[3px] border-ink bg-paper font-mono text-xs leading-none hover:bg-yellow hover:text-on-data brutal-focus"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); move(previous) }}
            >
              ←
            </button>
          )}
          {next && (
            <button
              type="button"
              aria-label={`Déplacer vers ${STATUS_LABELS[next]}`}
              className="size-6 border-[3px] border-ink bg-paper font-mono text-xs leading-none hover:bg-yellow hover:text-on-data brutal-focus"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); move(next) }}
            >
              →
            </button>
          )}
        </div>
      )}
    </article>
  )
}
