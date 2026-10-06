'use client'
import Link from 'next/link'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function TicketsToolbar({ view }: { view: 'board' | 'list' }) {
  const projectId = useTicketsStore((s) => s.projectId)
  const myRole = useTicketsStore((s) => s.myRole)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const count = useTicketsStore((s) => Object.keys(s.tickets).length)

  // La vue passe par l'URL et non par le store : elle se partage par lien, et un rechargement
  // rend la même page. Deux liens plutôt qu'un bouton : c'est une navigation, elle mérite un
  // clic milieu et un « ouvrir dans un onglet ».
  const tab = (target: 'board' | 'list', label: string) => (
    <Link
      href={target === 'list' ? `/projects/${projectId}/tickets?vue=liste` : `/projects/${projectId}/tickets`}
      aria-current={view === target ? 'page' : undefined}
      className={cn(
        'border-[3px] border-ink px-3 py-1 font-bold uppercase text-sm brutal-focus',
        view === target ? 'bg-yellow text-on-data' : 'bg-paper',
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
      <Badge color="ink">{count} ticket{count > 1 ? 's' : ''}</Badge>
      {!canEdit && <Badge color="cyan">Lecture seule</Badge>}
      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <nav aria-label="Vue" className="flex gap-2">{tab('board', 'Kanban')}{tab('list', 'Liste')}</nav>
        {canEdit && <Button size="sm" onClick={() => openEditor({ mode: 'create', taskId: null })}>+ Ticket</Button>}
      </div>
      <span className="sr-only" aria-live="polite">Rôle : {myRole}</span>
    </div>
  )
}
