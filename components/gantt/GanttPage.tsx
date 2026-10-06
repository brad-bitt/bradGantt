'use client'
import { useEffect } from 'react'
import { useGanttStore, type HydratePayload } from '@/lib/gantt/store'
import { GanttToolbar } from './GanttToolbar'
import { GanttView } from './GanttView'
import { GanttSummary } from './GanttSummary'
import { RotateHint } from './RotateHint'
import { ContextMenu } from './ContextMenu'
import { TaskEditor } from './TaskEditor'
import { MembersDialog } from '@/components/project/MembersDialog'

export function GanttPage({ payload }: { payload: HydratePayload }) {
  const hydrate = useGanttStore((s) => s.hydrate)
  // Le store est un singleton de module : au premier rendu il contient encore les données du
  // projet précédent (ou l'état vide initial). On attend que `hydrate` ait tourné avant de
  // monter la vue, sinon on afficherait brièvement le Gantt d'un autre projet.
  const ready = useGanttStore((s) => s.projectId === payload.projectId)

  useEffect(() => { hydrate(payload) }, [hydrate, payload])

  if (!ready) return <div className="p-8 font-mono">Chargement…</div>
  return (
    // La hauteur vient du layout de projet (colonne pleine fenêtre sous l'en-tête) : une
    // soustraction en dur se trompait dès que l'en-tête passait sur deux rangées.
    <div className="flex min-h-0 flex-1 flex-col">
      <GanttToolbar />
      <RotateHint />
      <GanttView />
      <GanttSummary />
      <TaskEditor />
      <ContextMenu />
      <MembersDialog />
    </div>
  )
}
