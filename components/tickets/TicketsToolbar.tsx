'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { filterTickets } from '@/lib/tickets/summary'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TicketFilterFields } from './TicketFilterFields'
import { cn } from '@/lib/utils'

const plural = (n: number) => `ticket${n > 1 ? 's' : ''}`

/**
 * Barre d'outils commune aux deux vues : la vue (segments), les filtres, le compte, et
 * « + Ticket ». Le titre et le retour au Gantt sont dans l'en-tête du projet.
 */
export function TicketsToolbar({ view }: { view: 'board' | 'list' }) {
  const projectId = useTicketsStore((s) => s.projectId)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const tickets = useTicketsStore((s) => s.tickets)
  const filters = useTicketsStore((s) => s.filters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const total = Object.keys(tickets).length
  // Mémoïsé : `filterTickets` rend un tableau neuf, le calculer dans un sélecteur bouclerait.
  const shown = useMemo(() => filterTickets(Object.values(tickets), filters).length, [tickets, filters])
  const filtered = filters.status !== 'all' || filters.assigneeId !== 'all' || filters.taskId !== 'all'

  // La vue passe par l'URL et non par le store : elle se partage par lien, et un rechargement
  // rend la même page. Des liens et non des boutons : c'est une navigation.
  const segment = (target: 'board' | 'list', label: string) => (
    <Link
      href={target === 'list' ? `/projects/${projectId}/tickets?vue=liste` : `/projects/${projectId}/tickets`}
      aria-current={view === target ? 'page' : undefined}
      className={cn(
        'border-r-[3px] border-ink px-3 py-1 text-sm font-bold last:border-r-0 brutal-focus',
        view === target ? 'bg-yellow text-on-data' : 'bg-paper hover:bg-band',
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6">
      <nav aria-label="Vue" className="inline-flex border-[3px] border-ink">{segment('board', 'Kanban')}{segment('list', 'Liste')}</nav>
      {/* Au bureau, les filtres en ligne ; sur téléphone, derrière « Filtres » : trois sélecteurs
          côte à côte élargissaient la page. */}
      <div className="hidden items-center gap-2 sm:flex"><TicketFilterFields compact /></div>
      <Button size="sm" variant="secondary" className="sm:hidden" onClick={() => setFiltersOpen(true)}>
        Filtres{filtered && <span aria-hidden className="text-xs">●</span>}
      </Button>
      {/* Un filtre qui cache tout ne doit pas se lire comme un backlog vide : « 0 sur 7 ». */}
      <span data-testid="tickets-count" aria-live="polite" className="text-sm text-ink-soft">
        {filtered
          ? <><span className="font-mono">{shown}</span> sur <span className="font-mono">{total}</span> {plural(total)}</>
          : <><span className="font-mono">{total}</span> {plural(total)}</>}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {canEdit
          ? <Button size="sm" onClick={() => openEditor({ mode: 'create', taskId: null })}>+ Ticket</Button>
          : <Badge color="cyan">Lecture seule</Badge>}
      </div>
      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtres"
        footer={<Button onClick={() => setFiltersOpen(false)}>Voir les tickets</Button>}
      >
        <div className="space-y-3"><TicketFilterFields /></div>
      </Dialog>
    </div>
  )
}
