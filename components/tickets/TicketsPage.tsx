'use client'
import { useEffect, useRef } from 'react'
import { useTicketsStore, type TicketsHydratePayload } from '@/lib/tickets/store'
import { TicketsToolbar } from './TicketsToolbar'
import { TicketBoard } from './TicketBoard'
import { TicketList } from './TicketList'
import { TicketEditor } from './TicketEditor'

export interface TicketsPageProps {
  payload: TicketsHydratePayload
  view: 'board' | 'list'
  /** Ouverture immédiate de l'éditeur, demandée par `?nouveau=` depuis l'éditeur de tâche du Gantt. */
  initialCreate: { taskId: string | null } | null
}

export function TicketsPage({ payload, view, initialCreate }: TicketsPageProps) {
  const hydrate = useTicketsStore((s) => s.hydrate)
  const openEditor = useTicketsStore((s) => s.openEditor)
  // Le store est un singleton de module : au premier rendu il contient encore les tickets du
  // projet précédent. On attend `hydrate` avant de monter les vues, sinon on afficherait
  // brièvement le backlog d'un autre projet.
  const ready = useTicketsStore((s) => s.projectId === payload.projectId)
  const opened = useRef(false)

  useEffect(() => { hydrate(payload) }, [hydrate, payload])

  useEffect(() => {
    // UNE seule ouverture pour toute la vie de la page : `hydrate` referme l'éditeur, et sans
    // ce garde-fou le moindre `router.refresh()` (un changement de vue, par exemple) le
    // rouvrirait par-dessus le travail en cours.
    if (!ready || !initialCreate || opened.current) return
    opened.current = true
    openEditor({ mode: 'create', taskId: initialCreate.taskId })
  }, [ready, initialCreate, openEditor])

  if (!ready) return <div className="p-8 font-mono">Chargement…</div>
  return (
    // La hauteur vient du layout de projet (colonne pleine fenêtre sous l'en-tête) : une
    // soustraction en dur se trompait dès que l'en-tête passait sur deux rangées.
    <div className="flex min-h-0 flex-1 flex-col">
      <TicketsToolbar view={view} />
      {view === 'board' ? <TicketBoard /> : <TicketList />}
      <TicketEditor />
    </div>
  )
}
