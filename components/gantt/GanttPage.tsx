'use client'
import { useEffect } from 'react'
import { useGanttStore, type HydratePayload } from '@/lib/gantt/store'
import { GanttToolbar } from './GanttToolbar'
import { GanttView } from './GanttView'

export function GanttPage({ payload }: { payload: HydratePayload }) {
  const hydrate = useGanttStore((s) => s.hydrate)
  // Le store est un singleton de module : au premier rendu il contient encore les données du
  // projet précédent (ou l'état vide initial). On attend que `hydrate` ait tourné avant de
  // monter la vue, sinon on afficherait brièvement le Gantt d'un autre projet.
  const ready = useGanttStore((s) => s.projectId === payload.projectId)

  useEffect(() => { hydrate(payload) }, [hydrate, payload])

  if (!ready) return <div className="p-8 font-mono">Chargement…</div>
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <GanttToolbar />
      <GanttView />
    </div>
  )
}
