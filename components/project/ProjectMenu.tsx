'use client'
import { useState, useTransition } from 'react'
import { Menu, type MenuEntry } from '@/components/ui/Menu'
import { RenameProjectDialog } from './RenameProjectDialog'
import { deleteProject, setTicketsEnabled } from '@/app/(app)/(accueil)/projects/actions'
import { toast } from '@/lib/toast/store'

export interface ProjectMenuProps {
  projectId: string
  projectName: string
  ticketsEnabled: boolean
  /** Vrai dans l'en-tête : la page courante appartient au projet supprimé, il faut en sortir. */
  leaveOnDelete?: boolean
  tone?: 'default' | 'header'
  triggerClassName?: string
}

/**
 * Les commandes rares d'un projet, réservées au propriétaire : renommer, basculer les tickets,
 * supprimer. Le MÊME menu sur la carte et dans l'en-tête — deux listes finiraient par diverger.
 *
 * Le libellé de bascule dit l'action (« Activer » / « Désactiver ») : dans un menu, il n'y a pas
 * d'état enfoncé à lire comme sur l'ancien bouton « Tickets ».
 */
export function ProjectMenu({ projectId, projectName, ticketsEnabled, leaveOnDelete = false, tone, triggerClassName }: ProjectMenuProps) {
  const [renaming, setRenaming] = useState(false)
  const [, start] = useTransition()

  function toggleTickets() {
    start(async () => {
      const res = await setTicketsEnabled(projectId, !ticketsEnabled)
      if (res.error) toast.error(res.error)
    })
  }

  function remove() {
    if (!window.confirm(`Supprimer « ${projectName} » et toutes ses tâches ?`)) return
    start(async () => {
      // Avec `leaveOnDelete`, l'action redirige : la promesse ne revient pas avec un résultat.
      const res = await deleteProject(projectId, leaveOnDelete)
      if (res?.error) toast.error(res.error)
    })
  }

  const entries: MenuEntry[] = [
    { id: 'rename', label: 'Renommer', onSelect: () => setRenaming(true) },
    { id: 'tickets', label: ticketsEnabled ? 'Désactiver les tickets' : 'Activer les tickets', onSelect: toggleTickets },
    { id: 'delete', label: 'Supprimer', danger: true, onSelect: remove },
  ]

  return (
    <>
      <Menu label="Actions du projet" entries={entries} tone={tone} triggerClassName={triggerClassName} />
      {renaming && <RenameProjectDialog projectId={projectId} currentName={projectName} open onClose={() => setRenaming(false)} />}
    </>
  )
}
