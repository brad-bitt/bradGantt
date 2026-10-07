'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import { STATUS_LABELS, STATUS_ORDER, type Ticket, type TicketStatus } from '@/lib/tickets/types'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, type MenuEntry } from '@/components/ui/Menu'
import { STATUS_SWATCH } from './status'
import { cn } from '@/lib/utils'

/** Flèches de statut : commandes d'objet, niveau 3 — elles ne réclament rien au repos. */
const ARROW = 'size-6 font-mono text-xs leading-none text-ink-soft hover:bg-yellow hover:text-on-data brutal-focus'

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

  function move(to: TicketStatus) {
    void getTicketCommands().updateTicket(ticket.id, { status: to })
  }

  function remove() {
    if (!window.confirm(`Supprimer le ticket #${ticket.number} « ${ticket.title} » ?`)) return
    void getTicketCommands().deleteTicket(ticket.id)
  }

  const entries: MenuEntry[] = [
    { id: 'edit', label: 'Modifier', onSelect: () => openEditor({ mode: 'edit', ticketId: ticket.id }) },
    { kind: 'heading', id: 'move', label: 'Déplacer vers…' },
    ...STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => ({ id: `move-${s}`, label: STATUS_LABELS[s], onSelect: () => move(s) })),
    { id: 'delete', label: 'Supprimer', danger: true, onSelect: remove },
  ]

  return (
    <article
      data-ticket-id={ticket.id}
      aria-label={`#${ticket.number} ${ticket.title}`}
      onPointerDown={(e) => onPointerDown(e, ticket.id)}
      // Double-clic, comme les barres du Gantt : la carte capture le pointeur pendant le glisser,
      // si bien que chaque dépôt produirait aussi un clic simple qui ouvrirait la modale.
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', ticketId: ticket.id })}
      className={cn(
        // Surface posée : ombre brutale de 3 px (spec §7). `touch-none` réservé aux éditeurs, et
        // seulement dès md : sous ce seuil les colonnes s'empilent, la carte couvrirait presque
        // tout l'écran et empêcherait de faire défiler au doigt.
        'group/card flex border-[3px] border-ink bg-paper shadow-[3px_3px_0_var(--color-ink)] select-none',
        canEdit && 'cursor-grab active:cursor-grabbing md:touch-none',
        // Terminé : la carte recule, le travail restant passe devant.
        ticket.status === 'done' && 'opacity-75',
        // La carte en vol s'efface : c'est l'emplacement de dépôt qui dit où elle va tomber.
        dragging && 'opacity-40',
      )}
    >
      {/* L'accent de statut : la couleur se lit avant le texte, même colonne repliée. */}
      <span aria-hidden data-testid="status-accent" className={cn('w-[7px] shrink-0 border-r-[3px] border-ink', STATUS_SWATCH[ticket.status])} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex h-7 items-center gap-1">
          <span className="font-mono text-xs text-ink-soft">#{ticket.number}</span>
          {canEdit && (
            // Révélées au survol, au focus, menu ouvert, et toujours au doigt. Les flèches sont
            // l'équivalent ACCESSIBLE du glisser : sans elles, changer un statut serait impossible
            // au clavier. `onDoubleClick` arrêté : deux clics rapides ne doivent pas ouvrir l'éditeur.
            <div
              className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 touch:opacity-100 has-[[aria-expanded=true]]:opacity-100"
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {previous && (
                <button
                  type="button"
                  aria-label={`Déplacer vers ${STATUS_LABELS[previous]}`}
                  className={ARROW}
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
                  className={ARROW}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); move(next) }}
                >
                  →
                </button>
              )}
              <Menu label={`Actions du ticket #${ticket.number}`} entries={entries} />
            </div>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-bold leading-snug">{ticket.title}</p>
        <div className="flex items-center gap-2">
          {taskTitle
            ? <span className="min-w-0 truncate border border-ink/40 px-1 font-mono text-xs">↳ {taskTitle}</span>
            : <span className="text-xs text-ink-soft">Sans tâche</span>}
          {assignee && (
            <span className="ml-auto shrink-0">
              <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
